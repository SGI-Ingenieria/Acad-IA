-- Un paquete curricular es la raíz de una composición: su estructura de
-- asignatura no tiene ciclo de vida independiente y debe eliminarse con él.

alter table public.estructuras_asignatura
  drop constraint if exists estructuras_asignatura_estructura_plan_id_fkey;

alter table public.estructuras_asignatura
  add constraint estructuras_asignatura_estructura_plan_id_fkey
  foreign key (estructura_plan_id)
  references public.estructuras_plan(id)
  on delete cascade;

create or replace function public.archivar_paquete_curricular(
  p_estructura_id uuid
)
returns public.estructuras_plan
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_paquete public.estructuras_plan;
begin
  if not public.authz_has_permission('catalogos.gestionar') then
    raise exception using
      errcode = '42501',
      message = 'No puedes archivar paquetes curriculares';
  end if;

  select * into v_paquete
  from public.estructuras_plan
  where id = p_estructura_id
  for update;

  if v_paquete.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Paquete curricular no encontrado';
  end if;

  if v_paquete.estado_publicacion = 'ARCHIVADA' then
    return v_paquete;
  end if;

  if v_paquete.estado_publicacion <> 'BORRADOR' then
    raise exception using
      errcode = '55000',
      message = 'Solo se puede archivar un paquete en borrador';
  end if;

  update public.estructuras_plan
  set
    estado_publicacion = 'ARCHIVADA',
    actualizado_en = now(),
    actualizado_por = auth.uid()
  where id = p_estructura_id
  returning * into v_paquete;

  return v_paquete;
end;
$$;

create or replace function public.eliminar_paquete_curricular(
  p_estructura_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_paquete public.estructuras_plan;
begin
  if not public.authz_has_permission('catalogos.gestionar') then
    raise exception using
      errcode = '42501',
      message = 'No puedes eliminar paquetes curriculares';
  end if;

  select * into v_paquete
  from public.estructuras_plan
  where id = p_estructura_id
  for update;

  if v_paquete.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Paquete curricular no encontrado';
  end if;

  if v_paquete.estado_publicacion <> 'BORRADOR' then
    raise exception using
      errcode = '55000',
      message = 'Solo se puede eliminar un paquete en borrador';
  end if;

  if exists (
    select 1
    from public.planes_estudio p
    where p.estructura_id = p_estructura_id
       or p.estructura_recomendada_id = p_estructura_id
  ) or exists (
    select 1
    from public.importaciones_academicas i
    where i.estructura_destino_id = p_estructura_id
       or i.estructura_detectada_id = p_estructura_id
  ) or exists (
    select 1
    from public.estructuras_plan version
    where version.version_anterior_id = p_estructura_id
  ) then
    raise exception using
      errcode = '55000',
      message = 'El paquete está en uso; archívalo para conservar sus referencias';
  end if;

  delete from public.estructuras_plan
  where id = p_estructura_id;

  return p_estructura_id;
end;
$$;

revoke all on function public.archivar_paquete_curricular(uuid) from public, anon;
revoke all on function public.eliminar_paquete_curricular(uuid) from public, anon;
grant execute on function public.archivar_paquete_curricular(uuid) to authenticated;
grant execute on function public.eliminar_paquete_curricular(uuid) to authenticated;

comment on function public.archivar_paquete_curricular(uuid) is
  'Archiva de forma idempotente un paquete curricular en borrador.';
comment on function public.eliminar_paquete_curricular(uuid) is
  'Elimina un paquete curricular no utilizado y su estructura de asignatura hija.';
