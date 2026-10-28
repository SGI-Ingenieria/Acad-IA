-- Grupos propios del plan: una posición curricular, varias alternativas, una carga.
create table public.grupos_electivos_plan (
  id uuid primary key default gen_random_uuid(),
  plan_estudio_id uuid not null references public.planes_estudio(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 160),
  numero_ciclo integer not null check (numero_ciclo > 0),
  linea_plan_id uuid not null references public.lineas_plan(id) on delete restrict,
  orden integer not null default 0,
  prerrequisito_grupo_id uuid references public.grupos_electivos_plan(id) on delete restrict,
  revision integer not null default 1,
  creado_por uuid references public.usuarios_app(id),
  actualizado_en timestamptz not null default now(),
  check (prerrequisito_grupo_id is distinct from id)
);
create index grupos_electivos_plan_plan_idx on public.grupos_electivos_plan(plan_estudio_id);
alter table public.asignaturas add column grupo_electivo_id uuid references public.grupos_electivos_plan(id) on delete set null;
create index asignaturas_grupo_electivo_idx on public.asignaturas(grupo_electivo_id) where grupo_electivo_id is not null;
alter table public.grupos_electivos_plan enable row level security;
create policy grupos_electivos_lectura on public.grupos_electivos_plan for select to authenticated
using(public.authz_can_access_plan(plan_estudio_id));
grant select on public.grupos_electivos_plan to authenticated;
revoke insert,update,delete on public.grupos_electivos_plan from authenticated,anon;

-- La pertenencia y los movimientos solo se escriben mediante operaciones atómicas.
create table private.grupos_electivos_operaciones (
  transaccion bigint not null, proceso integer not null, primary key(transaccion,proceso)
);
revoke all on private.grupos_electivos_operaciones from public,anon,authenticated,service_role;
create function private.grupos_electivos_operacion() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.grupos_electivos_operaciones where transaccion=txid_current() and proceso=pg_backend_pid());
$$;
revoke all on function private.grupos_electivos_operacion() from public,anon,authenticated,service_role;

create function private.validar_grupo_electivo_plan() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.planes_estudio; previo public.grupos_electivos_plan;
begin
  if tg_op='DELETE' then return old; end if;
  select * into p from public.planes_estudio where id=new.plan_estudio_id;
  if not private.grupos_electivos_operacion() then
    raise exception 'Usa las operaciones de bloques electivos' using errcode='42501'; end if;
  if p.categoria='AREA_COMUN' or new.numero_ciclo>p.numero_ciclos
    or not exists(select 1 from public.lineas_plan where id=new.linea_plan_id and plan_estudio_id=p.id)
    or exists(select 1 from public.area_comun_incorporaciones where linea_id=new.linea_plan_id) then
    raise exception 'El bloque necesita una línea propia y un ciclo válido del mismo plan' using errcode='23514'; end if;
  if new.prerrequisito_grupo_id is not null then
    select * into previo from public.grupos_electivos_plan where id=new.prerrequisito_grupo_id;
    if previo.id is null or previo.plan_estudio_id<>new.plan_estudio_id or previo.numero_ciclo>=new.numero_ciclo then
      raise exception 'El grupo antecedente debe pertenecer al mismo plan y a un ciclo anterior' using errcode='23514'; end if;
  end if;
  if exists(select 1 from public.grupos_electivos_plan where prerrequisito_grupo_id=new.id and numero_ciclo<=new.numero_ciclo) then
    raise exception 'El movimiento rompe la seriación con un bloque sucesor' using errcode='23514'; end if;
  new.actualizado_en:=clock_timestamp();
  return new;
end $$;
create trigger validar_grupo_electivo before insert or update on public.grupos_electivos_plan
for each row execute function private.validar_grupo_electivo_plan();
revoke all on function private.validar_grupo_electivo_plan() from public,anon,authenticated,service_role;

