-- Reutiliza la solicitud durable, sin reconstruir el prompt con datos actuales.
-- La transición y el nuevo outbox son atómicos: una caída no deja un hueco.
create or replace function public.reintentar_generacion_asignatura_ia(
  p_asignatura_id uuid,
  p_usuario_id uuid,
  p_intento_id uuid,
  p_safety_identifier text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asignatura public.asignaturas%rowtype;
  v_anterior private.intentos_generacion_ia%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'subject:asignatura:' || p_asignatura_id::text, 0
  ));

  select * into v_asignatura
  from public.asignaturas
  where id = p_asignatura_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'No se encontró la asignatura.';
  end if;
  if not coalesce(public.usuario_puede_usar_ia_plan(
    p_usuario_id, v_asignatura.plan_estudio_id
  ), false) then
    raise exception using errcode = '42501', message = 'No tienes permiso para generar asignaturas con IA en este plan.';
  end if;
  if v_asignatura.estado <> 'fallida' then
    raise exception using errcode = '55000', message = 'La asignatura ya no admite un reintento.';
  end if;

  select * into v_anterior
  from private.intentos_generacion_ia
  where id::text = v_asignatura.meta_origen #>> '{ai,activeAttemptId}'
    and tipo_entidad = 'asignatura'
    and entidad_id = p_asignatura_id
    and handler = 'subject'
    and payload_version = 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'No se conserva la solicitud original de esta generación.';
  end if;

  update public.asignaturas
  set estado = 'generando', actualizado_por = p_usuario_id
  where id = p_asignatura_id;

  return public.preparar_intento_entidad_ia(
    p_intento_id,
    'asignatura',
    p_asignatura_id,
    p_usuario_id,
    v_anterior.contexto || pg_catalog.jsonb_build_object(
      'source', 'ai-generate-subject:retry',
      'retryOfAttemptId', v_anterior.id
    ),
    v_anterior.solicitud || pg_catalog.jsonb_build_object(
      'safety_identifier', p_safety_identifier
    ),
    v_anterior.modo_referencias,
    v_anterior.consulta_referencias,
    v_anterior.referencias,
    'edge:ai-generate-subject:retry'
  );
end;
$$;

revoke all on function public.reintentar_generacion_asignatura_ia(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reintentar_generacion_asignatura_ia(uuid, uuid, uuid, text)
  to service_role;
