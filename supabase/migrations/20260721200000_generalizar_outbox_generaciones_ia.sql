-- Generaliza el núcleo durable. Los handlers conservan sus propias reglas de
-- publicación atómica, pero comparten identidad, CAS de response_id,
-- arrendamientos, backoff y obsolescencia por entidad.

alter table private.intentos_chat_ia
  rename to intentos_generacion_ia;

alter table private.intentos_generacion_ia
  add column tipo_entidad public.tipo_trabajo_generacion_ia,
  add column entidad_id uuid,
  add column handler text,
  add column payload_version integer not null default 1,
  add column contexto jsonb not null default '{}'::jsonb;

update private.intentos_generacion_ia
set tipo_entidad = case tipo_conversacion
      when 'plan' then 'chat_plan'::public.tipo_trabajo_generacion_ia
      else 'chat_asignatura'::public.tipo_trabajo_generacion_ia
    end,
    entidad_id = mensaje_id,
    handler = 'chat',
    contexto = jsonb_build_object(
      'conversationType', tipo_conversacion,
      'conversationId', conversacion_id,
      'messageId', mensaje_id,
      'userId', usuario_id
    );

alter table private.intentos_generacion_ia
  alter column tipo_entidad set not null,
  alter column entidad_id set not null,
  alter column handler set not null,
  alter column tipo_conversacion drop not null,
  alter column conversacion_id drop not null,
  alter column mensaje_id drop not null,
  alter column usuario_id drop not null,
  drop constraint intentos_chat_ia_tipo_conversacion_mensaje_id_key,
  drop constraint intentos_chat_ia_estado_check,
  drop constraint intentos_chat_ia_check1;

alter table private.intentos_generacion_ia
  add constraint intentos_generacion_ia_estado_check
    check (estado in (
      'preparado',
      'reclamado',
      'respuesta_vinculada',
      'publicado',
      'fallido',
      'expirado',
      'obsoleto'
    )),
  add constraint intentos_generacion_ia_response_check
    check (
      ((estado in ('respuesta_vinculada', 'publicado')) =
        (openai_response_id is not null))
      or estado in ('fallido', 'expirado', 'obsoleto')
    ),
  add constraint intentos_generacion_ia_payload_version_check
    check (payload_version > 0),
  add constraint intentos_generacion_ia_contexto_check
    check (jsonb_typeof(contexto) = 'object'),
  add constraint intentos_generacion_ia_chat_contexto_check
    check (
      handler <> 'chat'
      or (
        tipo_conversacion is not null
        and conversacion_id is not null
        and mensaje_id is not null
        and usuario_id is not null
      )
    );

drop index if exists private.intentos_chat_ia_recuperables_idx;
create index intentos_generacion_ia_recuperables_idx
  on private.intentos_generacion_ia (
    handler, siguiente_intento, creado_en
  )
  where estado in ('preparado', 'reclamado', 'respuesta_vinculada');

create unique index intentos_generacion_ia_entidad_activa_idx
  on private.intentos_generacion_ia (handler, tipo_entidad, entidad_id)
  where estado in ('preparado', 'reclamado', 'respuesta_vinculada');

revoke all on table private.intentos_generacion_ia
  from public, anon, authenticated, service_role;

-- Compatibilidad interna para el handler de chat existente. No se concede
-- acceso a ningún rol de API.
create view private.intentos_chat_ia
with (security_invoker = true)
as
select *
from private.intentos_generacion_ia
where handler = 'chat';

revoke all on table private.intentos_chat_ia
  from public, anon, authenticated, service_role;

