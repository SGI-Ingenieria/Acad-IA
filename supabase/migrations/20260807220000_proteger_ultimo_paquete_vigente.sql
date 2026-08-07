-- La interfaz distingue la única acción disponible, pero la base vuelve a
-- comprobarla dentro de una sección crítica para impedir retiros concurrentes.

create or replace function public.evaluar_retiro_paquete_curricular(
  p_estructura_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_paquete public.estructuras_plan;
  v_debe_archivar boolean;
begin
  if not public.authz_has_permission('catalogos.gestionar') then
    raise exception using
      errcode = '42501',
      message = 'No puedes retirar paquetes curriculares';
  end if;

  select * into v_paquete
  from public.estructuras_plan
  where id = p_estructura_id;

  if v_paquete.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Paquete curricular no encontrado';
  end if;

  if v_paquete.estado_publicacion in ('ARCHIVADA', 'RETIRADA') then
    return 'BLOQUEADO';
  end if;

  select
    v_paquete.estado_publicacion <> 'BORRADOR'
    or exists (
      select 1
      from public.planes_estudio p
      where p.estructura_id = p_estructura_id
         or p.estructura_recomendada_id = p_estructura_id
    )
    or exists (
      select 1
      from public.asignaturas a
      join public.estructuras_asignatura ea on ea.id = a.estructura_id
      where ea.estructura_plan_id = p_estructura_id
    )
    or exists (
      select 1
      from public.importaciones_academicas i
      where i.estructura_destino_id = p_estructura_id
         or i.estructura_detectada_id = p_estructura_id
    )
    or exists (
      select 1
      from public.estructuras_plan version
      where version.version_anterior_id = p_estructura_id
    )
  into v_debe_archivar;

  if not v_debe_archivar then
    return 'ELIMINAR';
  end if;

  if not exists (
    select 1
    from public.estructuras_plan otra
    where otra.id <> p_estructura_id
      and otra.tipo = 'CURRICULAR'
      and otra.estado_publicacion not in ('ARCHIVADA', 'RETIRADA')
  ) then
    return 'BLOQUEADO';
  end if;

  return 'ARCHIVAR';
end;
$$;

create or replace function public.retirar_paquete_curricular(
  p_estructura_id uuid
)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_paquete public.estructuras_plan;
  v_accion text;
begin
  if not public.authz_has_permission('catalogos.gestionar') then
    raise exception using
      errcode = '42501',
      message = 'No puedes retirar paquetes curriculares';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('retiro-paquetes-curriculares')
  );

  select * into v_paquete
  from public.estructuras_plan
  where id = p_estructura_id
  for update;

  if v_paquete.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Paquete curricular no encontrado';
  end if;

  v_accion := public.evaluar_retiro_paquete_curricular(p_estructura_id);

  if v_accion = 'BLOQUEADO' then
    raise exception using
      errcode = '55000',
      message = 'Debe permanecer al menos un paquete curricular vigente';
  end if;

  if v_accion = 'ARCHIVAR' then
    update public.estructuras_plan
    set
      estado_publicacion = 'ARCHIVADA',
      actualizado_en = now(),
      actualizado_por = auth.uid()
    where id = p_estructura_id;

    return 'ARCHIVADO';
  end if;

  delete from public.estructuras_plan
  where id = p_estructura_id;

  return 'ELIMINADO';
end;
$$;

revoke all on function public.evaluar_retiro_paquete_curricular(uuid) from public, anon;
grant execute on function public.evaluar_retiro_paquete_curricular(uuid) to authenticated;

comment on function public.evaluar_retiro_paquete_curricular(uuid) is
  'Indica si el único retiro disponible es eliminar, archivar o ninguno.';
