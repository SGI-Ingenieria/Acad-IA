-- Área común: permitir la distribución semestral de 8 ciclos en planes de 9
-- y preparar autorización de encargados limitada a su bloque.

create table public.area_comun_bloques (
  clave text primary key,
  nombre text not null,
  color text not null,
  asignaturas_referencia integer not null check (asignaturas_referencia > 0),
  horas_referencia integer not null check (horas_referencia > 0),
  orden integer not null unique
);

insert into public.area_comun_bloques(clave,nombre,color,asignaturas_referencia,horas_referencia,orden)
values
  ('PENSAMIENTO_COMUNICACION','Pensamiento y Comunicación','#5798c9',2,96,1),
  ('HUMANISMO_SOCIEDAD','Humanismo Sociedad','#152c72',6,192,2),
  ('LENGUA_EXTRANJERA','Lengua Extranjera','#f43b1c',2,144,3),
  ('EMPRENDIMIENTO_SUSTENTABILIDAD','Emprendimiento Sustentabilidad','#8d110b',3,144,4)
on conflict(clave) do update set nombre=excluded.nombre,color=excluded.color,
  asignaturas_referencia=excluded.asignaturas_referencia,horas_referencia=excluded.horas_referencia,
  orden=excluded.orden;

create table public.area_comun_encargados_bloque (
  usuario_id uuid not null references public.usuarios_app(id) on delete cascade,
  asignacion_id uuid not null unique references public.usuarios_roles(id) on delete cascade,
  bloque_clave text not null references public.area_comun_bloques(clave) on delete restrict,
  asignado_por uuid references public.usuarios_app(id),
  asignado_en timestamptz not null default now(),
  primary key(usuario_id,bloque_clave)
);
alter table public.area_comun_bloques enable row level security;
alter table public.area_comun_encargados_bloque enable row level security;
create policy area_comun_bloques_select on public.area_comun_bloques for select to authenticated using(true);
create policy area_comun_encargados_select on public.area_comun_encargados_bloque for select to authenticated
  using(usuario_id=auth.uid() or private.area_comun_gestor(auth.uid()));
grant select on public.area_comun_bloques,public.area_comun_encargados_bloque to authenticated;

insert into public.permisos(clave,nombre,grupo)
values ('area_comun.bloque.editar','Editar asignaturas del bloque asignado','area_comun')
on conflict(clave) do nothing;

alter table public.roles drop constraint roles_alcance_default_chk;
alter table public.roles add constraint roles_alcance_default_chk check
  (alcance_default in ('global','facultad','carrera','asignatura','externo','area_comun','area_comun_bloque'));

insert into public.roles(clave,nombre,descripcion,alcance_default)
values ('ENCARGADO_BLOQUE','Encargado de bloque','Edición de asignaturas de un bloque de Área común','area_comun_bloque')
on conflict(clave) do update set nombre=excluded.nombre,descripcion=excluded.descripcion,
  alcance_default=excluded.alcance_default;
insert into public.roles_permisos(rol_id,permiso_id)
select r.id,p.id from public.roles r join public.permisos p on p.clave in
  ('area_comun.bloque.editar','planes.ver','asignaturas.ver','asignaturas.editar','ia.usar','archivos.ver','archivos.gestionar')
where r.clave='ENCARGADO_BLOQUE'
on conflict do nothing;