create or replace function private.intento_generacion_ia_json(
  p_intento_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(i)
  from private.intentos_generacion_ia i
  where i.id = p_intento_id;
$$;

revoke all on function private.intento_generacion_ia_json(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.preparar_intento_generacion_ia(
  p_intento_id uuid,
  p_tipo_entidad public.tipo_trabajo_generacion_ia,
  p_entidad_id uuid,
  p_handler text,
  p_payload_version integer,
  p_contexto jsonb,
  p_solicitud jsonb,
  p_modo_referencias text default 'none',
  p_consulta_referencias text default '',
  p_referencias jsonb default '[]'::jsonb,
  p_actor text default 'edge-function'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existente private.intentos_generacion_ia;
  v_tipo_conversacion public.tipo_conversacion_documental;
  v_conversacion_id uuid;
  v_mensaje_id uuid;
  v_usuario_id uuid;
begin
  if p_intento_id is null
     or p_entidad_id is null
     or nullif(btrim(coalesce(p_handler, '')), '') is null
     or coalesce(p_payload_version, 0) <= 0
     or nullif(btrim(coalesce(p_actor, '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'intento, entidad, handler, versión y actor son requeridos';
  end if;
  if jsonb_typeof(coalesce(p_contexto, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_solicitud, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_referencias, 'null'::jsonb)) <> 'array'
     or p_modo_referencias not in ('none', 'direct', 'retrieval')
     or ((p_modo_referencias = 'none') <>
       (jsonb_array_length(p_referencias) = 0)) then
    raise exception using
      errcode = '22023',
      message = 'el payload durable no es válido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_handler || ':' || p_tipo_entidad::text || ':' || p_entidad_id::text,
    0
  ));

  select * into v_existente
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;

  if found then
    if v_existente.tipo_entidad is distinct from p_tipo_entidad
       or v_existente.entidad_id is distinct from p_entidad_id
       or v_existente.handler is distinct from p_handler
       or v_existente.payload_version is distinct from p_payload_version
       or v_existente.contexto is distinct from p_contexto
       or v_existente.solicitud is distinct from p_solicitud
       or v_existente.modo_referencias is distinct from p_modo_referencias
       or v_existente.consulta_referencias is distinct from coalesce(p_consulta_referencias, '')
       or v_existente.referencias is distinct from p_referencias then
      raise exception using
        errcode = '23505',
        message = 'el identificador del intento ya corresponde a otro payload';
    end if;
    return private.intento_generacion_ia_json(p_intento_id);
  end if;

  update private.intentos_generacion_ia i
  set estado = 'obsoleto',
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      actualizado_en = now(),
      ultimo_error = jsonb_build_object(
        'code', 'SUPERSEDED_ATTEMPT',
        'message', 'Un intento más reciente sustituyó este payload.'
      )
  where i.handler = p_handler
    and i.tipo_entidad = p_tipo_entidad
    and i.entidad_id = p_entidad_id
    and i.estado in ('preparado', 'reclamado', 'respuesta_vinculada');

  if p_handler = 'chat' then
    begin
      v_tipo_conversacion := (p_contexto ->> 'conversationType')::public.tipo_conversacion_documental;
      v_conversacion_id := (p_contexto ->> 'conversationId')::uuid;
      v_mensaje_id := (p_contexto ->> 'messageId')::uuid;
      v_usuario_id := (p_contexto ->> 'userId')::uuid;
    exception when invalid_text_representation or null_value_not_allowed then
      raise exception using
        errcode = '22023',
        message = 'el contexto durable del chat no es válido';
    end;
    if v_mensaje_id is distinct from p_entidad_id then
      raise exception using
        errcode = '22023',
        message = 'la entidad del intento no coincide con el mensaje';
    end if;
  end if;

  insert into private.intentos_generacion_ia (
    id,
    tipo_entidad,
    entidad_id,
    handler,
    payload_version,
    contexto,
    tipo_conversacion,
    conversacion_id,
    mensaje_id,
    usuario_id,
    estado,
    solicitud,
    modo_referencias,
    consulta_referencias,
    referencias,
    token_reclamacion,
    reclamado_por,
    reclamado_hasta,
    intentos
  ) values (
    p_intento_id,
    p_tipo_entidad,
    p_entidad_id,
    p_handler,
    p_payload_version,
    p_contexto,
    v_tipo_conversacion,
    v_conversacion_id,
    v_mensaje_id,
    v_usuario_id,
    'reclamado',
    p_solicitud,
    p_modo_referencias,
    coalesce(p_consulta_referencias, ''),
    p_referencias,
    gen_random_uuid(),
    p_actor,
    now() + interval '2 minutes',
    1
  );

  return private.intento_generacion_ia_json(p_intento_id);
end;
$$;

create or replace function public.consultar_intento_generacion_ia(
  p_intento_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.intento_generacion_ia_json(p_intento_id);
$$;

create or replace function public.vincular_respuesta_intento_generacion_ia(
  p_intento_id uuid,
  p_token_reclamacion uuid,
  p_openai_response_id text,
  p_estado_openai text default 'queued',
  p_iniciado_en timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intento private.intentos_generacion_ia;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
begin
  if p_intento_id is null or p_token_reclamacion is null or v_response_id is null then
    raise exception using errcode = '22023', message = 'intento, token y response_id son requeridos';
  end if;
  select * into v_intento
  from private.intentos_generacion_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'intento de generación no encontrado';
  end if;
  if v_intento.openai_response_id is not null then
    return jsonb_build_object(
      'resolution', case
        when v_intento.openai_response_id = v_response_id then 'already_linked'
        else 'claimed_elsewhere'
      end,
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  if v_intento.estado not in ('reclamado', 'preparado')
     or v_intento.token_reclamacion is distinct from p_token_reclamacion
     or v_intento.reclamado_hasta <= now() then
    return jsonb_build_object(
      'resolution', case when v_intento.estado = 'obsoleto' then 'stale' else 'claimed_elsewhere' end,
      'attempt', private.intento_generacion_ia_json(p_intento_id)
    );
  end if;
  update private.intentos_generacion_ia
  set estado = 'respuesta_vinculada',
      openai_response_id = v_response_id,
      estado_openai = coalesce(nullif(btrim(p_estado_openai), ''), 'queued'),
      iniciado_en = coalesce(p_iniciado_en, now()),
      actualizado_en = now()
  where id = p_intento_id;
  return jsonb_build_object(
    'resolution', 'linked',
    'attempt', private.intento_generacion_ia_json(p_intento_id)
  );
end;
$$;

create or replace function public.reclamar_intentos_generacion_ia(
  p_handler text,
  p_actor text,
  p_limite integer default 5
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultado jsonb;
begin
  if nullif(btrim(coalesce(p_handler, '')), '') is null
     or nullif(btrim(coalesce(p_actor, '')), '') is null then
    raise exception using errcode = '22023', message = 'handler y actor son requeridos';
  end if;
  with candidatas as (
    select i.id
    from private.intentos_generacion_ia i
    where i.handler = p_handler
      and i.estado in ('preparado', 'reclamado', 'respuesta_vinculada')
      and i.siguiente_intento <= now()
      and i.fecha_limite > now()
      and (
        i.estado = 'preparado'
        or i.reclamado_hasta is null
        or i.reclamado_hasta <= now()
      )
    order by i.siguiente_intento, i.creado_en
    for update skip locked
    limit greatest(1, least(coalesce(p_limite, 5), 20))
  ), reclamadas as (
    update private.intentos_generacion_ia i
    set estado = case
          when i.openai_response_id is null then 'reclamado'
          else 'respuesta_vinculada'
        end,
        token_reclamacion = gen_random_uuid(),
        reclamado_por = p_actor,
        reclamado_hasta = now() + interval '2 minutes',
        intentos = i.intentos + 1,
        actualizado_en = now()
    from candidatas c
    where i.id = c.id
    returning to_jsonb(i) as value
  )
  select coalesce(jsonb_agg(value), '[]'::jsonb)
  into v_resultado
  from reclamadas;
  return v_resultado;
end;
$$;

create or replace function public.reprogramar_intento_generacion_ia(
  p_intento_id uuid,
  p_token_reclamacion uuid,
  p_error jsonb default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actualizado integer;
begin
  update private.intentos_generacion_ia i
  set estado = case
        when i.openai_response_id is null then 'preparado'
        else 'respuesta_vinculada'
      end,
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      siguiente_intento = now() + make_interval(
        secs => least(300, 30 * (2 ^ least(greatest(i.intentos - 1, 0), 4))::integer)
      ),
      ultimo_error = p_error,
      actualizado_en = now()
  where i.id = p_intento_id
    and i.token_reclamacion = p_token_reclamacion
    and i.estado in ('reclamado', 'respuesta_vinculada');
  get diagnostics v_actualizado = row_count;
  return v_actualizado = 1;
end;
$$;

create or replace function public.marcar_intento_generacion_ia_publicado(
  p_intento_id uuid,
  p_token_reclamacion uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actualizado integer;
begin
  update private.intentos_generacion_ia i
  set estado = 'publicado',
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      publicado_en = coalesce(i.publicado_en, now()),
      actualizado_en = now(),
      ultimo_error = null
  where i.id = p_intento_id
    and i.openai_response_id is not null
    and (
      i.estado = 'publicado'
      or (
        i.estado = 'respuesta_vinculada'
        and i.token_reclamacion = p_token_reclamacion
        and i.reclamado_hasta > now()
      )
    );
  get diagnostics v_actualizado = row_count;
  return v_actualizado = 1;
end;
$$;

-- Adaptadores de compatibilidad del handler chat.
create or replace function public.preparar_intento_chat_ia(
  p_intento_id uuid,
  p_tipo_conversacion public.tipo_conversacion_documental,
  p_conversacion_id uuid,
  p_mensaje_id uuid,
  p_usuario_id uuid,
  p_solicitud jsonb,
  p_modo_referencias text default 'none',
  p_consulta_referencias text default '',
  p_referencias jsonb default '[]'::jsonb,
  p_actor text default 'create-chat-conversation'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversacion_actual uuid;
  v_autor_actual uuid;
  v_estado_actual public.estado_mensaje_ia;
  v_response_actual text;
  v_tipo_entidad public.tipo_trabajo_generacion_ia;
begin
  if p_intento_id is null
     or p_conversacion_id is null
     or p_mensaje_id is null
     or p_usuario_id is null then
    raise exception using errcode = '22023', message = 'intento y contexto de chat son requeridos';
  end if;
  if jsonb_typeof(coalesce(p_solicitud, 'null'::jsonb)) <> 'object'
     or nullif(btrim(p_solicitud ->> 'model'), '') is null
     or p_solicitud ->> 'background' is distinct from 'true'
     or jsonb_typeof(p_solicitud -> 'input') <> 'array' then
    raise exception using errcode = '22023', message = 'la solicitud durable de OpenAI no es válida';
  end if;

  if p_tipo_conversacion = 'plan' then
    select m.conversacion_plan_id, m.enviado_por, m.estado, m.openai_response_id
    into v_conversacion_actual, v_autor_actual, v_estado_actual, v_response_actual
    from public.plan_mensajes_ia m
    where m.id = p_mensaje_id
    for update;
    v_tipo_entidad := 'chat_plan';
  elsif p_tipo_conversacion = 'asignatura' then
    select m.conversacion_asignatura_id, m.enviado_por, m.estado, m.openai_response_id
    into v_conversacion_actual, v_autor_actual, v_estado_actual, v_response_actual
    from public.asignatura_mensajes_ia m
    where m.id = p_mensaje_id
    for update;
    v_tipo_entidad := 'chat_asignatura';
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
  if v_estado_actual <> 'PROCESANDO' or v_response_actual is not null then
    raise exception using errcode = '55000', message = 'el mensaje ya no admite un intento nuevo';
  end if;

  return public.preparar_intento_generacion_ia(
    p_intento_id,
    v_tipo_entidad,
    p_mensaje_id,
    'chat',
    1,
    jsonb_build_object(
      'conversationType', p_tipo_conversacion,
      'conversationId', p_conversacion_id,
      'messageId', p_mensaje_id,
      'userId', p_usuario_id
    ),
    p_solicitud,
    p_modo_referencias,
    coalesce(p_consulta_referencias, ''),
    p_referencias,
    p_actor
  );
end;
$$;

create or replace function public.consultar_intento_chat_ia(
  p_intento_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.consultar_intento_generacion_ia(p_intento_id);
$$;

create or replace function public.vincular_respuesta_intento_chat_ia(
  p_intento_id uuid,
  p_token_reclamacion uuid,
  p_openai_response_id text,
  p_estado_openai text default 'queued',
  p_iniciado_en timestamptz default now()
) returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.vincular_respuesta_intento_generacion_ia(
    p_intento_id,
    p_token_reclamacion,
    p_openai_response_id,
    p_estado_openai,
    p_iniciado_en
  );
$$;

create or replace function public.reclamar_intentos_chat_ia(
  p_actor text,
  p_limite integer default 5
) returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.reclamar_intentos_generacion_ia('chat', p_actor, p_limite);
$$;

create or replace function public.reprogramar_intento_chat_ia(
  p_intento_id uuid,
  p_token_reclamacion uuid,
  p_error jsonb default null
) returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.reprogramar_intento_generacion_ia(
    p_intento_id,
    p_token_reclamacion,
    p_error
  );
$$;

comment on table private.intentos_generacion_ia is
  'Outbox genérico y privado para efectos remotos de IA recuperables por handler y versión de payload.';
comment on function public.preparar_intento_generacion_ia(
  uuid, public.tipo_trabajo_generacion_ia, uuid, text, integer, jsonb,
  jsonb, text, text, jsonb, text
) is
  'Prepara un intento versionado, serializa por entidad y vuelve obsoleto cualquier intento activo anterior.';

revoke all on function public.preparar_intento_generacion_ia(
  uuid, public.tipo_trabajo_generacion_ia, uuid, text, integer, jsonb,
  jsonb, text, text, jsonb, text
) from public, anon, authenticated;
revoke all on function public.consultar_intento_generacion_ia(uuid)
  from public, anon, authenticated;
revoke all on function public.vincular_respuesta_intento_generacion_ia(
  uuid, uuid, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.reclamar_intentos_generacion_ia(text, text, integer)
  from public, anon, authenticated;
revoke all on function public.reprogramar_intento_generacion_ia(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.marcar_intento_generacion_ia_publicado(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.preparar_intento_generacion_ia(
  uuid, public.tipo_trabajo_generacion_ia, uuid, text, integer, jsonb,
  jsonb, text, text, jsonb, text
) to service_role;
grant execute on function public.consultar_intento_generacion_ia(uuid)
  to service_role;
grant execute on function public.vincular_respuesta_intento_generacion_ia(
  uuid, uuid, text, text, timestamptz
) to service_role;
grant execute on function public.reclamar_intentos_generacion_ia(text, text, integer)
  to service_role;
grant execute on function public.reprogramar_intento_generacion_ia(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.marcar_intento_generacion_ia_publicado(uuid, uuid)
  to service_role;
