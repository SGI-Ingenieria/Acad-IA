-- Publica una respuesta de recursos, su trabajo global y el snapshot
-- documental como una sola transición. Ningún consumidor puede observar el
-- response_id local antes de que las referencias queden congeladas.

create or replace function private.proteger_publicacion_trabajo_recursos_ia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo_entidad = 'recursos_aprendizaje'
     and new.estado in ('pendiente', 'reclamado')
     and not exists (
       select 1
       from public.learning_generation_jobs j
       where j.id = new.entidad_id
         and j.openai_response_id = new.openai_response_id
     ) then
    raise exception using
      errcode = '55000',
      message = 'la respuesta de recursos todavía no fue publicada';
  end if;
  return new;
end;
$$;

revoke all on function private.proteger_publicacion_trabajo_recursos_ia()
from public, anon, authenticated;

drop trigger if exists trg_proteger_publicacion_trabajo_recursos_ia
  on public.trabajos_generacion_ia;
create trigger trg_proteger_publicacion_trabajo_recursos_ia
before insert or update of tipo_entidad, entidad_id, openai_response_id, estado
on public.trabajos_generacion_ia
for each row execute function private.proteger_publicacion_trabajo_recursos_ia();

create or replace function public.publicar_generacion_recursos_ia(
  p_generation_job_id uuid,
  p_usuario_id uuid,
  p_openai_response_id text,
  p_estado_local public.learning_generation_estado default 'running',
  p_estado_openai text default 'queued',
  p_iniciado_en timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb,
  p_modo_referencias text default 'none',
  p_consulta_referencias text default '',
  p_referencias jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.learning_generation_jobs;
  v_trabajo public.trabajos_generacion_ia;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
  v_tenant_id uuid;
  v_referencia jsonb;
  v_file_id uuid;
  v_file_version_id uuid;
  v_chunk_ids uuid[];
  v_scores jsonb;
  v_conteo_referencias integer;
begin
  if p_generation_job_id is null
     or p_usuario_id is null
     or v_response_id is null then
    raise exception using
      errcode = '22023',
      message = 'job, usuario y response_id son requeridos';
  end if;
  if p_estado_local not in ('queued', 'running') then
    raise exception using
      errcode = '22023',
      message = 'estado local de publicación no válido';
  end if;
  if nullif(btrim(p_estado_openai), '') is null then
    raise exception using errcode = '22023', message = 'estado_openai es requerido';
  end if;
  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'metadata debe ser un objeto JSON';
  end if;
  if jsonb_typeof(coalesce(p_referencias, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'referencias debe ser un arreglo JSON';
  end if;
  v_conteo_referencias := jsonb_array_length(p_referencias);
  if v_conteo_referencias > 5 then
    raise exception using errcode = '22023', message = 'se permiten como máximo cinco referencias';
  end if;
  if p_modo_referencias not in ('none', 'direct', 'retrieval') then
    raise exception using errcode = '22023', message = 'modo de referencias no válido';
  end if;
  if (p_modo_referencias = 'none') <> (v_conteo_referencias = 0) then
    raise exception using
      errcode = '22023',
      message = 'el modo none requiere cero referencias y los demás modos requieren al menos una';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_referencias) as r(value)
    group by r.value ->> 'fileVersionId'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'hay versiones documentales duplicadas';
  end if;

  -- Respeta el orden del finalizador: trabajo global, lock de entidad y job.
  perform t.id
  from public.trabajos_generacion_ia t
  where t.openai_response_id = v_response_id
  for update;
  perform pg_advisory_xact_lock(
    hashtextextended(
      'recursos_aprendizaje:' || p_generation_job_id::text,
      0
    )
  );

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
  if v_job.openai_response_id is not null
     and v_job.openai_response_id <> v_response_id then
    raise exception using
      errcode = '55000',
      message = 'el job de recursos ya apunta a otra respuesta de OpenAI';
  end if;
  if v_job.openai_response_id is null then
    if v_job.estado not in ('queued', 'running') then
      raise exception using
        errcode = '55000',
        message = 'el job de recursos ya no admite publicar una respuesta';
    end if;
    update public.learning_generation_jobs
    set estado = p_estado_local,
        openai_response_id = v_response_id,
        error = null
    where id = v_job.id
    returning * into v_job;
  end if;

  select tm.tenant_id into v_tenant_id
  from public.tenant_memberships tm
  where tm.user_id = p_usuario_id
    and tm.is_default
  limit 1;
  if v_tenant_id is null then
    raise exception using
      errcode = '42501',
      message = 'el usuario no tiene tenant documental predeterminado';
  end if;

  v_trabajo := public.registrar_trabajo_generacion_ia(
    'recursos_aprendizaje',
    v_job.id,
    v_response_id,
    p_estado_openai,
    coalesce(p_iniciado_en, now()),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'initiatedBy', p_usuario_id,
      'learningGenerationJobId', v_job.id,
      'publishedAtomically', true
    )
  );

  if v_trabajo.id is null
     or v_trabajo.tipo_entidad <> 'recursos_aprendizaje'
     or v_trabajo.entidad_id <> v_job.id
     or v_trabajo.openai_response_id <> v_response_id then
    raise exception using
      errcode = '55000',
      message = 'no se pudo adoptar el trabajo global de recursos';
  end if;

  for v_referencia in
    select value from jsonb_array_elements(p_referencias)
  loop
    if jsonb_typeof(v_referencia) <> 'object'
       or jsonb_typeof(v_referencia -> 'chunkIds') <> 'array'
       or jsonb_typeof(v_referencia -> 'scores') <> 'object' then
      raise exception using errcode = '22023', message = 'referencia documental no válida';
    end if;
    begin
      v_file_id := (v_referencia ->> 'fileId')::uuid;
      v_file_version_id := (v_referencia ->> 'fileVersionId')::uuid;
      select coalesce(array_agg(chunk_id), '{}'::uuid[])
      into v_chunk_ids
      from (
        select jsonb_array_elements_text(v_referencia -> 'chunkIds')::uuid as chunk_id
      ) parsed_chunks;
    exception when invalid_text_representation or null_value_not_allowed then
      raise exception using errcode = '22023', message = 'identificador documental no válido';
    end;
    if v_file_id is null or v_file_version_id is null then
      raise exception using errcode = '22023', message = 'identificador documental no válido';
    end if;
    v_scores := v_referencia -> 'scores';
    if exists (
      select 1 from jsonb_each(v_scores) score where jsonb_typeof(score.value) <> 'number'
    ) then
      raise exception using errcode = '22023', message = 'los puntajes documentales deben ser numéricos';
    end if;

    if not exists (
      select 1
      from public.file_versions fv
      join public.files f on f.id = fv.file_id
      where fv.id = v_file_version_id
        and fv.file_id = v_file_id
        and fv.tenant_id = v_tenant_id
        and f.tenant_id = v_tenant_id
        and f.deleted_at is null
    ) then
      raise exception using
        errcode = '23503',
        message = 'la versión documental no pertenece al archivo y tenant indicados';
    end if;
    if p_modo_referencias = 'direct'
       and (cardinality(v_chunk_ids) <> 0 or v_scores <> '{}'::jsonb) then
      raise exception using
        errcode = '22023',
        message = 'una referencia directa no contiene chunks ni puntajes';
    end if;
    if p_modo_referencias = 'retrieval'
       and cardinality(v_chunk_ids) = 0 then
      raise exception using
        errcode = '22023',
        message = 'una referencia recuperada requiere chunks';
    end if;
    if cardinality(v_chunk_ids) <> (
      select count(distinct chunk_id)
      from unnest(v_chunk_ids) chunk_id
    ) then
      raise exception using errcode = '22023', message = 'hay chunks documentales duplicados';
    end if;
    if p_modo_referencias = 'retrieval' and (
      (select count(*) from jsonb_object_keys(v_scores)) <> cardinality(v_chunk_ids)
      or exists (
        select 1
        from unnest(v_chunk_ids) chunk_id
        where not (v_scores ? chunk_id::text)
      )
    ) then
      raise exception using
        errcode = '22023',
        message = 'los puntajes no corresponden a los chunks recuperados';
    end if;
    if exists (
      select 1
      from unnest(v_chunk_ids) chunk_id
      left join public.document_chunks dc
        on dc.id = chunk_id
       and dc.file_version_id = v_file_version_id
       and dc.tenant_id = v_tenant_id
      where dc.id is null
    ) then
      raise exception using
        errcode = '23503',
        message = 'un chunk no pertenece a la versión documental';
    end if;

    insert into public.ai_request_references (
      tenant_id,
      request_id,
      conversation_type,
      conversation_id,
      message_type,
      message_id,
      file_id,
      file_version_id,
      mode,
      chunk_ids,
      retrieval_query,
      retrieval_scores
    ) values (
      v_tenant_id,
      v_response_id,
      'asignatura',
      v_job.asignatura_id,
      'asignatura',
      null,
      v_file_id,
      v_file_version_id,
      p_modo_referencias,
      v_chunk_ids,
      case when p_modo_referencias = 'retrieval' then p_consulta_referencias else null end,
      v_scores
    )
    on conflict (request_id, file_version_id, mode) do nothing;

    if not exists (
      select 1
      from public.ai_request_references ar
      where ar.request_id = v_response_id
        and ar.conversation_type = 'asignatura'
        and ar.conversation_id = v_job.asignatura_id
        and ar.message_type = 'asignatura'
        and ar.message_id is null
        and ar.tenant_id = v_tenant_id
        and ar.file_id = v_file_id
        and ar.file_version_id = v_file_version_id
        and ar.mode = p_modo_referencias
        and ar.chunk_ids = v_chunk_ids
        and ar.retrieval_query is not distinct from (
          case when p_modo_referencias = 'retrieval' then p_consulta_referencias else null end
        )
        and ar.retrieval_scores = v_scores
    ) then
      raise exception using
        errcode = '55000',
        message = 'el response_id ya tiene una referencia documental diferente';
    end if;
  end loop;

  if (
    select count(*)
    from public.ai_request_references ar
    where ar.request_id = v_response_id
  ) <> v_conteo_referencias then
    raise exception using
      errcode = '55000',
      message = 'el response_id contiene un conjunto de referencias diferente';
  end if;

  return jsonb_build_object(
    'resolution', 'published',
    'localJob', to_jsonb(v_job),
    'globalJob', to_jsonb(v_trabajo)
  );
end;
$$;

create or replace function public.consultar_publicacion_generacion_recursos_ia(
  p_generation_job_id uuid,
  p_openai_response_id text,
  p_modo_referencias text,
  p_consulta_referencias text,
  p_referencias jsonb
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_job public.learning_generation_jobs;
  v_trabajo public.trabajos_generacion_ia;
  v_referencia jsonb;
  v_chunk_ids uuid[];
  v_conteo integer := case
    when jsonb_typeof(p_referencias) = 'array' then jsonb_array_length(p_referencias)
    else -1
  end;
begin
  select j.* into v_job
  from public.learning_generation_jobs j
  where j.id = p_generation_job_id;

  if not found or v_job.openai_response_id is null then
    return jsonb_build_object('resolution', 'missing');
  end if;
  if v_job.openai_response_id <> p_openai_response_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'winnerResponseId', v_job.openai_response_id,
      'localJob', to_jsonb(v_job)
    );
  end if;

  select t.* into v_trabajo
  from public.trabajos_generacion_ia t
  where t.tipo_entidad = 'recursos_aprendizaje'
    and t.entidad_id = p_generation_job_id
    and t.openai_response_id = p_openai_response_id;
  if not found or v_conteo < 0 then
    return jsonb_build_object('resolution', 'incomplete', 'localJob', to_jsonb(v_job));
  end if;

  for v_referencia in
    select value from jsonb_array_elements(p_referencias)
  loop
    begin
      select coalesce(array_agg(chunk_id), '{}'::uuid[])
      into v_chunk_ids
      from (
        select jsonb_array_elements_text(v_referencia -> 'chunkIds')::uuid as chunk_id
      ) chunks;
    exception when others then
      return jsonb_build_object('resolution', 'incomplete', 'localJob', to_jsonb(v_job));
    end;

    if not exists (
      select 1
      from public.ai_request_references ar
      where ar.request_id = p_openai_response_id
        and ar.conversation_type = 'asignatura'
        and ar.conversation_id = v_job.asignatura_id
        and ar.message_type = 'asignatura'
        and ar.message_id is null
        and ar.file_id::text = v_referencia ->> 'fileId'
        and ar.file_version_id::text = v_referencia ->> 'fileVersionId'
        and ar.mode = p_modo_referencias
        and ar.chunk_ids = v_chunk_ids
        and ar.retrieval_query is not distinct from (
          case when p_modo_referencias = 'retrieval' then p_consulta_referencias else null end
        )
        and ar.retrieval_scores = v_referencia -> 'scores'
    ) then
      return jsonb_build_object(
        'resolution', 'incomplete',
        'localJob', to_jsonb(v_job),
        'globalJob', to_jsonb(v_trabajo)
      );
    end if;
  end loop;

  if (
    select count(*)
    from public.ai_request_references ar
    where ar.request_id = p_openai_response_id
  ) <> v_conteo then
    return jsonb_build_object(
      'resolution', 'incomplete',
      'localJob', to_jsonb(v_job),
      'globalJob', to_jsonb(v_trabajo)
    );
  end if;

  return jsonb_build_object(
    'resolution', 'published',
    'localJob', to_jsonb(v_job),
    'globalJob', to_jsonb(v_trabajo)
  );
end;
$$;

comment on function public.publicar_generacion_recursos_ia(
  uuid, uuid, text, public.learning_generation_estado, text, timestamptz,
  jsonb, text, text, jsonb
) is
  'Publica job local, trabajo global y snapshot documental de recursos en una sola transacción idempotente.';

revoke all on function public.publicar_generacion_recursos_ia(
  uuid, uuid, text, public.learning_generation_estado, text, timestamptz,
  jsonb, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.publicar_generacion_recursos_ia(
  uuid, uuid, text, public.learning_generation_estado, text, timestamptz,
  jsonb, text, text, jsonb
) to service_role;

revoke all on function public.consultar_publicacion_generacion_recursos_ia(
  uuid, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.consultar_publicacion_generacion_recursos_ia(
  uuid, text, text, text, jsonb
) to service_role;