create or replace function private.area_comun_encargado(p_usuario uuid,p_bloque text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_usuario is not null and p_bloque is not null and (
    exists(select 1 from public.area_comun_encargados_bloque e
      join public.usuarios_roles ur on ur.id=e.asignacion_id and ur.usuario_id=e.usuario_id
      join public.roles r on r.id=ur.rol_id
      where e.usuario_id=p_usuario and e.bloque_clave=p_bloque and r.clave='ENCARGADO_BLOQUE')
    or (p_usuario=auth.uid()
      and public.authz_has_permission('area_comun.bloque.editar')
      and auth.jwt() #>> '{app_metadata,authz_simulacion,rol_clave}'='ENCARGADO_BLOQUE'
      and auth.jwt() #>> '{app_metadata,authz_simulacion,bloque_clave}'=p_bloque)
  );
$$;

create or replace function private.area_comun_tiene_encargo(p_usuario uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.area_comun_encargados_bloque e
    join public.usuarios_roles ur on ur.id=e.asignacion_id and ur.usuario_id=e.usuario_id
    join public.roles r on r.id=ur.rol_id
    where e.usuario_id=p_usuario and r.clave='ENCARGADO_BLOQUE')
    or (p_usuario=auth.uid() and public.authz_has_permission('area_comun.bloque.editar')
      and auth.jwt() #>> '{app_metadata,authz_simulacion,rol_clave}'='ENCARGADO_BLOQUE'
      and nullif(auth.jwt() #>> '{app_metadata,authz_simulacion,bloque_clave}','') is not null);
$$;

create or replace function private.area_comun_bloque_clave(p_bloque text)
returns text language sql immutable set search_path = '' as $$
  select case p_bloque
    when 'Pensamiento y Comunicación' then 'PENSAMIENTO_COMUNICACION'
    when 'Humanismo Sociedad' then 'HUMANISMO_SOCIEDAD'
    when 'Lengua Extranjera' then 'LENGUA_EXTRANJERA'
    when 'Emprendimiento Sostenibilidad' then 'EMPRENDIMIENTO_SUSTENTABILIDAD'
    when 'Emprendimiento Sustentabilidad' then 'EMPRENDIMIENTO_SUSTENTABILIDAD'
    else null end;
$$;

create or replace function public.asignar_encargado_area_comun(
  p_usuario_id uuid,p_bloque_clave text,p_asignado_por uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_rol uuid; v_asignacion uuid; begin
  if not exists(select 1 from public.area_comun_bloques where clave=p_bloque_clave) then
    raise exception 'Bloque de Área común inválido' using errcode='23514';
  end if;
  select id into v_rol from public.roles where clave='ENCARGADO_BLOQUE';
  if v_rol is null then raise exception 'Rol Encargado de bloque no disponible' using errcode='23514'; end if;
  select ur.id into v_asignacion from public.area_comun_encargados_bloque e
    join public.usuarios_roles ur on ur.id=e.asignacion_id
    where e.usuario_id=p_usuario_id and e.bloque_clave=p_bloque_clave;
  if v_asignacion is null then
    insert into public.usuarios_roles(usuario_id,rol_id,asignado_por)
      values(p_usuario_id,v_rol,p_asignado_por) returning id into v_asignacion;
    insert into public.area_comun_encargados_bloque(usuario_id,asignacion_id,bloque_clave,asignado_por)
      values(p_usuario_id,v_asignacion,p_bloque_clave,p_asignado_por);
  end if;
  return v_asignacion;
end $$;
revoke all on function public.asignar_encargado_area_comun(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.asignar_encargado_area_comun(uuid,text,uuid) to service_role;

-- Incluir el bloque en las asignaciones de rol del JWT para edición contextual.
do $$ declare d text; begin
  select pg_get_functiondef(oid) into d from pg_proc
    where pronamespace='public'::regnamespace and proname='custom_access_token_hook';
  d:=replace(d,'''carrera_id'', ur.carrera_id',
    '''carrera_id'', ur.carrera_id, ''bloque_clave'', eb.bloque_clave');
  d:=replace(d,'join public.usuarios_app ua on ua.id = ur.usuario_id',
    'join public.usuarios_app ua on ua.id = ur.usuario_id left join public.area_comun_encargados_bloque eb on eb.asignacion_id = ur.id');
  if position('''bloque_clave'', eb.bloque_clave' in d)=0
    or position('left join public.area_comun_encargados_bloque eb' in d)=0 then
    raise exception 'No se pudo extender custom_access_token_hook con el bloque';
  end if;
  execute d;
end $$;

create or replace function private.area_comun_distribucion(p_config jsonb,p_plan uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select d from public.planes_estudio p
  join public.estructuras_plan ep on ep.id=p.estructura_id
  cross join jsonb_array_elements(p_config) d
  where p.id=p_plan and ep.tipo='CURRICULAR' and d->>'tipo_ciclo'=p.tipo_ciclo::text
    and (d->>'numero_ciclos')::integer in (p.numero_ciclos,
      case when p.tipo_ciclo='Semestre' and p.numero_ciclos=9 then 8 end)
    and (nullif(d->>'carrera_id','') is null or d->>'carrera_id'=p.carrera_id::text)
  order by ((d->>'numero_ciclos')::integer=p.numero_ciclos) desc,
    (nullif(d->>'carrera_id','') is not null) desc limit 1;
$$;

create or replace function private.usuario_puede_acceder_plan(p_usuario_id uuid,p_plan_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p.categoria='AREA_COMUN'
    then private.area_comun_gestor(p_usuario_id) or private.area_comun_tiene_encargo(p_usuario_id)
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
  select a.area_comun_incorporacion_id is null and case when p.categoria='AREA_COMUN'
    then private.area_comun_gestor(p_usuario_id)
      or private.area_comun_encargado(p_usuario_id,private.area_comun_bloque_clave(a.meta_origen->>'bloque'))
    else private.usuario_puede_editar_asignatura_sin_area_comun(p_usuario_id,p_asignatura_id) end
  from public.asignaturas a join public.planes_estudio p on p.id=a.plan_estudio_id
  where a.id=p_asignatura_id;
$$;

create or replace function private.usuario_puede_usar_ia_asignatura(p_usuario_id uuid,p_asignatura_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a.area_comun_incorporacion_id is null and case when p.categoria='AREA_COMUN'
    then private.area_comun_gestor(p_usuario_id)
      or private.area_comun_encargado(p_usuario_id,private.area_comun_bloque_clave(a.meta_origen->>'bloque'))
    else private.usuario_puede_usar_ia_asignatura_sin_area_comun(p_usuario_id,p_asignatura_id) end
  from public.asignaturas a join public.planes_estudio p on p.id=a.plan_estudio_id
  where a.id=p_asignatura_id;
$$;

create or replace function private.proteger_area_comun() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_plan uuid; v_bloque text; v_es_encargado boolean:=false; begin
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
    if tg_op='UPDATE' and old.asignatura_id is distinct from new.asignatura_id then
      raise exception 'No puedes mover una relación entre asignaturas' using errcode='42501';
    end if;
    select a.plan_estudio_id into v_plan from public.asignaturas a where a.id=v_id;
    if exists(select 1 from public.asignaturas where id=v_id and area_comun_incorporacion_id is not null) then
      raise exception 'El contenido vinculado es de solo lectura' using errcode='42501';
    end if;
  end if;

  if v_plan is not null and exists(select 1 from public.planes_estudio where id=v_plan and categoria='AREA_COMUN')
    and auth.uid() is not null and not private.area_comun_gestor(auth.uid()) then
    if tg_table_name='asignaturas' and tg_op='UPDATE' then
      v_bloque:=private.area_comun_bloque_clave(old.meta_origen->>'bloque');
      v_es_encargado:=private.area_comun_encargado(auth.uid(),v_bloque);
      if v_es_encargado and new.plan_estudio_id=old.plan_estudio_id
        and new.estructura_id is not distinct from old.estructura_id
        and new.tipo is not distinct from old.tipo
        and new.numero_ciclo is not distinct from old.numero_ciclo
        and new.linea_plan_id is not distinct from old.linea_plan_id
        and new.orden_celda is not distinct from old.orden_celda
        and new.prerrequisito_asignatura_id is not distinct from old.prerrequisito_asignatura_id
        and new.meta_origen is not distinct from old.meta_origen
        and new.tipo_origen is not distinct from old.tipo_origen then
        return new;
      end if;
    elsif tg_table_name<>'asignaturas' then
      select private.area_comun_encargado(auth.uid(),private.area_comun_bloque_clave(a.meta_origen->>'bloque'))
        into v_es_encargado from public.asignaturas a where a.id=v_id;
      if v_es_encargado then
        if tg_op='DELETE' then return old; else return new; end if;
      end if;
    end if;
    raise exception 'Solo el encargado del bloque correspondiente puede editar esta materia' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

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
  select private.area_comun_operacion() or (a.area_comun_incorporacion_id is null and (
    public.usuario_puede_editar_asignatura(auth.uid(),a.id) or
    case when p.categoria='AREA_COMUN' then private.area_comun_gestor(auth.uid())
      else private.authz_asignatura_responsable_editor(a.id) end))
  from public.asignaturas a join public.planes_estudio p on p.id=a.plan_estudio_id
  where a.id=p_asignatura_id;
$$;

grant execute on function private.area_comun_encargado(uuid,text),private.area_comun_tiene_encargo(uuid),
  private.area_comun_bloque_clave(text) to authenticated;

drop policy if exists planes_estudio_area_comun_select on public.planes_estudio;
create policy planes_estudio_area_comun_select on public.planes_estudio
for select to authenticated using (
  categoria='AREA_COMUN'
  and (private.area_comun_gestor(auth.uid()) or private.area_comun_tiene_encargo(auth.uid()))
);
