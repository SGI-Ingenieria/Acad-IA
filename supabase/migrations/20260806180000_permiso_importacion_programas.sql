create or replace function public.crear_importacion_academica(
  p_tipo public.tipo_importacion_academica,
  p_carrera_id uuid default null,
  p_estructura_destino_id uuid default null,
  p_plan_destino_id uuid default null
)
returns public.importaciones_academicas
language plpgsql security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tenant_id uuid;
  v_result public.importaciones_academicas;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'Usuario no autenticado';
  end if;
  if p_tipo = 'EXPEDIENTE_PLAN'
     and not public.authz_has_permission('planes.crear') then
    raise exception using errcode = '42501', message = 'No puedes iniciar importaciones académicas';
  end if;
  if p_carrera_id is not null and not public.authz_can_access_carrera(p_carrera_id) then
    raise exception using errcode = '42501', message = 'No puedes usar la carrera seleccionada';
  end if;
  if p_estructura_destino_id is not null and not exists (
    select 1 from public.estructuras_plan ep
    where ep.id = p_estructura_destino_id
      and ep.tipo = 'CURRICULAR'
      and ep.estado_publicacion = 'PUBLICADA'
  ) then
    raise exception using errcode = '23514', message = 'El paquete curricular destino no está publicado';
  end if;
  if p_tipo = 'PROGRAMAS_ASIGNATURA' and (
    p_plan_destino_id is null
    or not public.authz_plan_write_allowed(p_plan_destino_id)
    or not public.authz_has_permission('asignaturas.editar')
  ) then
    raise exception using errcode = '42501', message = 'No puedes importar programas en este plan';
  end if;

  v_tenant_id := private.tenant_documental_predeterminado(v_actor);
  if v_tenant_id is null then
    raise exception using errcode = '42501', message = 'No existe un espacio documental predeterminado';
  end if;

  insert into public.importaciones_academicas (
    tenant_id, creado_por, tipo, carrera_id, estructura_destino_id,
    plan_destino_id
  ) values (
    v_tenant_id, v_actor, p_tipo, p_carrera_id, p_estructura_destino_id,
    p_plan_destino_id
  ) returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.crear_importacion_academica(
  public.tipo_importacion_academica, uuid, uuid, uuid
) to authenticated;
