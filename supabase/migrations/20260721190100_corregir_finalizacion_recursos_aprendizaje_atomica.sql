-- Hace durable la correccion de atomicidad para bases que ya aplicaron
-- 20260721180000 antes de que se cerraran los casos de respuesta obsoleta.

create or replace function public.persistir_resultado_recursos_aprendizaje_ia(
  p_generation_job_id uuid,
  p_openai_response_id text,
  p_resultado jsonb,
  p_objetos jsonb,
  p_score jsonb
) returns public.learning_generation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.learning_generation_jobs;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'recursos_aprendizaje:' || p_generation_job_id::text,
      0
    )
  );

  -- Una generacion asincrona registrada siempre debe cerrar mediante su lease.
  if exists (
    select 1
    from public.trabajos_generacion_ia t
    where t.tipo_entidad = 'recursos_aprendizaje'
      and t.entidad_id = p_generation_job_id
      and t.estado in ('pendiente', 'reclamado')
  ) then
    raise exception using
      errcode = '55000',
      message = 'La generacion asincrona requiere una reclamacion vigente';
  end if;

  v_job := private.persistir_resultado_recursos_aprendizaje_ia(
    p_generation_job_id,
    p_openai_response_id,
    p_resultado,
    p_objetos,
    p_score
  );
  return v_job;
end;
$$;

create or replace function public.finalizar_recursos_aprendizaje_ia(
  p_trabajo_id uuid,
  p_token_reclamacion uuid,
  p_generation_job_id uuid,
  p_openai_response_id text,
  p_estado_openai text,
  p_resultado jsonb,
  p_objetos jsonb,
  p_score jsonb
) returns public.trabajos_generacion_ia
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trabajo public.trabajos_generacion_ia;
  v_response_vigente text;
  v_job public.learning_generation_jobs;
begin
  select t.* into v_trabajo
  from public.trabajos_generacion_ia t
  where t.id = p_trabajo_id
    and t.tipo_entidad = 'recursos_aprendizaje'
    and t.entidad_id = p_generation_job_id
    and t.openai_response_id = p_openai_response_id
    and t.estado = 'reclamado'
    and t.token_reclamacion = p_token_reclamacion
    and t.reclamado_hasta > now()
  for update;

  if v_trabajo.id is null then
    return null;
  end if;

  -- Mantiene el mismo orden de bloqueo que el finalizador comun:
  -- trabajo global, advisory lock de entidad y finalmente entidad local.
  perform pg_advisory_xact_lock(
    hashtextextended(
      v_trabajo.tipo_entidad::text || ':' || v_trabajo.entidad_id::text,
      0
    )
  );

  v_response_vigente := private.openai_response_id_vigente_trabajo_ia(
    v_trabajo.tipo_entidad,
    v_trabajo.entidad_id
  );
  if v_response_vigente is distinct from v_trabajo.openai_response_id then
    update public.trabajos_generacion_ia t
    set estado = 'obsoleto',
        estado_openai = coalesce(p_estado_openai, t.estado_openai),
        completado_en = now(),
        ultimo_error = jsonb_build_object(
          'code', 'STALE_RESPONSE',
          'message', 'El trabajo de recursos ya apunta a otra respuesta de OpenAI.'
        ),
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null
    where t.id = v_trabajo.id
    returning t.* into v_trabajo;
    -- El cambio a obsoleto sí se confirma, pero NULL impide que el invocador
    -- interprete como aplicado un resultado que no tocó el job local.
    return null;
  end if;

  v_job := private.persistir_resultado_recursos_aprendizaje_ia(
    p_generation_job_id,
    p_openai_response_id,
    p_resultado,
    p_objetos,
    p_score
  );

  update public.trabajos_generacion_ia t
  set estado = 'completado',
      estado_openai = coalesce(p_estado_openai, 'completed'),
      ultimo_error = null,
      completado_en = now(),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      metadata = t.metadata || jsonb_build_object(
        'learning_generation_job_id', v_job.id,
        'objetos_aplicados', jsonb_array_length(p_objetos)
      )
  where t.id = v_trabajo.id
  returning t.* into v_trabajo;

  return v_trabajo;
end;
$$;

revoke all on function public.persistir_resultado_recursos_aprendizaje_ia(
  uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.persistir_resultado_recursos_aprendizaje_ia(
  uuid, text, jsonb, jsonb, jsonb
) to service_role;

revoke all on function public.finalizar_recursos_aprendizaje_ia(
  uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.finalizar_recursos_aprendizaje_ia(
  uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb
) to service_role;

comment on function public.finalizar_recursos_aprendizaje_ia(
  uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb
) is
  'Aplica objetos, score y ambos trabajos de recursos en una sola transaccion, validando el lease token vigente.';
