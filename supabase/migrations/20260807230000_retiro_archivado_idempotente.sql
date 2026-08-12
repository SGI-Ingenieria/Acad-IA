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

  if v_paquete.estado_publicacion in ('ARCHIVADA', 'RETIRADA') then
    return 'ARCHIVADO';
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
