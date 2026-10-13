-- Las filas receptoras son proyecciones publicadas, no copias editables.
-- Esto mantiene una sola lectura para mapa, SEP, exportaciones y contexto de IA.
alter table public.planes_estudio add column categoria text not null default 'CARRERA'
  check (categoria in ('CARRERA', 'AREA_COMUN'));
alter table public.planes_estudio alter column carrera_id drop not null;
alter table public.planes_estudio add constraint planes_categoria_carrera_check
  check ((categoria = 'CARRERA' and carrera_id is not null) or
         (categoria = 'AREA_COMUN' and carrera_id is null));
create unique index planes_area_comun_unica on public.planes_estudio(categoria)
  where categoria = 'AREA_COMUN';

create table public.area_comun_publicaciones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planes_estudio(id) on delete restrict,
  numero integer not null,
  contenido jsonb not null,
  publicado_por uuid references public.usuarios_app(id),
  publicado_en timestamptz not null default now(),
  unique(plan_id, numero)
);
create table public.area_comun_configuracion (
  plan_id uuid primary key references public.planes_estudio(id) on delete restrict,
  borrador jsonb not null default '[]'::jsonb check (jsonb_typeof(borrador) = 'array'),
  publicacion_id uuid references public.area_comun_publicaciones(id),
  revision integer not null default 1,
  actualizado_en timestamptz not null default now()
);
create table public.area_comun_incorporaciones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references public.planes_estudio(id) on delete cascade,
  publicacion_id uuid not null references public.area_comun_publicaciones(id),
  distribucion_clave text not null,
  electivas jsonb not null default '{}'::jsonb check (jsonb_typeof(electivas) = 'object'),
  linea_id uuid not null unique references public.lineas_plan(id) on delete restrict,
  creado_por uuid references public.usuarios_app(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table public.asignaturas
  add column area_comun_incorporacion_id uuid references public.area_comun_incorporaciones(id) on delete restrict,
  add column area_comun_origen_id uuid references public.asignaturas(id) on delete restrict,
  add column area_comun_espacio text,
  add constraint asignaturas_area_comun_vinculo_check check (
    (area_comun_incorporacion_id is null and area_comun_origen_id is null and area_comun_espacio is null)
    or (area_comun_incorporacion_id is not null and area_comun_origen_id is not null and area_comun_espacio is not null)),
  add constraint asignaturas_area_comun_espacio_unique unique(area_comun_incorporacion_id, area_comun_espacio);
create index asignaturas_area_comun_origen_idx on public.asignaturas(area_comun_origen_id);
create table public.area_comun_historial (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planes_estudio(id) on delete cascade,
  accion text not null,
  detalle jsonb not null default '{}'::jsonb,
  usuario_id uuid references public.usuarios_app(id),
  creado_en timestamptz not null default now()
);

-- Marcador privado de transacción: no se puede falsificar con un GUC del cliente.
create table private.area_comun_operaciones (
  transaccion bigint primary key,
  backend integer not null
);
revoke all on private.area_comun_operaciones from public, anon, authenticated, service_role;
create function private.area_comun_operacion() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.area_comun_operaciones
    where transaccion = txid_current() and backend = pg_backend_pid());
$$;

insert into public.permisos(clave,nombre,grupo) values
  ('area_comun.gestionar','Gestionar Área común','area_comun'),
  ('area_comun.publicar','Publicar Área común','area_comun')
on conflict (clave) do nothing;
-- 'externo' evita convertir este rol institucional en un alcance global de carreras.
insert into public.roles(clave,nombre,descripcion,alcance_default)
values ('AREA_COMUN','Área común','Gestión del catálogo curricular común institucional','externo')
on conflict (clave) do nothing;
insert into public.roles_permisos(rol_id,permiso_id)
select r.id,p.id from public.roles r cross join public.permisos p
where r.clave='AREA_COMUN' and p.clave in
('area_comun.gestionar','area_comun.publicar','planes.ver','asignaturas.ver','asignaturas.editar',
 'ia.usar','archivos.ver','archivos.gestionar','auditoria.ver')
on conflict do nothing;