create function private.validar_alternativa_grupo_plan() returns trigger
language plpgsql security definer set search_path='' as $$
declare g public.grupos_electivos_plan;
begin
  if tg_op='UPDATE' and new.grupo_electivo_id is distinct from old.grupo_electivo_id
    and not private.grupos_electivos_operacion()
    and exists(select 1 from public.planes_estudio where id=new.plan_estudio_id) then
    raise exception 'Cambia la pertenencia desde el bloque electivo' using errcode='42501'; end if;
  if tg_op='INSERT' and new.grupo_electivo_id is not null and not private.grupos_electivos_operacion() then
    raise exception 'Incorpora la asignatura desde el bloque electivo' using errcode='42501'; end if;
  if new.grupo_electivo_id is not null then
    select * into g from public.grupos_electivos_plan where id=new.grupo_electivo_id for update;
    if g.plan_estudio_id<>new.plan_estudio_id or new.area_comun_origen_id is not null
      or new.numero_ciclo is distinct from g.numero_ciclo or new.linea_plan_id is distinct from g.linea_plan_id
      or new.prerrequisito_asignatura_id is not null or new.estado='archivada' then
      raise exception 'La alternativa debe conservar la ubicación del bloque y no tener seriación individual; retírala antes de archivarla' using errcode='23514'; end if;
    if exists(select 1 from public.asignaturas a where a.grupo_electivo_id=g.id and a.id<>new.id
      and (a.horas_academicas is distinct from new.horas_academicas or a.horas_independientes is distinct from new.horas_independientes)) then
      raise exception 'Las alternativas deben tener los mismos créditos y horas docentes e independientes' using errcode='23514'; end if;
    if exists(select 1 from public.asignaturas where prerrequisito_asignatura_id=new.id) then
      raise exception 'Retira las seriaciones individuales antes de incorporar la alternativa' using errcode='23514'; end if;
  end if;
  if new.prerrequisito_asignatura_id is not null and exists(select 1 from public.asignaturas
    where id=new.prerrequisito_asignatura_id and grupo_electivo_id is not null) then
    raise exception 'Las alternativas electivas se serian mediante sus bloques' using errcode='23514'; end if;
  return new;
end $$;
create trigger z_validar_alternativa_grupo before insert or update of grupo_electivo_id,plan_estudio_id,numero_ciclo,linea_plan_id,
  horas_academicas,horas_independientes,prerrequisito_asignatura_id,estado on public.asignaturas
for each row execute function private.validar_alternativa_grupo_plan();
revoke all on function private.validar_alternativa_grupo_plan() from public,anon,authenticated,service_role;

