-- Una respuesta background de chat sólo se vuelve visible para webhook,
-- polling y reconciliador cuando su bitácora y sus referencias ya existen.
-- La llamada HTTP a OpenAI ocurre antes de esta transacción.

create or replace function public.registrar_trabajo_generacion_ia(
  p_tipo_entidad public.tipo_trabajo_generacion_ia,
  p_entidad_id uuid,
  p_openai_response_id text,
  p_estado_openai text default 'queued',
  p_iniciado_en timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
) returns public.trabajos_generacion_ia
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trabajo public.trabajos_generacion_ia;
  v_response_vigente text;
begin
  if p_entidad_id is null or nullif(btrim(p_openai_response_id), '') is null then
    raise exception using
      errcode = '22023',
      message = 'entidad_id y openai_response_id son requeridos';
  end if;

  -- Serializa sólo el cambio de versión activa de una entidad. No cubre HTTP.
  perform pg_advisory_xact_lock(
    hashtextextended(p_tipo_entidad::text || ':' || p_entidad_id::text, 0)
  );

  v_response_vigente := private.openai_response_id_vigente_trabajo_ia(
    p_tipo_entidad,
    p_entidad_id
  );

  -- Un webhook puede llegar apenas OpenAI devuelve el response_id al iniciador.
  -- Mientras el mensaje no lo haya publicado, esa entrega no puede adoptar ni
  -- reclamar el trabajo. El cron lo encontrará después del commit atómico.
  if p_tipo_entidad in ('chat_plan', 'chat_asignatura')
     and v_response_vigente is null then
    raise exception using
      errcode = '55000',
      message = 'la respuesta de chat todavía no fue publicada';
  end if;

  if v_response_vigente is not null
     and v_response_vigente <> p_openai_response_id then
    insert into public.trabajos_generacion_ia (
      tipo_entidad,
      entidad_id,
      openai_response_id,
      estado,
      estado_openai,
      iniciado_en,
      fecha_limite,
      completado_en,
      ultimo_error,
      metadata
    ) values (
      p_tipo_entidad,
      p_entidad_id,
      p_openai_response_id,
      'obsoleto',
      p_estado_openai,
      coalesce(p_iniciado_en, now()),
      coalesce(p_iniciado_en, now()) + interval '60 minutes',
      now(),
      jsonb_build_object(
        'code', 'STALE_RESPONSE',
        'message', 'La entidad ya apunta a una respuesta más reciente.'
      ),
      coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (openai_response_id) do update
    set estado = case
          when public.trabajos_generacion_ia.estado in ('pendiente', 'reclamado')
            then 'obsoleto'::public.estado_trabajo_generacion_ia
          else public.trabajos_generacion_ia.estado
        end,
        estado_openai = coalesce(
          excluded.estado_openai,
          public.trabajos_generacion_ia.estado_openai
        ),
        completado_en = coalesce(
          public.trabajos_generacion_ia.completado_en,
          now()
        ),
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null,
        metadata = public.trabajos_generacion_ia.metadata || excluded.metadata
    where public.trabajos_generacion_ia.tipo_entidad = excluded.tipo_entidad
      and public.trabajos_generacion_ia.entidad_id = excluded.entidad_id
    returning * into v_trabajo;

    if v_trabajo.id is null then
      raise exception using
        errcode = '23505',
        message = 'openai_response_id ya pertenece a otra entidad';
    end if;
    return v_trabajo;
  end if;

  update public.trabajos_generacion_ia
  set estado = 'obsoleto',
      completado_en = coalesce(completado_en, now()),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      ultimo_error = jsonb_build_object(
        'code', 'SUPERSEDED',
        'message', 'Una respuesta más reciente sustituyó este trabajo.'
      )
  where tipo_entidad = p_tipo_entidad
    and entidad_id = p_entidad_id
    and openai_response_id <> p_openai_response_id
    and estado in ('pendiente', 'reclamado');

  insert into public.trabajos_generacion_ia (
    tipo_entidad,
    entidad_id,
    openai_response_id,
    estado_openai,
    iniciado_en,
    fecha_limite,
    metadata
  ) values (
    p_tipo_entidad,
    p_entidad_id,
    p_openai_response_id,
    p_estado_openai,
    coalesce(p_iniciado_en, now()),
    coalesce(p_iniciado_en, now()) + interval '60 minutes',
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (openai_response_id) do update
  set estado_openai = coalesce(
        excluded.estado_openai,
        public.trabajos_generacion_ia.estado_openai
      ),
      metadata = public.trabajos_generacion_ia.metadata || excluded.metadata
  where public.trabajos_generacion_ia.tipo_entidad = excluded.tipo_entidad
    and public.trabajos_generacion_ia.entidad_id = excluded.entidad_id
  returning * into v_trabajo;

  if v_trabajo.id is null then
    raise exception using
      errcode = '23505',
      message = 'openai_response_id ya pertenece a otra entidad';
  end if;

  return v_trabajo;
end;
$$;

create or replace function public.publicar_solicitud_chat_ia(
  p_tipo_conversacion public.tipo_conversacion_documental,
  p_conversacion_id uuid,
  p_mensaje_id uuid,
  p_usuario_id uuid,
  p_openai_response_id text,
  p_estado_openai text default 'queued',
  p_iniciado_en timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb,
  p_modo_referencias text default 'none',
  p_consulta_referencias text default '',
  p_referencias jsonb default '[]'::jsonb
) returns public.trabajos_generacion_ia
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo_trabajo public.tipo_trabajo_generacion_ia;
  v_conversacion_actual uuid;
  v_autor_actual uuid;
  v_estado_actual public.estado_mensaje_ia;
  v_response_actual text;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
  v_tenant_id uuid;
  v_referencia jsonb;
  v_file_id uuid;
  v_file_version_id uuid;
  v_chunk_ids uuid[];
  v_scores jsonb;
  v_conteo_referencias integer := jsonb_array_length(
    case when jsonb_typeof(p_referencias) = 'array' then p_referencias else '[]'::jsonb end
  );
  v_trabajo public.trabajos_generacion_ia;
begin
  if p_conversacion_id is null
     or p_mensaje_id is null
     or p_usuario_id is null
     or v_response_id is null then
    raise exception using
      errcode = '22023',
      message = 'conversación, mensaje, usuario y response_id son requeridos';
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

  if p_tipo_conversacion = 'plan' then
    select
      m.conversacion_plan_id,
      m.enviado_por,
      m.estado,
      m.openai_response_id
    into
      v_conversacion_actual,
      v_autor_actual,
      v_estado_actual,
      v_response_actual
    from public.plan_mensajes_ia m
    where m.id = p_mensaje_id
    for update;
    v_tipo_trabajo := 'chat_plan';
  elsif p_tipo_conversacion = 'asignatura' then
    select
      m.conversacion_asignatura_id,
      m.enviado_por,
      m.estado,
      m.openai_response_id
    into
      v_conversacion_actual,
      v_autor_actual,
      v_estado_actual,
      v_response_actual
    from public.asignatura_mensajes_ia m
    where m.id = p_mensaje_id
    for update;
    v_tipo_trabajo := 'chat_asignatura';
  else
    raise exception using errcode = '22023', message = 'tipo de conversación no válido';
  end if;

  if not found then
    raise exception using errcode = 'P0002', message = 'mensaje de chat no encontrado';
  end if;
  if v_conversacion_actual is distinct from p_conversacion_id then
    raise exception using errcode = '22023', message = 'el mensaje no pertenece a la conversación indicada';
  end if;
  if v_autor_actual is distinct from p_usuario_id then
    raise exception using errcode = '42501', message = 'el usuario no es autor del mensaje';
  end if;
  if v_estado_actual <> 'PROCESANDO' then
    raise exception using errcode = '55000', message = 'el mensaje ya no está procesando';
  end if;
  if v_response_actual is not null and v_response_actual <> v_response_id then
    raise exception using
      errcode = '55000',
      message = 'el mensaje ya apunta a otra respuesta de OpenAI';
  end if;

  select tm.tenant_id
  into v_tenant_id
  from public.tenant_memberships tm
  where tm.user_id = p_usuario_id
    and tm.is_default
  limit 1;
  if v_tenant_id is null then
    raise exception using errcode = '42501', message = 'el usuario no tiene tenant documental predeterminado';
  end if;

  if p_tipo_conversacion = 'plan' then
    update public.plan_mensajes_ia
    set openai_response_id = v_response_id,
        fecha_actualizacion = now()
    where id = p_mensaje_id;
  else
    update public.asignatura_mensajes_ia
    set openai_response_id = v_response_id,
        fecha_actualizacion = now()
    where id = p_mensaje_id;
  end if;

  v_trabajo := public.registrar_trabajo_generacion_ia(
    v_tipo_trabajo,
    p_mensaje_id,
    v_response_id,
    p_estado_openai,
    coalesce(p_iniciado_en, now()),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'initiatedBy', p_usuario_id,
      'publishedAtomically', true
    )
  );

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

    if p_modo_referencias = 'direct' and cardinality(v_chunk_ids) <> 0 then
      raise exception using errcode = '22023', message = 'una referencia directa no contiene chunks';
    end if;
    if p_modo_referencias = 'retrieval' and cardinality(v_chunk_ids) = 0 then
      raise exception using errcode = '22023', message = 'una referencia recuperada requiere chunks';
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
      v_response_id,
      p_tipo_conversacion,
      p_conversacion_id,
      p_tipo_conversacion,
      p_mensaje_id,
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
        and ar.conversation_type = p_tipo_conversacion
        and ar.conversation_id = p_conversacion_id
        and ar.message_type = p_tipo_conversacion
        and ar.message_id = p_mensaje_id
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

    insert into public.conversation_files (
      tenant_id,
      conversation_type,
      conversation_id,
      file_id,
      added_by,
      removed_at
    ) values (
      v_tenant_id,
      p_tipo_conversacion,
      p_conversacion_id,
      v_file_id,
      p_usuario_id,
      null
    )
    on conflict (conversation_type, conversation_id, file_id) do update
    set tenant_id = excluded.tenant_id,
        added_by = excluded.added_by,
        removed_at = null;
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

  return v_trabajo;
end;
$$;

comment on function public.publicar_solicitud_chat_ia(
  public.tipo_conversacion_documental,
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  jsonb,
  text,
  text,
  jsonb
) is
  'Publica response_id, trabajo y snapshot documental de un chat en una sola transacción.';

revoke all on function public.publicar_solicitud_chat_ia(
  public.tipo_conversacion_documental,
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  jsonb,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.publicar_solicitud_chat_ia(
  public.tipo_conversacion_documental,
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  jsonb,
  text,
  text,
  jsonb
) to service_role;
