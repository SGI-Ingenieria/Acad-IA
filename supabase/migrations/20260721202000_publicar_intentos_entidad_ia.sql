-- Planes y asignaturas usan el núcleo durable común, pero conservan sus reglas
-- de publicación. La entidad sólo expone responseId cuando bitácora, snapshot
-- documental y outbox pueden confirmarse en la misma transacción.

create or replace function private.entidad_intento_ia_json(
  p_tipo_entidad public.tipo_trabajo_generacion_ia,
  p_entidad_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entidad jsonb;
begin
  if p_tipo_entidad = 'plan' then
    select to_jsonb(p) into v_entidad
    from public.planes_estudio p
    where p.id = p_entidad_id;
  elsif p_tipo_entidad = 'asignatura' then
    select to_jsonb(a) into v_entidad
    from public.asignaturas a
    where a.id = p_entidad_id;
  end if;
  return v_entidad;
end;
$$;

revoke all on function private.entidad_intento_ia_json(
  public.tipo_trabajo_generacion_ia, uuid
) from public, anon, authenticated, service_role;

create or replace function public.preparar_intento_entidad_ia(
  p_intento_id uuid,
  p_tipo_entidad public.tipo_trabajo_generacion_ia,
  p_entidad_id uuid,
  p_usuario_id uuid,
  p_contexto jsonb,
  p_solicitud jsonb,
  p_modo_referencias text default 'none',
  p_consulta_referencias text default '',
  p_referencias jsonb default '[]'::jsonb,
  p_actor text default 'edge:entity-generation'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handler text;
  v_contexto jsonb;
  v_intento jsonb;
  v_actualizados integer := 0;
begin
  if p_intento_id is null
     or p_entidad_id is null
     or p_usuario_id is null
     or p_tipo_entidad not in ('plan', 'asignatura') then
    raise exception using
      errcode = '22023',
      message = 'intento, tipo, entidad y usuario son requeridos';
  end if;
  if jsonb_typeof(coalesce(p_contexto, 'null'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'contexto debe ser un objeto JSON';
  end if;

  v_handler := case p_tipo_entidad
    when 'plan' then 'plan'
    else 'subject'
  end;
  v_contexto := coalesce(p_contexto, '{}'::jsonb) || jsonb_build_object(
    'userId', p_usuario_id,
    'entityId', p_entidad_id,
    'kind', p_tipo_entidad
  );

  -- La RPC común adquiere y conserva hasta el final de esta transacción el
  -- advisory lock de handler/tipo/entidad y obsoleta intentos anteriores.
  v_intento := public.preparar_intento_generacion_ia(
    p_intento_id,
    p_tipo_entidad,
    p_entidad_id,
    v_handler,
    1,
    v_contexto,
    p_solicitud,
    p_modo_referencias,
    coalesce(p_consulta_referencias, ''),
    p_referencias,
    p_actor
  );

  if p_tipo_entidad = 'plan' then
    update public.planes_estudio p
    set meta_origen = jsonb_set(
      coalesce(p.meta_origen, '{}'::jsonb),
      '{ai}',
      (
        case
          when jsonb_typeof(p.meta_origen -> 'ai') = 'object'
            then p.meta_origen -> 'ai'
          else '{}'::jsonb
        end
        - 'responseId'
        - 'error'
      ) || jsonb_strip_nulls(jsonb_build_object(
        'activeAttemptId', p_intento_id,
        'model', v_contexto ->> 'model',
        'reasoningEffort', v_contexto ->> 'reasoningEffort'
      )),
      true
    )
    where p.id = p_entidad_id
      and exists (
        select 1
        from public.estados_plan ep
        where ep.id = p.estado_actual_id
          and upper(ep.clave) = 'GENERANDO'
      );
  else
    update public.asignaturas a
    set meta_origen = jsonb_set(
      coalesce(a.meta_origen, '{}'::jsonb),
      '{ai}',
      (
        case
          when jsonb_typeof(a.meta_origen -> 'ai') = 'object'
            then a.meta_origen -> 'ai'
          else '{}'::jsonb
        end
        - 'responseId'
        - 'error'
      ) || jsonb_strip_nulls(jsonb_build_object(
        'activeAttemptId', p_intento_id,
        'model', v_contexto ->> 'model',
        'reasoningEffort', v_contexto ->> 'reasoningEffort'
      )),
      true
    )
    where a.id = p_entidad_id
      and a.estado = 'generando';
  end if;
  get diagnostics v_actualizados = row_count;

  if v_actualizados <> 1 then
    raise exception using
      errcode = '55000',
      message = 'la entidad ya no admite iniciar esta generación';
  end if;

  update public.trabajos_generacion_ia t
  set estado = 'obsoleto',
      completado_en = coalesce(t.completado_en, now()),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      ultimo_error = jsonb_build_object(
        'code', 'SUPERSEDED_ATTEMPT',
        'message', 'Un intento más reciente sustituyó esta respuesta.'
      )
  where t.tipo_entidad = p_tipo_entidad
    and t.entidad_id = p_entidad_id
    and t.estado in ('pendiente', 'reclamado');

  return jsonb_build_object(
    'resolution', 'prepared',
    'attempt', private.intento_generacion_ia_json(p_intento_id),
    'entity', private.entidad_intento_ia_json(p_tipo_entidad, p_entidad_id)
  );
end;
$$;

create or replace function private.publicar_intento_entidad_ia_interno(
  p_intento_id uuid,
  p_token_reclamacion uuid default null,
  p_exigir_token boolean default true,
  p_openai_response_id text default null,
  p_estado_openai text default null,
  p_iniciado_en timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo private.intentos_generacion_ia;
  v_intento private.intentos_generacion_ia;
  v_trabajo public.trabajos_generacion_ia;
  v_response_id text := nullif(btrim(coalesce(p_openai_response_id, '')), '');
  v_active_attempt text;
  v_estado_generando boolean := false;
  v_usuario_id uuid;
  v_tenant_id uuid;
  v_referencia jsonb;
  v_file_id uuid;
  v_file_version_id uuid;
  v_chunk_ids uuid[];
  v_scores jsonb;
  v_conteo_referencias integer;
  v_entidad jsonb;
begin
  select i.* into v_previo
  from private.intentos_generacion_ia i
  where i.id = p_intento_id;
  if not found then
    return jsonb_build_object('resolution', 'stale', 'attempt', null);
  end if;
  if v_previo.handler not in ('plan', 'subject')
     or v_previo.tipo_entidad not in ('plan', 'asignatura') then
    raise exception using errcode = '22023', message = 'handler de entidad no válido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_previo.handler || ':' || v_previo.tipo_entidad::text || ':' || v_previo.entidad_id::text,
    0
  ));

  select i.* into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;

  if v_intento.estado = 'publicado' then
    return jsonb_build_object(
      'resolution', 'already_applied',
      'attempt', private.intento_generacion_ia_json(p_intento_id),
      'job', (
        select to_jsonb(t)
        from public.trabajos_generacion_ia t
        where t.openai_response_id = v_intento.openai_response_id
      ),
      'entity', private.entidad_intento_ia_json(
        v_intento.tipo_entidad,
        v_intento.entidad_id
      )
    );
  end if;
  if v_intento.estado in ('fallido', 'expirado', 'obsoleto') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  if v_response_id is not null then
    if v_intento.openai_response_id is not null
       and v_intento.openai_response_id <> v_response_id then
      return jsonb_build_object(
        'resolution', 'claimed_elsewhere',
        'attempt', private.intento_generacion_ia_json(p_intento_id)
      );
    end if;
    if v_intento.openai_response_id is null then
      update private.intentos_generacion_ia i
      set estado = 'respuesta_vinculada',
          openai_response_id = v_response_id,
          estado_openai = coalesce(nullif(btrim(p_estado_openai), ''), 'queued'),
          iniciado_en = coalesce(p_iniciado_en, now()),
          actualizado_en = now()
      where i.id = p_intento_id
      returning * into v_intento;
    end if;
  end if;

  if v_intento.openai_response_id is null then
    raise exception using errcode = '55000', message = 'el intento todavía no tiene response_id';
  end if;
  if p_exigir_token and (
    p_token_reclamacion is null
    or v_intento.token_reclamacion is distinct from p_token_reclamacion
    or v_intento.reclamado_hasta <= now()
  ) then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  if v_intento.tipo_entidad = 'plan' then
    select
      p.meta_origen #>> '{ai,activeAttemptId}',
      exists (
        select 1 from public.estados_plan ep
        where ep.id = p.estado_actual_id and upper(ep.clave) = 'GENERANDO'
      )
    into v_active_attempt, v_estado_generando
    from public.planes_estudio p
    where p.id = v_intento.entidad_id;
  else
    select
      a.meta_origen #>> '{ai,activeAttemptId}',
      a.estado = 'generando'
    into v_active_attempt, v_estado_generando
    from public.asignaturas a
    where a.id = v_intento.entidad_id;
  end if;

  if v_active_attempt is distinct from v_intento.id::text
     or not coalesce(v_estado_generando, false) then
    update private.intentos_generacion_ia i
    set estado = 'obsoleto',
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null,
        actualizado_en = now(),
        ultimo_error = jsonb_build_object(
          'code', 'STALE_ATTEMPT',
          'message', 'La entidad ya no apunta a este intento.'
        )
    where i.id = p_intento_id;
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;

  begin
    v_usuario_id := (v_intento.contexto ->> 'userId')::uuid;
  exception when invalid_text_representation or null_value_not_allowed then
    raise exception using errcode = '22023', message = 'usuario durable no válido';
  end;
  select tm.tenant_id into v_tenant_id
  from public.tenant_memberships tm
  where tm.user_id = v_usuario_id
    and tm.is_default
  limit 1;
  if v_tenant_id is null then
    raise exception using
      errcode = '42501',
      message = 'el usuario no tiene tenant documental predeterminado';
  end if;

  if v_intento.tipo_entidad = 'plan' then
    update public.planes_estudio p
    set meta_origen = jsonb_set(
      coalesce(p.meta_origen, '{}'::jsonb),
      '{ai,responseId}',
      to_jsonb(v_intento.openai_response_id),
      true
    )
    where p.id = v_intento.entidad_id
      and p.meta_origen #>> '{ai,activeAttemptId}' = v_intento.id::text
    returning to_jsonb(p) into v_entidad;
  else
    update public.asignaturas a
    set meta_origen = jsonb_set(
      coalesce(a.meta_origen, '{}'::jsonb),
      '{ai,responseId}',
      to_jsonb(v_intento.openai_response_id),
      true
    )
    where a.id = v_intento.entidad_id
      and a.meta_origen #>> '{ai,activeAttemptId}' = v_intento.id::text
    returning to_jsonb(a) into v_entidad;
  end if;
  if v_entidad is null then
    raise exception using errcode = '55000', message = 'no se pudo publicar response_id en la entidad';
  end if;

  v_trabajo := public.registrar_trabajo_generacion_ia(
    v_intento.tipo_entidad,
    v_intento.entidad_id,
    v_intento.openai_response_id,
    coalesce(v_intento.estado_openai, 'queued'),
    coalesce(v_intento.iniciado_en, v_intento.creado_en),
    coalesce(v_intento.contexto, '{}'::jsonb) || jsonb_build_object(
      'source', 'entity-generation-attempt',
      'generationAttemptId', v_intento.id,
      'publishedAtomically', true
    )
  );

  if jsonb_typeof(v_intento.referencias) <> 'array'
     or v_intento.modo_referencias not in ('none', 'direct', 'retrieval') then
    raise exception using errcode = '22023', message = 'snapshot documental no válido';
  end if;
  v_conteo_referencias := jsonb_array_length(v_intento.referencias);
  if v_conteo_referencias > 5
     or ((v_intento.modo_referencias = 'none') <> (v_conteo_referencias = 0)) then
    raise exception using errcode = '22023', message = 'cantidad o modo de referencias no válido';
  end if;

  for v_referencia in
    select value from jsonb_array_elements(v_intento.referencias)
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
    v_scores := v_referencia -> 'scores';
    if v_file_id is null or v_file_version_id is null
       or exists (
         select 1 from jsonb_each(v_scores) score
         where jsonb_typeof(score.value) <> 'number'
       ) then
      raise exception using errcode = '22023', message = 'snapshot documental no válido';
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
    if v_intento.modo_referencias = 'direct'
       and (cardinality(v_chunk_ids) <> 0 or v_scores <> '{}'::jsonb) then
      raise exception using errcode = '22023', message = 'referencia directa no válida';
    end if;
    if v_intento.modo_referencias = 'retrieval' and (
      cardinality(v_chunk_ids) = 0
      or (select count(*) from jsonb_object_keys(v_scores)) <> cardinality(v_chunk_ids)
      or exists (
        select 1 from unnest(v_chunk_ids) chunk_id
        where not (v_scores ? chunk_id::text)
      )
    ) then
      raise exception using errcode = '22023', message = 'referencia recuperada no válida';
    end if;
    if cardinality(v_chunk_ids) <> (
      select count(distinct chunk_id) from unnest(v_chunk_ids) chunk_id
    ) then
      raise exception using errcode = '22023', message = 'hay chunks documentales duplicados';
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
      raise exception using errcode = '23503', message = 'un chunk no pertenece a la versión documental';
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
      v_intento.openai_response_id,
      case when v_intento.tipo_entidad = 'plan'
        then 'plan'::public.tipo_conversacion_documental
        else 'asignatura'::public.tipo_conversacion_documental
      end,
      v_intento.entidad_id,
      case when v_intento.tipo_entidad = 'plan'
        then 'plan'::public.tipo_conversacion_documental
        else 'asignatura'::public.tipo_conversacion_documental
      end,
      null,
      v_file_id,
      v_file_version_id,
      v_intento.modo_referencias,
      v_chunk_ids,
      case when v_intento.modo_referencias = 'retrieval'
        then v_intento.consulta_referencias
        else null
      end,
      v_scores
    )
    on conflict (request_id, file_version_id, mode) do nothing;

    if not exists (
      select 1
      from public.ai_request_references ar
      where ar.request_id = v_intento.openai_response_id
        and ar.conversation_id = v_intento.entidad_id
        and ar.file_id = v_file_id
        and ar.file_version_id = v_file_version_id
        and ar.mode = v_intento.modo_referencias
        and ar.chunk_ids = v_chunk_ids
        and ar.retrieval_query is not distinct from (
          case when v_intento.modo_referencias = 'retrieval'
            then v_intento.consulta_referencias else null end
        )
        and ar.retrieval_scores = v_scores
    ) then
      raise exception using
        errcode = '55000',
        message = 'el response_id ya contiene otra referencia documental';
    end if;
  end loop;

  if (
    select count(*) from public.ai_request_references ar
    where ar.request_id = v_intento.openai_response_id
  ) <> v_conteo_referencias then
    raise exception using
      errcode = '55000',
      message = 'el response_id contiene un conjunto documental diferente';
  end if;

  update private.intentos_generacion_ia i
  set estado = 'publicado',
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      publicado_en = coalesce(i.publicado_en, now()),
      actualizado_en = now(),
      ultimo_error = null
  where i.id = p_intento_id;

  return jsonb_build_object(
    'resolution', 'applied',
    'attempt', private.intento_generacion_ia_json(p_intento_id),
    'job', to_jsonb(v_trabajo),
    'entity', v_entidad
  );
end;
$$;

revoke all on function private.publicar_intento_entidad_ia_interno(
  uuid, uuid, boolean, text, text, timestamptz
) from public, anon, authenticated, service_role;

create or replace function public.publicar_intento_entidad_ia(
  p_intento_id uuid,
  p_token_reclamacion uuid
) returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.publicar_intento_entidad_ia_interno(
    p_intento_id,
    p_token_reclamacion,
    true,
    null,
    null,
    null
  );
$$;

create or replace function public.adoptar_publicar_intento_entidad_ia_webhook(
  p_intento_id uuid,
  p_openai_response_id text,
  p_estado_openai text,
  p_iniciado_en timestamptz default now()
) returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.publicar_intento_entidad_ia_interno(
    p_intento_id,
    null,
    false,
    p_openai_response_id,
    p_estado_openai,
    p_iniciado_en
  );
$$;

create or replace function private.proteger_publicacion_trabajo_entidad_ia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo_entidad = 'plan'
     and new.estado in ('pendiente', 'reclamado')
     and not exists (
       select 1 from public.planes_estudio p
       where p.id = new.entidad_id
         and p.meta_origen #>> '{ai,responseId}' = new.openai_response_id
     ) then
    raise exception using errcode = '55000', message = 'la respuesta del plan todavía no fue publicada';
  elsif new.tipo_entidad = 'asignatura'
     and new.estado in ('pendiente', 'reclamado')
     and not exists (
       select 1 from public.asignaturas a
       where a.id = new.entidad_id
         and a.meta_origen #>> '{ai,responseId}' = new.openai_response_id
     ) then
    raise exception using errcode = '55000', message = 'la respuesta de la asignatura todavía no fue publicada';
  end if;
  return new;
end;
$$;

revoke all on function private.proteger_publicacion_trabajo_entidad_ia()
from public, anon, authenticated;

drop trigger if exists trg_proteger_publicacion_trabajo_entidad_ia
  on public.trabajos_generacion_ia;
create trigger trg_proteger_publicacion_trabajo_entidad_ia
before insert or update of tipo_entidad, entidad_id, openai_response_id, estado
on public.trabajos_generacion_ia
for each row execute function private.proteger_publicacion_trabajo_entidad_ia();

create or replace function public.expirar_intentos_entidad_ia()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expirados integer := 0;
  v_estado_fallido uuid;
begin
  select ep.id into v_estado_fallido
  from public.estados_plan ep
  where upper(ep.clave) = 'FALLIDO'
  limit 1;

  with expirados as (
    update private.intentos_generacion_ia i
    set estado = 'expirado',
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null,
        actualizado_en = now(),
        ultimo_error = jsonb_build_object(
          'code', 'ENTITY_ATTEMPT_TIMEOUT',
          'message', 'La generación excedió el límite de 60 minutos.'
        )
    where i.handler in ('plan', 'subject')
      and i.estado in ('preparado', 'reclamado', 'respuesta_vinculada')
      and i.fecha_limite <= now()
    returning i.id, i.tipo_entidad, i.entidad_id
  ), planes as (
    update public.planes_estudio p
    set estado_actual_id = v_estado_fallido,
        meta_origen = jsonb_set(
          coalesce(p.meta_origen, '{}'::jsonb),
          '{ai,error}',
          jsonb_build_object(
            'code', 'ENTITY_ATTEMPT_TIMEOUT',
            'message', 'La generación excedió el límite de 60 minutos.'
          ),
          true
        )
    from expirados e
    where e.tipo_entidad = 'plan'
      and p.id = e.entidad_id
      and p.meta_origen #>> '{ai,activeAttemptId}' = e.id::text
    returning p.id
  ), asignaturas as (
    update public.asignaturas a
    set estado = 'fallida',
        meta_origen = jsonb_set(
          coalesce(a.meta_origen, '{}'::jsonb),
          '{ai,error}',
          jsonb_build_object(
            'code', 'ENTITY_ATTEMPT_TIMEOUT',
            'message', 'La generación excedió el límite de 60 minutos.'
          ),
          true
        )
    from expirados e
    where e.tipo_entidad = 'asignatura'
      and a.id = e.entidad_id
      and a.meta_origen #>> '{ai,activeAttemptId}' = e.id::text
    returning a.id
  )
  select count(*)::integer into v_expirados from expirados;

  return v_expirados;
end;
$$;

comment on function public.preparar_intento_entidad_ia(
  uuid, public.tipo_trabajo_generacion_ia, uuid, uuid, jsonb, jsonb,
  text, text, jsonb, text
) is
  'Prepara plan o asignatura y fija activeAttemptId en la misma transacción que el outbox genérico.';
comment on function public.publicar_intento_entidad_ia(uuid, uuid) is
  'Publica response_id, trabajo global, referencias y outbox con CAS de intento y arrendamiento.';
comment on function public.adoptar_publicar_intento_entidad_ia_webhook(
  uuid, text, text, timestamptz
) is
  'Permite que el webhook verificado vincule y publique el primer response_id de un intento activo.';

revoke all on function public.preparar_intento_entidad_ia(
  uuid, public.tipo_trabajo_generacion_ia, uuid, uuid, jsonb, jsonb,
  text, text, jsonb, text
) from public, anon, authenticated;
revoke all on function public.publicar_intento_entidad_ia(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.adoptar_publicar_intento_entidad_ia_webhook(
  uuid, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.expirar_intentos_entidad_ia()
from public, anon, authenticated;

grant execute on function public.preparar_intento_entidad_ia(
  uuid, public.tipo_trabajo_generacion_ia, uuid, uuid, jsonb, jsonb,
  text, text, jsonb, text
) to service_role;
grant execute on function public.publicar_intento_entidad_ia(uuid, uuid)
to service_role;
grant execute on function public.adoptar_publicar_intento_entidad_ia_webhook(
  uuid, text, text, timestamptz
) to service_role;
grant execute on function public.expirar_intentos_entidad_ia()
to service_role;
