create or replace function public.crear_paquete_curricular(
  p_nombre text,
  p_etiqueta_version text,
  p_autoridad_normativa text default 'SEP/DGAIR'
)
returns public.estructuras_plan
language plpgsql security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result public.estructuras_plan;
begin
  if not public.authz_has_permission('catalogos.gestionar') then
    raise exception using errcode = '42501', message = 'No puedes crear paquetes curriculares';
  end if;
  if nullif(btrim(p_nombre), '') is null or nullif(btrim(p_etiqueta_version), '') is null then
    raise exception using errcode = '22023', message = 'Nombre y versión son obligatorios';
  end if;

  insert into public.estructuras_plan (
    nombre, tipo, definicion, autoridad_normativa, etiqueta_version,
    estado_publicacion, manifest_plantillas, creado_por, actualizado_por
  ) values (
    btrim(p_nombre), 'CURRICULAR',
    jsonb_build_object('type', 'object', 'properties', '{}'::jsonb, 'required', '[]'::jsonb, 'additionalProperties', false),
    coalesce(nullif(btrim(p_autoridad_normativa), ''), 'SEP/DGAIR'),
    btrim(p_etiqueta_version), 'BORRADOR', '{}'::jsonb, v_actor, v_actor
  ) returning * into v_result;

  insert into public.estructuras_asignatura (
    estructura_plan_id, nombre, tipo, definicion, creado_por, actualizado_por
  ) values (
    v_result.id, 'Programa de asignatura', 'CURRICULAR',
    jsonb_build_object('type', 'object', 'properties', '{}'::jsonb, 'required', '[]'::jsonb, 'additionalProperties', false),
    v_actor, v_actor
  );

  return v_result;
end;
$$;

grant execute on function public.crear_paquete_curricular(text, text, text) to authenticated;
revoke all on function public.crear_paquete_curricular(text, text, text) from public;

comment on function public.crear_paquete_curricular(text, text, text) is
  'Crea en una transacción la raíz curricular y su estructura hija única de asignatura.';
