-- Conecta recursos de aprendizaje al outbox genérico. La solicitud durable se
-- guarda antes de llamar a OpenAI y la publicación posterior valida el intento,
-- su lease y el response_id dentro de la misma transacción que hace visible el
-- trabajo global y su snapshot documental.

alter table public.learning_generation_jobs
  add column intento_generacion_activo_id uuid
    references private.intentos_generacion_ia(id) on delete set null;

create index learning_generation_jobs_intento_activo_idx
  on public.learning_generation_jobs (intento_generacion_activo_id)
  where intento_generacion_activo_id is not null;

create or replace function public.preparar_intento_recursos_ia(
  p_intento_id uuid,
  p_generation_job_id uuid,
  p_usuario_id uuid,
  p_contexto jsonb,
  p_solicitud jsonb,
  p_modo_referencias text default 'none',
  p_consulta_referencias text default '',
  p_referencias jsonb default '[]'::jsonb,
  p_actor text default 'learning-object-generate'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.learning_generation_jobs;
  v_intento jsonb;
  v_context_job_id uuid;
  v_context_user_id uuid;
  v_context_asignatura_id uuid;
begin
  if p_intento_id is null
     or p_generation_job_id is null
     or p_usuario_id is null then
    raise exception using
      errcode = '22023',
      message = 'intento, job y usuario son requeridos';
  end if;
  if jsonb_typeof(coalesce(p_contexto, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_solicitud, 'null'::jsonb)) <> 'object'
     or nullif(btrim(p_solicitud ->> 'model'), '') is null
     or jsonb_typeof(p_solicitud -> 'input') <> 'array'
     or p_solicitud #>> '{metadata,generation_attempt_id}'
       is distinct from p_intento_id::text then
    raise exception using
      errcode = '22023',
      message = 'el payload durable de recursos no es válido';
  end if;
  if jsonb_path_exists(p_solicitud, '$.**.file_data')
     or jsonb_path_exists(p_solicitud, '$.**.image_url') then
    raise exception using
      errcode = '22023',
      message = 'el outbox no admite binarios ni data URLs';
  end if;

  begin
    v_context_job_id := (p_contexto ->> 'jobId')::uuid;
    v_context_user_id := (p_contexto ->> 'userId')::uuid;
    v_context_asignatura_id := (p_contexto ->> 'asignaturaId')::uuid;
  exception when invalid_text_representation or null_value_not_allowed then
    raise exception using
      errcode = '22023',
      message = 'el contexto durable de recursos no es válido';
  end;
  if v_context_job_id is distinct from p_generation_job_id
     or v_context_user_id is distinct from p_usuario_id then
    raise exception using
      errcode = '22023',
      message = 'el contexto durable no corresponde al job y usuario';
  end if;

  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'job de recursos no encontrado';
  end if;
  if v_job.creado_por is distinct from p_usuario_id then
    raise exception using errcode = '42501', message = 'el usuario no creó el job de recursos';
  end if;
  if v_job.asignatura_id is distinct from v_context_asignatura_id then
    raise exception using errcode = '22023', message = 'la asignatura no corresponde al job';
  end if;
  if v_job.openai_response_id is not null
     or v_job.estado not in ('queued', 'running') then
    raise exception using
      errcode = '55000',
      message = 'el job de recursos ya no admite un intento remoto';
  end if;

  v_intento := public.preparar_intento_generacion_ia(
    p_intento_id,
    'recursos_aprendizaje',
    p_generation_job_id,
    'learning-resources',
    1,
    p_contexto,
    p_solicitud,
    p_modo_referencias,
    coalesce(p_consulta_referencias, ''),
    p_referencias,
    p_actor
  );

  if v_intento ->> 'id' is distinct from p_intento_id::text
     or v_intento ->> 'handler' is distinct from 'learning-resources'
     or v_intento ->> 'entidad_id' is distinct from p_generation_job_id::text then
    raise exception using
      errcode = '55000',
      message = 'no se pudo preparar el intento durable de recursos';
  end if;

  update public.learning_generation_jobs
  set intento_generacion_activo_id = p_intento_id,
      error = null
  where id = p_generation_job_id;

  return v_intento;
end;
$$;

-- La versión de 195000 queda como primitiva interna. Todo worker de API debe
-- entrar por la RPC ligada al outbox que se define a continuación.
revoke all on function public.publicar_generacion_recursos_ia(
  uuid, uuid, text, public.learning_generation_estado, text, timestamptz,
  jsonb, text, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.consultar_publicacion_generacion_recursos_ia(
  uuid, text, text, text, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.publicar_intento_recursos_ia(
  p_intento_id uuid,
  p_token_reclamacion uuid,
  p_generation_job_id uuid,
  p_usuario_id uuid,
  p_openai_response_id text,
  p_estado_local public.learning_generation_estado default 'running',
  p_estado_openai text default 'queued',
  p_iniciado_en timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intento private.intentos_generacion_ia;
  v_job public.learning_generation_jobs;
  v_publicacion jsonb;
  v_marcado boolean;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
begin
  if p_intento_id is null
     or p_generation_job_id is null
     or p_usuario_id is null
     or v_response_id is null then
    raise exception using
      errcode = '22023',
      message = 'intento, job, usuario y response_id son requeridos';
  end if;

  select i.* into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    return jsonb_build_object('resolution', 'stale', 'attempt', null);
  end if;
  if v_intento.handler <> 'learning-resources'
     or v_intento.payload_version <> 1
     or v_intento.tipo_entidad <> 'recursos_aprendizaje'
     or v_intento.entidad_id <> p_generation_job_id then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id
  for update;
  if not found
     or v_job.intento_generacion_activo_id is distinct from p_intento_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_job.creado_por is distinct from p_usuario_id
     or v_intento.contexto ->> 'userId' is distinct from p_usuario_id::text then
    raise exception using errcode = '42501', message = 'el usuario no corresponde al intento';
  end if;
  if v_intento.openai_response_id is distinct from v_response_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'winnerResponseId', v_intento.openai_response_id
    );
  end if;
  if v_intento.estado = 'publicado' then
    return jsonb_build_object(
      'resolution', 'already_applied',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'localJob', to_jsonb(v_job),
      'globalJob', (
        select to_jsonb(t)
        from public.trabajos_generacion_ia t
        where t.openai_response_id = v_response_id
      )
    );
  end if;
  if v_intento.estado in ('fallido', 'expirado', 'obsoleto') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_intento.estado <> 'respuesta_vinculada'
     or p_token_reclamacion is null
     or v_intento.token_reclamacion is distinct from p_token_reclamacion
     or v_intento.reclamado_hasta <= now() then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  v_publicacion := public.publicar_generacion_recursos_ia(
    p_generation_job_id,
    p_usuario_id,
    v_response_id,
    p_estado_local,
    p_estado_openai,
    p_iniciado_en,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'generation_attempt_id', p_intento_id,
      'handler', 'learning-resources'
    ),
    v_intento.modo_referencias,
    v_intento.consulta_referencias,
    v_intento.referencias
  );

  v_marcado := public.marcar_intento_generacion_ia_publicado(
    p_intento_id,
    p_token_reclamacion
  );
  if not v_marcado then
    raise exception using
      errcode = '55000',
      message = 'el lease del intento venció antes de publicar';
  end if;

  return jsonb_build_object(
    'resolution', 'applied',
    'attempt', private.intento_generacion_ia_json(p_intento_id),
    'localJob', v_publicacion -> 'localJob',
    'globalJob', v_publicacion -> 'globalJob'
  );
end;
$$;

create or replace function public.consultar_publicacion_intento_recursos_ia(
  p_intento_id uuid,
  p_generation_job_id uuid,
  p_openai_response_id text
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_intento private.intentos_generacion_ia;
  v_job public.learning_generation_jobs;
  v_publicacion jsonb;
begin
  select i.* into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id;
  if not found then
    return jsonb_build_object('resolution', 'missing', 'attempt', null);
  end if;
  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id;
  if not found
     or v_job.intento_generacion_activo_id is distinct from p_intento_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'winnerAttemptId', v_job.intento_generacion_activo_id
    );
  end if;
  if v_intento.handler <> 'learning-resources'
     or v_intento.entidad_id <> p_generation_job_id
     or v_intento.tipo_entidad <> 'recursos_aprendizaje' then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_intento.openai_response_id is not null
     and v_intento.openai_response_id <> p_openai_response_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'winnerResponseId', v_intento.openai_response_id
    );
  end if;
  if v_intento.estado in ('fallido', 'expirado', 'obsoleto') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_intento.estado <> 'publicado' then
    return jsonb_build_object(
      'resolution', 'active',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  v_publicacion := public.consultar_publicacion_generacion_recursos_ia(
    p_generation_job_id,
    p_openai_response_id,
    v_intento.modo_referencias,
    v_intento.consulta_referencias,
    v_intento.referencias
  );
  if v_publicacion ->> 'resolution' <> 'published' then
    return jsonb_build_object(
      'resolution', 'incomplete',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  return jsonb_build_object(
    'resolution', 'already_applied',
    'attempt', private.intento_generacion_ia_json(p_intento_id),
    'localJob', v_publicacion -> 'localJob',
    'globalJob', v_publicacion -> 'globalJob'
  );
end;
$$;

create or replace function public.fallar_intento_recursos_ia(
  p_intento_id uuid,
  p_token_reclamacion uuid,
  p_generation_job_id uuid,
  p_openai_response_id text default null,
  p_error jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intento private.intentos_generacion_ia;
  v_job public.learning_generation_jobs;
begin
  if jsonb_typeof(coalesce(p_error, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'error debe ser un objeto JSON';
  end if;
  select i.* into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;
  if not found then return false; end if;
  if v_intento.estado = 'fallido' then return true; end if;
  if v_intento.handler <> 'learning-resources'
     or v_intento.entidad_id <> p_generation_job_id
     or v_intento.estado not in ('preparado', 'reclamado', 'respuesta_vinculada')
     or p_token_reclamacion is null
     or v_intento.token_reclamacion is distinct from p_token_reclamacion
     or v_intento.reclamado_hasta <= now()
     or (p_openai_response_id is not null and
       v_intento.openai_response_id is distinct from p_openai_response_id) then
    return false;
  end if;
  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id
  for update;
  if not found
     or v_job.intento_generacion_activo_id is distinct from p_intento_id
     or v_job.openai_response_id is not null then
    return false;
  end if;
  update private.intentos_generacion_ia
  set estado = 'fallido',
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      actualizado_en = now(),
      ultimo_error = coalesce(p_error, '{}'::jsonb)
  where id = p_intento_id;
  update public.learning_generation_jobs
  set estado = 'failed',
      error = coalesce(nullif(p_error ->> 'message', ''), 'Falló el intento remoto de IA.'),
      completado_en = coalesce(completado_en, now())
  where id = p_generation_job_id;
  return true;
end;
$$;

create or replace function public.adoptar_publicar_intento_recursos_ia_webhook(
  p_intento_id uuid,
  p_openai_response_id text,
  p_estado_openai text,
  p_iniciado_en timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intento private.intentos_generacion_ia;
  v_token uuid := gen_random_uuid();
  v_usuario_id uuid;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
begin
  if p_intento_id is null or v_response_id is null then
    raise exception using errcode = '22023', message = 'intento y response_id son requeridos';
  end if;
  select i.* into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    return jsonb_build_object('resolution', 'stale', 'attempt', null);
  end if;
  if v_intento.handler <> 'learning-resources'
     or v_intento.tipo_entidad <> 'recursos_aprendizaje'
     or v_intento.estado in ('fallido', 'expirado', 'obsoleto') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_intento.openai_response_id is not null
     and v_intento.openai_response_id <> v_response_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'winnerResponseId', v_intento.openai_response_id
    );
  end if;
  if v_intento.estado = 'publicado' then
    return jsonb_build_object(
      'resolution', 'already_applied',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  begin
    v_usuario_id := (v_intento.contexto ->> 'userId')::uuid;
  exception when invalid_text_representation or null_value_not_allowed then
    raise exception using errcode = '22023', message = 'el intento no contiene un usuario válido';
  end;

  update private.intentos_generacion_ia
  set estado = 'respuesta_vinculada',
      openai_response_id = v_response_id,
      estado_openai = coalesce(nullif(btrim(p_estado_openai), ''), 'queued'),
      iniciado_en = coalesce(p_iniciado_en, now()),
      token_reclamacion = v_token,
      reclamado_por = 'webhook:learning-resources',
      reclamado_hasta = now() + interval '2 minutes',
      actualizado_en = now()
  where id = p_intento_id;

  return public.publicar_intento_recursos_ia(
    p_intento_id,
    v_token,
    v_intento.entidad_id,
    v_usuario_id,
    v_response_id,
    case when p_estado_openai = 'queued' then 'queued' else 'running' end,
    p_estado_openai,
    p_iniciado_en,
    jsonb_build_object('source', 'openai-webhook')
  );
end;
$$;

comment on column public.learning_generation_jobs.intento_generacion_activo_id is
  'Intento durable vigente que puede publicar el próximo response_id de este job.';

revoke all on function public.preparar_intento_recursos_ia(
  uuid, uuid, uuid, jsonb, jsonb, text, text, jsonb, text
) from public, anon, authenticated;
revoke all on function public.publicar_intento_recursos_ia(
  uuid, uuid, uuid, uuid, text, public.learning_generation_estado,
  text, timestamptz, jsonb
) from public, anon, authenticated;
revoke all on function public.consultar_publicacion_intento_recursos_ia(
  uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.fallar_intento_recursos_ia(
  uuid, uuid, uuid, text, jsonb
) from public, anon, authenticated;
revoke all on function public.adoptar_publicar_intento_recursos_ia_webhook(
  uuid, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.preparar_intento_recursos_ia(
  uuid, uuid, uuid, jsonb, jsonb, text, text, jsonb, text
) to service_role;
grant execute on function public.publicar_intento_recursos_ia(
  uuid, uuid, uuid, uuid, text, public.learning_generation_estado,
  text, timestamptz, jsonb
) to service_role;
grant execute on function public.consultar_publicacion_intento_recursos_ia(
  uuid, uuid, text
) to service_role;
grant execute on function public.fallar_intento_recursos_ia(
  uuid, uuid, uuid, text, jsonb
) to service_role;
grant execute on function public.adoptar_publicar_intento_recursos_ia_webhook(
  uuid, text, text, timestamptz
) to service_role;
