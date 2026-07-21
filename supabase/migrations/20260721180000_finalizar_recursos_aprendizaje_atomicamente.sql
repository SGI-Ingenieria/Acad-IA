-- Cierra recursos de aprendizaje en una sola transaccion corta.
-- La consulta a OpenAI y la normalizacion del resultado ocurren antes de esta RPC.

create or replace function private.persistir_resultado_recursos_aprendizaje_ia(
  p_generation_job_id uuid,
  p_openai_response_id text,
  p_resultado jsonb,
  p_objetos jsonb,
  p_score jsonb
) returns public.learning_generation_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.learning_generation_jobs;
  v_objetos_insertados integer := 0;
begin
  if p_generation_job_id is null
     or nullif(btrim(p_openai_response_id), '') is null
     or jsonb_typeof(p_resultado) is distinct from 'object'
     or jsonb_typeof(p_objetos) is distinct from 'array'
     or jsonb_array_length(p_objetos) = 0
     or jsonb_typeof(p_score) is distinct from 'object' then
    raise exception using
      errcode = '22023',
      message = 'El resultado atomico de recursos no cumple el contrato requerido';
  end if;

  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id
  for update;

  if v_job.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'No existe el trabajo local de recursos';
  end if;

  if v_job.openai_response_id is distinct from p_openai_response_id then
    raise exception using
      errcode = '22023',
      message = 'La respuesta de OpenAI no corresponde al trabajo de recursos';
  end if;

  if v_job.estado not in ('queued', 'running', 'needs_review', 'completed') then
    raise exception using
      errcode = '55000',
      message = 'El trabajo local de recursos ya no acepta resultados';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_objetos) as elemento(valor)
    where jsonb_typeof(elemento.valor) is distinct from 'object'
      or nullif(btrim(elemento.valor ->> 'tipo'), '') is null
      or nullif(btrim(elemento.valor ->> 'titulo'), '') is null
      or jsonb_typeof(coalesce(elemento.valor -> 'contenido_json', '{}'::jsonb))
           is distinct from 'object'
      or jsonb_typeof(coalesce(elemento.valor -> 'source_refs', '[]'::jsonb))
           is distinct from 'array'
      or jsonb_typeof(coalesce(elemento.valor -> 'metadata', '{}'::jsonb))
           is distinct from 'object'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Uno o mas objetos de aprendizaje son invalidos';
  end if;

  delete from public.learning_objects
  where generation_job_id = v_job.id;

  insert into public.learning_objects (
    asignatura_id,
    unidad_id,
    tema_id,
    tipo,
    titulo,
    descripcion,
    contenido_json,
    score,
    source_refs,
    metadata,
    creado_por,
    actualizado_por,
    generation_job_id
  )
  select
    v_job.asignatura_id,
    v_job.unidad_id,
    v_job.tema_id,
    objeto.tipo::public.learning_object_tipo,
    objeto.titulo,
    objeto.descripcion,
    coalesce(objeto.contenido_json, '{}'::jsonb),
    objeto.score,
    coalesce(objeto.source_refs, '[]'::jsonb),
    coalesce(objeto.metadata, '{}'::jsonb),
    v_job.creado_por,
    v_job.creado_por,
    v_job.id
  from jsonb_to_recordset(p_objetos) as objeto(
    tipo text,
    titulo text,
    descripcion text,
    contenido_json jsonb,
    score integer,
    source_refs jsonb,
    metadata jsonb
  );

  get diagnostics v_objetos_insertados = row_count;
  if v_objetos_insertados <> jsonb_array_length(p_objetos) then
    raise exception using
      errcode = '22023',
      message = 'No se insertaron todos los objetos de aprendizaje';
  end if;

  delete from public.learning_quality_scores s
  where s.asignatura_id = v_job.asignatura_id
    and s.unidad_id is not distinct from v_job.unidad_id
    and s.tema_id is not distinct from v_job.tema_id;

  insert into public.learning_quality_scores (
    asignatura_id,
    unidad_id,
    tema_id,
    score_total,
    rubrica_json,
    recomendaciones_json,
    generation_job_id,
    generado_por
  ) values (
    v_job.asignatura_id,
    v_job.unidad_id,
    v_job.tema_id,
    (p_score ->> 'score_total')::integer,
    coalesce(p_score -> 'rubrica_json', '{}'::jsonb),
    coalesce(p_score -> 'recomendaciones_json', '[]'::jsonb),
    v_job.id,
    v_job.creado_por
  );

  update public.learning_generation_jobs j
  set estado = 'completed',
      openai_response_id = p_openai_response_id,
      resultado_json = p_resultado,
      error = null,
      completado_en = now()
  where j.id = v_job.id
  returning j.* into v_job;

  return v_job;
end;
$$;

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

revoke all on function private.persistir_resultado_recursos_aprendizaje_ia(
  uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;

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