create function public.gestionar_grupo_electivo_plan(p_plan_id uuid,p_operacion text,p_grupo_id uuid,p_datos jsonb default '{}')
returns uuid language plpgsql security definer set search_path='' as $$
declare g public.grupos_electivos_plan; a public.asignaturas; v_id uuid:=p_grupo_id; anterior jsonb; p public.planes_estudio;
begin
  select * into p from public.planes_estudio where id=p_plan_id for update;
  if p.id is null or not public.authz_plan_write_allowed(p.id) or p.categoria='AREA_COMUN' then
    raise exception 'No puedes editar bloques electivos en este plan' using errcode='42501'; end if;
  if p_operacion not in ('crear','editar','mover','incorporar','retirar','eliminar') then
    raise exception 'Operación de bloque inválida' using errcode='23514'; end if;
  insert into private.grupos_electivos_operaciones values(txid_current(),pg_backend_pid()) on conflict do nothing;
  if p_operacion='crear' then
    insert into public.grupos_electivos_plan(id,plan_estudio_id,nombre,numero_ciclo,linea_plan_id,orden,creado_por)
    values(coalesce(p_grupo_id,gen_random_uuid()),p.id,btrim(p_datos->>'nombre'),(p_datos->>'numero_ciclo')::integer,
      (p_datos->>'linea_plan_id')::uuid,(select coalesce(max(orden),-1)+1 from public.grupos_electivos_plan where plan_estudio_id=p.id),auth.uid()) returning id into v_id;
  else
    select * into g from public.grupos_electivos_plan where id=p_grupo_id and plan_estudio_id=p.id for update;
    if g.id is null then raise exception 'Bloque no encontrado' using errcode='23514'; end if;
    if (p_datos->>'revision')::integer is distinct from g.revision then
      raise exception 'El bloque cambió; recarga y vuelve a intentarlo' using errcode='40001'; end if;
    anterior:=to_jsonb(g);
    if p_operacion in ('editar','mover') then
      update public.grupos_electivos_plan set
        nombre=case when p_datos ? 'nombre' then btrim(p_datos->>'nombre') else nombre end,
        numero_ciclo=coalesce((p_datos->>'numero_ciclo')::integer,numero_ciclo),
        linea_plan_id=coalesce((p_datos->>'linea_plan_id')::uuid,linea_plan_id),
        prerrequisito_grupo_id=case when p_datos ? 'prerrequisito_grupo_id' then nullif(p_datos->>'prerrequisito_grupo_id','')::uuid else prerrequisito_grupo_id end,
        revision=revision+1 where id=g.id returning * into g;
      update public.asignaturas set numero_ciclo=g.numero_ciclo,linea_plan_id=g.linea_plan_id,actualizado_por=auth.uid() where grupo_electivo_id=g.id;
    elsif p_operacion in ('incorporar','retirar') then
      select * into a from public.asignaturas where id=(p_datos->>'asignatura_id')::uuid and plan_estudio_id=p.id for update;
      if a.id is null or a.area_comun_origen_id is not null or a.estado in ('archivada','generando','fallida') then
        raise exception 'La asignatura no está disponible para este bloque' using errcode='23514'; end if;
      if p_operacion='retirar' and a.grupo_electivo_id is distinct from g.id then
        raise exception 'La asignatura ya no pertenece a este bloque' using errcode='40001'; end if;
      if p_operacion='incorporar' then
        if p_datos ? 'grupo_origen_esperado' and a.grupo_electivo_id is distinct from nullif(p_datos->>'grupo_origen_esperado','')::uuid then
          raise exception 'La pertenencia de la asignatura cambió; recarga antes de continuar' using errcode='40001'; end if;
        if p_datos ? 'relaciones_esperadas' and p_datos->'relaciones_esperadas' is distinct from (
          select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'prerrequisito_asignatura_id',r.prerrequisito_asignatura_id) order by r.id),'[]'::jsonb)
          from public.asignaturas r where (r.id=a.id and r.prerrequisito_asignatura_id is not null) or r.prerrequisito_asignatura_id=a.id
        ) then raise exception 'Las seriaciones cambiaron; revisa nuevamente las relaciones afectadas' using errcode='40001'; end if;
        if a.prerrequisito_asignatura_id is not null or exists(select 1 from public.asignaturas where prerrequisito_asignatura_id=a.id) then
          if not coalesce((p_datos->>'confirmar_retiro_relaciones')::boolean,false) then
            raise exception 'Confirma el retiro de las seriaciones individuales afectadas' using errcode='23514'; end if;
          update public.asignaturas set prerrequisito_asignatura_id=null,actualizado_por=auth.uid() where id=a.id or prerrequisito_asignatura_id=a.id;
        end if;
        update public.asignaturas set grupo_electivo_id=g.id,numero_ciclo=g.numero_ciclo,linea_plan_id=g.linea_plan_id,actualizado_por=auth.uid() where id=a.id;
      else
        update public.asignaturas set grupo_electivo_id=null,numero_ciclo=null,linea_plan_id=null,actualizado_por=auth.uid() where id=a.id;
      end if;
      update public.grupos_electivos_plan set revision=revision+1 where id in (g.id,a.grupo_electivo_id);
    else
      if (exists(select 1 from public.grupos_electivos_plan where prerrequisito_grupo_id=g.id) or g.prerrequisito_grupo_id is not null)
        and not coalesce((p_datos->>'confirmar_retiro_relaciones')::boolean,false) then
        raise exception 'Confirma el retiro de las dependencias del bloque' using errcode='23514'; end if;
      update public.grupos_electivos_plan set prerrequisito_grupo_id=null,revision=revision+1 where prerrequisito_grupo_id=g.id;
      update public.asignaturas set grupo_electivo_id=null,numero_ciclo=null,linea_plan_id=null,actualizado_por=auth.uid() where grupo_electivo_id=g.id;
      delete from public.grupos_electivos_plan where id=g.id;
    end if;
  end if;
  insert into public.cambios_plan(plan_estudio_id,cambiado_por,tipo,campo,valor_anterior,valor_nuevo,fuente,admin_override,admin_override_motivo,admin_override_estado_clave)
  select p.id,auth.uid(),'OTRO','grupos_electivos',anterior,jsonb_build_object('operacion',p_operacion,'grupo_id',v_id,'datos',p_datos),'HUMANO',audit.admin_override,audit.motivo,audit.estado_clave from public.authz_admin_override_audit(p.id) audit;
  delete from private.grupos_electivos_operaciones where transaccion=txid_current() and proceso=pg_backend_pid();
  return v_id;