create function private.area_comun_gestor(p_usuario uuid, p_publicar boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_usuario is not null and case when p_usuario = auth.uid()
    then public.authz_has_permission(case when p_publicar then 'area_comun.publicar' else 'area_comun.gestionar' end)
    else public.usuario_tiene_permiso(p_usuario,case when p_publicar then 'area_comun.publicar' else 'area_comun.gestionar' end)
  end;
$$;

-- Conservar las reglas ordinarias, incluidas simulación y alcances, sin duplicarlas.
do $$ declare n text; d text; begin
  foreach n in array array['usuario_puede_acceder_plan','usuario_puede_editar_plan',
    'usuario_puede_editar_asignatura','usuario_puede_usar_ia_asignatura'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p
    where p.pronamespace='private'::regnamespace and p.proname=n;
    execute replace(d, 'FUNCTION private.' || n || '(', 'FUNCTION private.' || n || '_sin_area_comun(');
  end loop;
end $$;
create or replace function private.usuario_puede_acceder_plan(p_usuario_id uuid,p_plan_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p.categoria='AREA_COMUN' then private.area_comun_gestor(p_usuario_id)
    else private.usuario_puede_acceder_plan_sin_area_comun(p_usuario_id,p_plan_id) end
  from public.planes_estudio p where p.id=p_plan_id;
$$;
create or replace function private.usuario_puede_editar_plan(p_usuario_id uuid,p_plan_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p.categoria='AREA_COMUN' then private.area_comun_gestor(p_usuario_id)
    else private.usuario_puede_editar_plan_sin_area_comun(p_usuario_id,p_plan_id) end
  from public.planes_estudio p where p.id=p_plan_id;
$$;
create or replace function private.usuario_puede_editar_asignatura(p_usuario_id uuid,p_asignatura_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a.area_comun_incorporacion_id is null and
    private.usuario_puede_editar_asignatura_sin_area_comun(p_usuario_id,p_asignatura_id)
  from public.asignaturas a where a.id=p_asignatura_id;
$$;
create or replace function private.usuario_puede_usar_ia_asignatura(p_usuario_id uuid,p_asignatura_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a.area_comun_incorporacion_id is null and
    private.usuario_puede_usar_ia_asignatura_sin_area_comun(p_usuario_id,p_asignatura_id)
  from public.asignaturas a where a.id=p_asignatura_id;
$$;
create or replace function public.authz_asignatura_write_allowed(p_asignatura_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a.area_comun_incorporacion_id is null and (
    public.usuario_puede_editar_asignatura(auth.uid(),a.id) or
    (public.authz_is_admin() and public.authz_admin_override_reason() is not null
     and public.authz_can_access_asignatura(a.id)))
  from public.asignaturas a where a.id=p_asignatura_id;
$$;
create or replace function public.authz_asignatura_content_write_allowed(p_asignatura_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.area_comun_operacion() or
    (a.area_comun_incorporacion_id is null and case when p.categoria='AREA_COMUN'
      then private.area_comun_gestor(auth.uid()) else
      public.authz_asignatura_write_allowed(a.id) or private.authz_asignatura_responsable_editor(a.id) end)
  from public.asignaturas a join public.planes_estudio p on p.id=a.plan_estudio_id
  where a.id=p_asignatura_id;
$$;

create function private.proteger_area_comun() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_plan uuid; begin
  if private.area_comun_operacion() then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_table_name='asignaturas' then
    if (tg_op<>'INSERT' and old.area_comun_incorporacion_id is not null)
       or (tg_op<>'DELETE' and new.area_comun_incorporacion_id is not null) then
      raise exception 'La asignatura es administrada por Área común' using errcode='42501';
    end if;
    if tg_op='DELETE' then
      if exists(select 1 from public.area_comun_publicaciones p,
        jsonb_array_elements(p.contenido->'asignaturas') a where a->>'id'=old.id::text) then
        raise exception 'La asignatura tiene publicaciones; retírala de la distribución o sustitúyela' using errcode='23514';
      end if;
      v_plan:=old.plan_estudio_id;
    else v_plan:=new.plan_estudio_id; end if;
  elsif tg_table_name='lineas_plan' then
    if tg_op='DELETE' then v_id:=old.id; v_plan:=old.plan_estudio_id;
    else v_id:=new.id; v_plan:=new.plan_estudio_id; end if;
    if exists(select 1 from public.area_comun_incorporaciones where linea_id=v_id) then
      raise exception 'La línea es administrada por Área común' using errcode='42501';
    end if;
  elsif tg_table_name='planes_estudio' then
    if tg_op='UPDATE' and new.categoria is distinct from old.categoria then
      raise exception 'No se puede cambiar la categoría de un plan' using errcode='42501';
    end if;
    if tg_op='DELETE' and old.categoria='AREA_COMUN' then
      raise exception 'El plan institucional de Área común no se puede eliminar' using errcode='42501';
    end if;
    if tg_op='UPDATE' and exists(select 1 from public.area_comun_incorporaciones where plan_id=new.id)
       and (new.numero_ciclos is distinct from old.numero_ciclos
         or new.tipo_ciclo is distinct from old.tipo_ciclo or new.carrera_id is distinct from old.carrera_id) then
      raise exception 'Retira la línea común antes de cambiar la carrera o duración del plan' using errcode='23514';
    end if;
    if tg_op='DELETE' then v_plan:=old.id; else v_plan:=new.id; end if;
  else
    if tg_op='DELETE' then v_id:=old.asignatura_id; else v_id:=new.asignatura_id; end if;
    select a.plan_estudio_id into v_plan from public.asignaturas a where a.id=v_id;
    if exists(select 1 from public.asignaturas where id=v_id and area_comun_incorporacion_id is not null) then
      raise exception 'El contenido vinculado es de solo lectura' using errcode='42501';
    end if;
  end if;
  if exists(select 1 from public.planes_estudio where id=v_plan and categoria='AREA_COMUN')
    and auth.uid() is not null and not private.area_comun_gestor(auth.uid()) then
    raise exception 'Solo Área común puede gestionar el catálogo' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger a_area_comun_guard before insert or update or delete on public.asignaturas
for each row execute function private.proteger_area_comun();
create trigger a_area_comun_guard before insert or update or delete on public.lineas_plan
for each row execute function private.proteger_area_comun();
create trigger a_area_comun_guard before insert or update or delete on public.planes_estudio
for each row execute function private.proteger_area_comun();
-- Aplicar la misma frontera a todos los recursos que pertenecen a una asignatura.
do $$ declare t text; begin
  foreach t in array array['bibliografia_asignatura','responsables_asignatura','learning_objects',
    'learning_quality_scores','learning_object_jobs'] loop
    if exists(select 1 from information_schema.columns where table_schema='public'
      and table_name=t and column_name='asignatura_id') then
      execute format('create trigger a_area_comun_guard before insert or update or delete on public.%I for each row execute function private.proteger_area_comun()',t);
    end if;
  end loop;
end $$;

-- Las proyecciones mantienen la estructura original, aunque el receptor use otro paquete.
-- Solo la sincronización privada puede escribirlas; valida el catálogo antes de publicar.
do $$ declare n text; d text; begin
  foreach n in array array['fn_validar_asignatura_estructura_plan','fn_validar_datos_asignatura'] loop
    select pg_get_functiondef(oid) into d from pg_proc
      where pronamespace='public'::regnamespace and proname=n;
    d:=replace(d,E'BEGIN\n',E'BEGIN\n  IF NEW.area_comun_incorporacion_id IS NOT NULL AND private.area_comun_operacion() THEN RETURN NEW; END IF;\n');
    -- pg_get_functiondef conserva CRLF en las funciones originales.
    if position('IF NEW.area_comun_incorporacion_id' in d)=0 then
      d:=replace(d,E'BEGIN\r\n',E'BEGIN\r\n  IF NEW.area_comun_incorporacion_id IS NOT NULL AND private.area_comun_operacion() THEN RETURN NEW; END IF;\r\n');
    end if;
    execute d;
  end loop;
end $$;

create or replace function public.fn_planes_set_nombre_display() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_tipo public.tipo_estructura_plan; v_nombre text; begin
  select tipo into v_tipo from public.estructuras_plan where id=new.estructura_id;
  if v_tipo is null then raise exception 'No se encontró la estructura del plan'; end if;
  if new.categoria='AREA_COMUN' then
    new.nombre_display:=coalesce(nullif(trim(new.nombre),''),'Área curricular común básica');
    new.nombre_propuesto:=new.nombre_display;
    return new;
  end if;
  if new.fecha_inicio_imparticion is not null then
    new.fecha_inicio_imparticion:=date_trunc('month',new.fecha_inicio_imparticion)::date;
  end if;
  if v_tipo='CURRICULAR' then
    if new.fecha_inicio_imparticion is null then raise exception 'Los planes con estructura CURRICULAR requieren fecha_inicio_imparticion.'; end if;
    new.nombre:=null; new.nombre_propuesto:=null;
    new.nombre_display:=public.fn_generar_nombre_plan_curricular(new.carrera_id,new.fecha_inicio_imparticion);
  else
    v_nombre:=coalesce(nullif(trim(new.nombre_propuesto),''),nullif(trim(new.nombre),''),'Plan sin nombre');
    new.nombre_propuesto:=v_nombre; new.nombre:=v_nombre; new.nombre_display:=v_nombre;
  end if;
  return new;
end $$;

-- Resolución común de distribuciones: una variante por carrera prevalece sobre la general.
create function private.area_comun_distribucion(p_config jsonb,p_plan uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select d from public.planes_estudio p cross join jsonb_array_elements(p_config) d
  where p.id=p_plan and d->>'tipo_ciclo'=p.tipo_ciclo::text
    and (d->>'numero_ciclos')::integer=p.numero_ciclos
    and (nullif(d->>'carrera_id','') is null or d->>'carrera_id'=p.carrera_id::text)
  order by (nullif(d->>'carrera_id','') is not null) desc limit 1;
$$;

create function private.area_comun_materializar(p_incorporacion uuid,p_contenido jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.area_comun_incorporaciones; d jsonb; e jsonb; a jsonb; b jsonb;
  origen uuid; destino uuid; anterior uuid; prereq uuid; espacios text[]:='{}'; begin
  select * into i from public.area_comun_incorporaciones where id=p_incorporacion for update;
  d:=private.area_comun_distribucion(p_contenido->'distribuciones',i.plan_id);
  if d is null then raise exception 'No hay una distribución compatible para el plan %',i.plan_id using errcode='23514'; end if;
  for e in select value from jsonb_array_elements(d->'espacios') loop
    espacios:=array_append(espacios,e->>'clave');
    origen:=coalesce(nullif(e->>'asignatura_id',''),nullif(i.electivas->>(e->>'clave'),''))::uuid;
    if origen is null or (e ? 'opciones' and not (e->'opciones' ? origen::text)) then
      raise exception 'Selecciona una electiva válida para % en el plan %',e->>'clave',i.plan_id using errcode='23514';
    end if;
    select value into a from jsonb_array_elements(p_contenido->'asignaturas') where value->>'id'=origen::text;
    if a is null then raise exception 'La distribución contiene una asignatura no publicada' using errcode='23514'; end if;
    select id into destino from public.asignaturas
      where area_comun_incorporacion_id=i.id and area_comun_espacio=e->>'clave';
    if destino is null then
      destino:=gen_random_uuid();
      insert into public.asignaturas(id,plan_estudio_id,estructura_id,codigo,nombre,tipo,numero_ciclo,
        linea_plan_id,orden_celda,datos,contenido_tematico,tipo_origen,meta_origen,
        horas_academicas,horas_independientes,estado,criterios_de_evaluacion,instalacion,
        creado_por,actualizado_por,area_comun_incorporacion_id,area_comun_origen_id,area_comun_espacio)
      values(destino,i.plan_id,(a->>'estructura_id')::uuid,a->>'codigo',a->>'nombre',(a->>'tipo')::public.tipo_asignatura,
        (e->>'numero_ciclo')::integer,i.linea_id,coalesce((e->>'orden')::integer,0),a->'datos',a->'contenido_tematico',
        'MANUAL',jsonb_build_object('area_comun',true,'plan_origen_id',p_contenido->>'plan_id','publicacion_id',i.publicacion_id),
        (a->>'horas_academicas')::integer,(a->>'horas_independientes')::integer,(a->>'estado')::public.estado_asignatura,
        a->'criterios_de_evaluacion',(a->>'instalacion')::public.tipo_instalacion_asignatura,
        auth.uid(),auth.uid(),i.id,origen,e->>'clave');
    else
      update public.asignaturas set estructura_id=(a->>'estructura_id')::uuid,codigo=a->>'codigo',nombre=a->>'nombre',
        tipo=(a->>'tipo')::public.tipo_asignatura,numero_ciclo=(e->>'numero_ciclo')::integer,
        orden_celda=coalesce((e->>'orden')::integer,0),datos=a->'datos',contenido_tematico=a->'contenido_tematico',
        horas_academicas=(a->>'horas_academicas')::integer,horas_independientes=(a->>'horas_independientes')::integer,
        estado=(a->>'estado')::public.estado_asignatura,criterios_de_evaluacion=a->'criterios_de_evaluacion',
        instalacion=(a->>'instalacion')::public.tipo_instalacion_asignatura,area_comun_origen_id=origen,
        actualizado_por=auth.uid(),prerrequisito_asignatura_id=null,
        meta_origen=jsonb_build_object('area_comun',true,'plan_origen_id',p_contenido->>'plan_id','publicacion_id',i.publicacion_id)
      where id=destino;
    end if;
    delete from public.bibliografia_asignatura where asignatura_id=destino;
    for b in select value from jsonb_array_elements(coalesce(p_contenido->'bibliografia','[]'::jsonb))
      where value->>'asignatura_id'=origen::text loop
      insert into public.bibliografia_asignatura(asignatura_id,tipo,cita,creado_por,referencia_biblioteca,
        referencia_en_linea,titulo,autores,editorial,anio,isbn,formato)
      values(destino,(b->>'tipo')::public.tipo_bibliografia,b->>'cita',auth.uid(),
        (b->>'referencia_biblioteca')::boolean,(b->>'referencia_en_linea')::boolean,
        b->>'titulo',b->'autores',b->>'editorial',(b->>'anio')::integer,b->>'isbn',b->>'formato');
    end loop;
  end loop;
  -- No descartar relaciones académicas de otras materias silenciosamente.
  if exists(select 1 from public.asignaturas a join public.asignaturas r on r.prerrequisito_asignatura_id=a.id
    where a.area_comun_incorporacion_id=i.id and not(a.area_comun_espacio=any(espacios))
      and r.area_comun_incorporacion_id is distinct from i.id) then
    raise exception 'Una materia retirada es prerrequisito de otra asignatura; define su sustitución' using errcode='23514';
  end if;
  update public.asignaturas set prerrequisito_asignatura_id=null where area_comun_incorporacion_id=i.id;
  delete from public.asignaturas where area_comun_incorporacion_id=i.id and not(area_comun_espacio=any(espacios));
  for a in select value from jsonb_array_elements(p_contenido->'asignaturas')
    where nullif(value->>'prerrequisito_asignatura_id','') is not null loop
    select id into destino from public.asignaturas where area_comun_incorporacion_id=i.id and area_comun_origen_id=(a->>'id')::uuid;
    if destino is not null then
      select id into prereq from public.asignaturas where area_comun_incorporacion_id=i.id
        and area_comun_origen_id=(a->>'prerrequisito_asignatura_id')::uuid;
      if prereq is null then raise exception 'Prerrequisito no resuelto para %',a->>'nombre' using errcode='23514'; end if;
      update public.asignaturas set prerrequisito_asignatura_id=prereq where id=destino;
    end if;
  end loop;
  update public.area_comun_incorporaciones set distribucion_clave=d->>'clave',actualizado_en=now() where id=i.id;
end $$;

create function public.area_comun_guardar_configuracion(p_plan_id uuid,p_revision integer,p_distribuciones jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare r integer; begin
  if not private.area_comun_gestor(auth.uid()) then raise exception 'No puedes gestionar Área común' using errcode='42501'; end if;
  if jsonb_typeof(p_distribuciones)<>'array' then raise exception 'Las distribuciones deben ser una lista' using errcode='23514'; end if;
  update public.area_comun_configuracion set borrador=p_distribuciones,revision=revision+1,actualizado_en=now()
    where plan_id=p_plan_id and revision=p_revision returning revision into r;
  if r is null then raise exception 'La configuración cambió; recarga antes de guardar' using errcode='40001'; end if;
  return r;
end $$;

create function public.area_comun_publicar(p_plan_id uuid,p_revision integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.area_comun_configuracion; contenido jsonb; d jsonb; e jsonb; ids jsonb;
  pub uuid; i record; begin
  if not private.area_comun_gestor(auth.uid(),true) then raise exception 'No puedes publicar Área común' using errcode='42501'; end if;
  select * into c from public.area_comun_configuracion where plan_id=p_plan_id for update;
  if c.plan_id is null or c.revision<>p_revision then raise exception 'La configuración cambió; recarga antes de publicar' using errcode='40001'; end if;
  if jsonb_array_length(c.borrador)=0 then raise exception 'Configura al menos una distribución' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(c.borrador) d group by d->>'clave' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(c.borrador) d
      group by d->>'tipo_ciclo',d->>'numero_ciclos',coalesce(d->>'carrera_id','') having count(*)>1) then
    raise exception 'Hay distribuciones duplicadas' using errcode='23514';
  end if;
  for d in select value from jsonb_array_elements(c.borrador) loop
    if nullif(d->>'clave','') is null or (d->>'tipo_ciclo') not in ('Semestre','Cuatrimestre','Trimestre','Otro')
      or coalesce((d->>'numero_ciclos')::integer,0)<1 or jsonb_typeof(d->'espacios') is distinct from 'array'
      or jsonb_array_length(d->'espacios')=0 then raise exception 'Distribución incompleta' using errcode='23514'; end if;
    if nullif(d->>'carrera_id','') is not null and not exists(select 1 from public.carreras where id=(d->>'carrera_id')::uuid) then
      raise exception 'Carrera de distribución no encontrada' using errcode='23514'; end if;
    if exists(select 1 from jsonb_array_elements(d->'espacios') x group by x->>'clave' having count(*)>1) then
      raise exception 'Hay espacios duplicados' using errcode='23514'; end if;
    for e in select value from jsonb_array_elements(d->'espacios') loop
      if nullif(e->>'clave','') is null or coalesce((e->>'numero_ciclo')::integer,0)<1
        or (e->>'numero_ciclo')::integer>(d->>'numero_ciclos')::integer
        or ((e ? 'asignatura_id') = (e ? 'opciones')) then raise exception 'Espacio curricular inválido' using errcode='23514'; end if;
      ids:=case when e ? 'asignatura_id' then jsonb_build_array(e->>'asignatura_id') else e->'opciones' end;
      if jsonb_typeof(ids) is distinct from 'array' or jsonb_array_length(ids)=0 then raise exception 'La electiva no tiene opciones' using errcode='23514'; end if;
      if exists(select 1 from jsonb_array_elements_text(ids) x where not exists(select 1 from public.asignaturas a
        where a.id=x::uuid and a.plan_estudio_id=p_plan_id and a.estado not in ('archivada','generando','fallida'))) then
        raise exception 'Una asignatura no existe, está archivada o no está lista para publicar' using errcode='23514'; end if;
    end loop;
  end loop;
  -- Bloquear duplicación de materias y prerrequisitos incompletos también sin incorporaciones.
  for d in select value from jsonb_array_elements(c.borrador) loop
    if exists(select 1 from jsonb_array_elements(d->'espacios') e
      cross join lateral jsonb_array_elements_text(case when e ? 'asignatura_id'
        then jsonb_build_array(e->>'asignatura_id') else e->'opciones' end) x
      group by x having count(*)>1) then raise exception 'Una materia aparece en varios espacios' using errcode='23514'; end if;
    if exists(select 1 from jsonb_array_elements(d->'espacios') e
      cross join lateral jsonb_array_elements_text(case when e ? 'asignatura_id' then jsonb_build_array(e->>'asignatura_id') else e->'opciones' end) x
      join public.asignaturas a on a.id=x::uuid
      where a.prerrequisito_asignatura_id is not null and not exists(
        select 1 from jsonb_array_elements(d->'espacios') p
        where p->>'asignatura_id'=a.prerrequisito_asignatura_id::text
          and (p->>'numero_ciclo')::integer<(e->>'numero_ciclo')::integer)) then
      raise exception 'Los prerrequisitos deben estar en un espacio fijo anterior' using errcode='23514'; end if;
  end loop;
  select jsonb_build_object('plan_id',p_plan_id,'distribuciones',c.borrador,
    'asignaturas',coalesce((select jsonb_agg(to_jsonb(a)) from public.asignaturas a where a.plan_estudio_id=p_plan_id),'[]'::jsonb),
    'bibliografia',coalesce((select jsonb_agg(to_jsonb(b)) from public.bibliografia_asignatura b
      join public.asignaturas a on a.id=b.asignatura_id where a.plan_estudio_id=p_plan_id),'[]'::jsonb)) into contenido;
  insert into public.area_comun_publicaciones(plan_id,numero,contenido,publicado_por)
  values(p_plan_id,coalesce((select max(numero)+1 from public.area_comun_publicaciones where plan_id=p_plan_id),1),contenido,auth.uid()) returning id into pub;
  insert into private.area_comun_operaciones values(txid_current(),pg_backend_pid()) on conflict do nothing;
  for i in select id,plan_id from public.area_comun_incorporaciones order by plan_id for update loop
    update public.area_comun_incorporaciones set publicacion_id=pub where id=i.id;
    perform private.area_comun_materializar(i.id,contenido);
    insert into public.area_comun_historial(plan_id,accion,detalle,usuario_id)
    values(i.plan_id,'PUBLICACION',jsonb_build_object('publicacion_id',pub),auth.uid());
  end loop;
  update public.area_comun_configuracion set publicacion_id=pub,revision=revision+1,actualizado_en=now() where plan_id=p_plan_id;
  insert into public.area_comun_historial(plan_id,accion,detalle,usuario_id)
    values(p_plan_id,'PUBLICACION',jsonb_build_object('publicacion_id',pub),auth.uid());
  delete from private.area_comun_operaciones where transaccion=txid_current();
  return pub;
end $$;

create function public.area_comun_incorporar(p_plan_id uuid,p_electivas jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.area_comun_configuracion; pub public.area_comun_publicaciones;
  d jsonb; i uuid; l uuid; begin
  -- Mismo orden de bloqueo que publicar: configuración -> plan -> incorporación.
  select * into c from public.area_comun_configuracion for share;
  perform 1 from public.planes_estudio where id=p_plan_id and categoria='CARRERA' for update;
  if not found or not public.authz_plan_write_allowed(p_plan_id) then raise exception 'No puedes incorporar la línea en este plan' using errcode='42501'; end if;
  select * into pub from public.area_comun_publicaciones where id=c.publicacion_id;
  if pub.id is null then raise exception 'Área común aún no tiene una publicación' using errcode='23514'; end if;
  d:=private.area_comun_distribucion(pub.contenido->'distribuciones',p_plan_id);
  if d is null then raise exception 'Área común no ha publicado una distribución compatible con este plan' using errcode='23514'; end if;
  if jsonb_typeof(p_electivas) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_electivas) k
    where not exists(select 1 from jsonb_array_elements(d->'espacios') e where e->>'clave'=k and e ? 'opciones')) then
    raise exception 'La selección contiene espacios electivos desconocidos' using errcode='23514'; end if;
  insert into private.area_comun_operaciones values(txid_current(),pg_backend_pid()) on conflict do nothing;
  select id into i from public.area_comun_incorporaciones where plan_id=p_plan_id for update;
  if i is null then
    insert into public.lineas_plan(plan_estudio_id,nombre,area,orden,creado_por)
      values(p_plan_id,'Área curricular común básica','Área común',
        coalesce((select max(orden)+1 from public.lineas_plan where plan_estudio_id=p_plan_id),0),auth.uid()) returning id into l;
    insert into public.area_comun_incorporaciones(plan_id,publicacion_id,distribucion_clave,electivas,linea_id,creado_por)
      values(p_plan_id,pub.id,d->>'clave',p_electivas,l,auth.uid()) returning id into i;
  else
    update public.area_comun_incorporaciones set electivas=p_electivas,publicacion_id=pub.id where id=i;
  end if;
  perform private.area_comun_materializar(i,pub.contenido);
  insert into public.area_comun_historial(plan_id,accion,detalle,usuario_id)
    values(p_plan_id,'INCORPORACION_O_ELECTIVAS',jsonb_build_object('electivas',p_electivas,'publicacion_id',pub.id),auth.uid());
  delete from private.area_comun_operaciones where transaccion=txid_current();
  return i;
end $$;

create function public.area_comun_retirar(p_plan_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.area_comun_incorporaciones; begin
  perform 1 from public.area_comun_configuracion for share;
  perform 1 from public.planes_estudio where id=p_plan_id for update;
  if not public.authz_plan_write_allowed(p_plan_id) then raise exception 'No puedes retirar la línea' using errcode='42501'; end if;
  select * into i from public.area_comun_incorporaciones where plan_id=p_plan_id for update;
  if i.id is null then return; end if;
  if exists(select 1 from public.asignaturas r join public.asignaturas a on a.id=r.prerrequisito_asignatura_id
    where a.area_comun_incorporacion_id=i.id and r.area_comun_incorporacion_id is distinct from i.id) then
    raise exception 'Hay materias del plan que requieren asignaturas comunes; resuelve sus prerrequisitos antes de retirar la línea' using errcode='23514'; end if;
  insert into private.area_comun_operaciones values(txid_current(),pg_backend_pid()) on conflict do nothing;
  update public.asignaturas set prerrequisito_asignatura_id=null where area_comun_incorporacion_id=i.id;
  delete from public.asignaturas where area_comun_incorporacion_id=i.id;
  delete from public.area_comun_incorporaciones where id=i.id;
  delete from public.lineas_plan where id=i.linea_id;
  insert into public.area_comun_historial(plan_id,accion,usuario_id) values(p_plan_id,'RETIRO',auth.uid());
  delete from private.area_comun_operaciones where transaccion=txid_current();
end $$;

-- Lectura estrecha: catálogo publicado para previsualizar, sin borradores ni otros planes.
create function public.area_comun_contexto(p_plan_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.area_comun_configuracion; p public.planes_estudio; pub public.area_comun_publicaciones; begin
  if not public.authz_can_access_plan(p_plan_id) then raise exception 'No puedes consultar este plan' using errcode='42501'; end if;
  select * into p from public.planes_estudio where id=p_plan_id;
  select * into c from public.area_comun_configuracion;
  select * into pub from public.area_comun_publicaciones where id=c.publicacion_id;
  return jsonb_build_object('plan_area_id',c.plan_id,'revision',c.revision,'publicacion_id',pub.id,
    'numero_publicacion',pub.numero,'contenido',pub.contenido,
    'distribucion',private.area_comun_distribucion(pub.contenido->'distribuciones',p_plan_id),
    'incorporacion',(select to_jsonb(i) from public.area_comun_incorporaciones i where i.plan_id=p_plan_id),
    'borrador',case when p.categoria='AREA_COMUN' and private.area_comun_gestor(auth.uid()) then c.borrador else null end,
    'planes_usuarios',case when p.categoria='AREA_COMUN' and private.area_comun_gestor(auth.uid()) then
      coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.nombre_display))
        from public.area_comun_incorporaciones i join public.planes_estudio r on r.id=i.plan_id),'[]'::jsonb) else '[]'::jsonb end);
end $$;

alter table public.area_comun_publicaciones enable row level security;
alter table public.area_comun_configuracion enable row level security;
alter table public.area_comun_incorporaciones enable row level security;
alter table public.area_comun_historial enable row level security;
create policy area_comun_publicaciones_select on public.area_comun_publicaciones for select to authenticated
using(private.area_comun_gestor(auth.uid()));
create policy area_comun_configuracion_select on public.area_comun_configuracion for select to authenticated
using(private.area_comun_gestor(auth.uid()));
create policy area_comun_incorporaciones_select on public.area_comun_incorporaciones for select to authenticated
using(public.authz_can_access_plan(plan_id));
create policy area_comun_historial_select on public.area_comun_historial for select to authenticated
using(public.authz_can_access_plan(plan_id));
grant select on public.area_comun_publicaciones,public.area_comun_configuracion,
  public.area_comun_incorporaciones,public.area_comun_historial to authenticated;
do $$ declare f regprocedure; begin
  for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname like 'area_comun_%' loop
    execute format('revoke all on function %s from public,anon',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
  for f in select oid::regprocedure from pg_proc where pronamespace='private'::regnamespace and
    (proname like 'area_comun_%' or proname like '%_sin_area_comun') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
  end loop;
end $$;
grant execute on function private.area_comun_gestor(uuid,boolean) to authenticated;

-- Configuración recibe eventos únicamente para gestores; receptores observan sus propias incorporaciones.
alter publication supabase_realtime add table public.area_comun_configuracion,public.area_comun_incorporaciones;

-- Seed determinista, aislado de estructuras y carreras existentes.
insert into private.area_comun_operaciones values(txid_current(),pg_backend_pid());
insert into public.estructuras_plan(id,nombre,tipo,definicion)
values('ac000000-0000-4000-8000-000000000001','Área curricular común básica','CURRICULAR',
  '{"type":"object","properties":{}}') on conflict(id) do nothing;
insert into public.estructuras_asignatura(id,nombre,tipo,estructura_plan_id,definicion)
values('ac000000-0000-4000-8000-000000000002','Programa de Área común','CURRICULAR',
  'ac000000-0000-4000-8000-000000000001',
  '{"type":"object","properties":{"fines_de_aprendizaje":{"type":"string","title":"Fines de aprendizaje"},"actividades_de_aprendizaje":{"type":"string","title":"Actividades de aprendizaje"}}}') on conflict(id) do nothing;
insert into public.planes_estudio(id,categoria,carrera_id,estructura_id,nombre,nombre_display,tipo_ciclo,numero_ciclos,estado_actual_id,tipo_origen)
values('ac000000-0000-4000-8000-000000000003','AREA_COMUN',null,'ac000000-0000-4000-8000-000000000001',
  'Área curricular común básica','Área curricular común básica','Semestre',8,
  (select id from public.estados_plan where clave='BORRADOR' order by orden limit 1),'MANUAL') on conflict(id) do nothing;
insert into public.lineas_plan(id,plan_estudio_id,nombre,area)
values('ac000000-0000-4000-8000-000000000004','ac000000-0000-4000-8000-000000000003',
  'Área curricular común básica','Área común') on conflict(id) do nothing;
insert into public.asignaturas(id,plan_estudio_id,estructura_id,codigo,nombre,tipo,numero_ciclo,linea_plan_id,
  orden_celda,horas_academicas,tipo_origen,meta_origen)
select ('ac000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'ac000000-0000-4000-8000-000000000003','ac000000-0000-4000-8000-000000000002',
  'ACC'||lpad((n-100)::text,2,'0'),nombre,case when n>=112 then 'OPTATIVA' else 'OBLIGATORIA' end::public.tipo_asignatura,
  ciclo,'ac000000-0000-4000-8000-000000000004',n,horas,'MANUAL',
  jsonb_build_object('referencia','Área curricular común 2013','bloque',bloque,'contenido_pendiente',true)
from (values
  (101,'Procesos y Expresión del Pensamiento',1,48,'Pensamiento y Comunicación'),
  (102,'Creatividad y Comunicación',2,48,'Pensamiento y Comunicación'),
  (103,'Lengua Extranjera I',3,72,'Lengua Extranjera'),
  (104,'Lengua Extranjera II',4,72,'Lengua Extranjera'),
  (105,'La Persona y su Interacción con los otros',3,24,'Humanismo Sociedad'),
  (106,'Diálogo Intercultural',4,24,'Humanismo Sociedad'),
  (107,'Fe y Desarrollo Espiritual',5,24,'Humanismo Sociedad'),
  (108,'Emprendimiento Sustentabilidad',6,48,'Emprendimiento Sostenibilidad'),
  (109,'Taller de Empleo, Autoempleo y actividad empresarial',7,48,'Emprendimiento Sostenibilidad'),
  (110,'Valores y Ética Profesional',7,48,'Humanismo Sociedad'),
  (111,'Taller de Proyecto Profesional Ocupacional',8,48,'Emprendimiento Sostenibilidad'),
  (112,'Fe Religiosa y Mundo Actual',6,24,'Humanismo Sociedad'),
  (113,'El Fenómeno Religioso',6,24,'Humanismo Sociedad'),
  (114,'Mensaje Liberador de Jesús',6,24,'Humanismo Sociedad'),
  (115,'Seminario de Bioética',8,48,'Humanismo Sociedad'),
  (116,'STRS desde las Ciencias Sociales y Humanidades',8,48,'Humanismo Sociedad'),
  (117,'STRS desde las Ciencias Económico Administrativas',8,48,'Humanismo Sociedad'),
  (118,'STRS desde las Ciencias de la Vida',8,48,'Humanismo Sociedad'),
  (119,'STRS desde la Ciencia y la Tecnología',8,48,'Humanismo Sociedad'),
  (120,'STRS desde las Artes y el Diseño',8,48,'Humanismo Sociedad')
) s(n,nombre,ciclo,horas,bloque) on conflict(id) do nothing;
update public.asignaturas set prerrequisito_asignatura_id='ac000000-0000-4000-8000-000000000103'
where id='ac000000-0000-4000-8000-000000000104' and prerrequisito_asignatura_id is null;
insert into public.area_comun_configuracion(plan_id,borrador)
select 'ac000000-0000-4000-8000-000000000003',jsonb_build_array(jsonb_build_object(
  'clave','semestral-8','tipo_ciclo','Semestre','numero_ciclos',8,'carrera_id',null,
  'nota','Pendiente configurar: Filosofía (Fenómeno Religioso y Cosmovisiones Religiosas); carreras de salud (Seminario de Bioética).',
  'espacios',(select jsonb_agg(x order by ciclo,orden) from (
    select jsonb_build_object('clave',codigo,'numero_ciclo',numero_ciclo,'orden',orden_celda,'asignatura_id',id) x,
      numero_ciclo ciclo,orden_celda orden from public.asignaturas
      where plan_estudio_id='ac000000-0000-4000-8000-000000000003' and tipo='OBLIGATORIA'
    union all select jsonb_build_object('clave','electiva-1','numero_ciclo',6,'orden',2,'nombre','Obligatoria Electiva I',
      'opciones',jsonb_build_array('ac000000-0000-4000-8000-000000000112','ac000000-0000-4000-8000-000000000113','ac000000-0000-4000-8000-000000000114')),6,2
    union all select jsonb_build_object('clave','electiva-2','numero_ciclo',8,'orden',2,'nombre','Obligatoria Electiva II',
      'opciones',jsonb_build_array('ac000000-0000-4000-8000-000000000115','ac000000-0000-4000-8000-000000000116','ac000000-0000-4000-8000-000000000117','ac000000-0000-4000-8000-000000000118','ac000000-0000-4000-8000-000000000119','ac000000-0000-4000-8000-000000000120')),8,2
  ) q))) on conflict(plan_id) do nothing;
delete from private.area_comun_operaciones where transaccion=txid_current();
