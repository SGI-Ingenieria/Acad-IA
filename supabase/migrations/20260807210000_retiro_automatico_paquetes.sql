-- Una sola operación decide el retiro seguro del paquete. Los borradores sin
-- uso se eliminan; los paquetes con trazabilidad académica se archivan.

create or replace function private.proteger_paquete_publicado()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_estado public.estado_publicacion_estructura;
begin
  if tg_table_name = 'estructuras_plan' then
    if old.estado_publicacion = 'PUBLICADA' then
      if tg_op = 'UPDATE'
         and new.estado_publicacion = 'ARCHIVADA'
         and (to_jsonb(new) - array['estado_publicacion', 'actualizado_en', 'actualizado_por'])
             = (to_jsonb(old) - array['estado_publicacion', 'actualizado_en', 'actualizado_por']) then
        return new;
      end if;

      raise exception using
        errcode = '55000',
        message = 'El paquete publicado es inmutable';
    end if;
  else
    select ep.estado_publicacion into v_estado
    from public.estructuras_plan ep
    where ep.id = coalesce(new.estructura_plan_id, old.estructura_plan_id);

    if v_estado = 'PUBLICADA' then
      raise exception using
        errcode = '55000',
        message = 'El paquete publicado es inmutable';
    end if;
  end if;

  return coalesce(new, old);
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
  v_tiene_referencias boolean;
begin
  if not public.authz_has_permission('catalogos.gestionar') then
    raise exception using
      errcode = '42501',
      message = 'No puedes retirar paquetes curriculares';
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

  if v_paquete.estado_publicacion in ('ARCHIVADA', 'RETIRADA') then
    return 'ARCHIVADO';
  end if;

  select
    exists (
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
  into v_tiene_referencias;

  if v_tiene_referencias or v_paquete.estado_publicacion <> 'BORRADOR' then
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

revoke all on function public.retirar_paquete_curricular(uuid) from public, anon;
grant execute on function public.retirar_paquete_curricular(uuid) to authenticated;

comment on function public.retirar_paquete_curricular(uuid) is
  'Elimina un borrador curricular sin uso o lo archiva cuando debe conservar trazabilidad.';