end $$;
revoke all on function public.gestionar_grupo_electivo_plan(uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.gestionar_grupo_electivo_plan(uuid,text,uuid,jsonb) to authenticated,service_role;

-- Mantener composición y relaciones al crear una nueva versión usando los mapas
-- de identificadores que el clonador ya construye; no emparejar por nombres.
do $migration$ declare d text; bloque text; begin
  select pg_get_functiondef('private.crear_version_redisenio_sin_area_comun(uuid,uuid,jsonb)'::regprocedure) into d;
  bloque:=$clonar$
  insert into private.grupos_electivos_operaciones values(txid_current(),pg_backend_pid()) on conflict do nothing;
  select coalesce(jsonb_object_agg(id::text,gen_random_uuid()::text),'{}'::jsonb) into v_grupo_map from public.grupos_electivos_plan where plan_estudio_id=v_source.id;
  insert into public.grupos_electivos_plan(id,plan_estudio_id,nombre,numero_ciclo,linea_plan_id,orden,creado_por)
    select (v_grupo_map->>g.id::text)::uuid,v_target.id,g.nombre,g.numero_ciclo,(v_line_map->>g.linea_plan_id::text)::uuid,g.orden,v_actor
    from public.grupos_electivos_plan g where g.plan_estudio_id=v_source.id;
  update public.grupos_electivos_plan nuevo set prerrequisito_grupo_id=(v_grupo_map->>original.prerrequisito_grupo_id::text)::uuid
    from public.grupos_electivos_plan original where original.plan_estudio_id=v_source.id and nuevo.id=(v_grupo_map->>original.id::text)::uuid;
  update public.asignaturas nueva set grupo_electivo_id=(v_grupo_map->>original.grupo_electivo_id::text)::uuid
    from public.asignaturas original where original.plan_estudio_id=v_source.id and original.grupo_electivo_id is not null
    and nueva.id=(v_subject_map->>original.id::text)::uuid;
  delete from private.grupos_electivos_operaciones where transaccion=txid_current() and proceso=pg_backend_pid();
  return v_target;
  $clonar$;
  if position('return v_target;' in d)=0 then raise exception 'No se encontró el punto de integración del clonador'; end if;
  d:=replace(d,'v_line_map jsonb','v_grupo_map jsonb; v_line_map jsonb');
  execute replace(d,'return v_target;',bloque);
end $migration$;

alter publication supabase_realtime add table public.grupos_electivos_plan;

-- No permitir que una reducción de duración deje bloques fuera del mapa.
create function private.validar_duracion_grupos_plan() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.grupos_electivos_plan where plan_estudio_id=new.id and numero_ciclo>new.numero_ciclos) then
    raise exception 'Reubica los bloques electivos antes de reducir la duración del plan' using errcode='23514'; end if;
  return new;
end $$;
create trigger validar_duracion_grupos_plan before update of numero_ciclos on public.planes_estudio
for each row execute function private.validar_duracion_grupos_plan();
revoke all on function private.validar_duracion_grupos_plan() from public,anon,authenticated,service_role;
