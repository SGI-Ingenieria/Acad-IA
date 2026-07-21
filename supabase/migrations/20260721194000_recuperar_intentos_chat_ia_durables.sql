-- Outbox durable para cerrar la ventana entre crear una Response en OpenAI y
-- publicar su identificador en el mensaje. La tabla vive en `private`: nunca
-- expone un response_id parcial a clientes y sólo se opera mediante RPC
-- SECURITY DEFINER reservadas al service role.

create table private.intentos_chat_ia (
  id uuid primary key default gen_random_uuid(),
  tipo_conversacion public.tipo_conversacion_documental not null,
  conversacion_id uuid not null,
  mensaje_id uuid not null,
  usuario_id uuid not null,
  estado text not null default 'preparado'
    check (estado in (
      'preparado',
      'reclamado',
      'respuesta_vinculada',
      'publicado',
      'fallido',
      'expirado'
    )),
  solicitud jsonb not null,
  modo_referencias text not null default 'none'
    check (modo_referencias in ('none', 'direct', 'retrieval')),
  consulta_referencias text not null default '',
  referencias jsonb not null default '[]'::jsonb
    check (jsonb_typeof(referencias) = 'array'),
  openai_response_id text unique,
  estado_openai text,
  iniciado_en timestamptz,
  token_reclamacion uuid,
  reclamado_por text,
  reclamado_hasta timestamptz,
  intentos integer not null default 0 check (intentos >= 0),
  siguiente_intento timestamptz not null default now(),
  ultimo_error jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  publicado_en timestamptz,
  fecha_limite timestamptz not null default (now() + interval '60 minutes'),
  unique (tipo_conversacion, mensaje_id),
  check (jsonb_typeof(solicitud) = 'object'),
  check ((modo_referencias = 'none') = (jsonb_array_length(referencias) = 0)),
  check (
    (estado in ('respuesta_vinculada', 'publicado')) =
      (openai_response_id is not null)
    or estado in ('fallido', 'expirado')
  )
);

alter table private.intentos_chat_ia enable row level security;

create index intentos_chat_ia_recuperables_idx
  on private.intentos_chat_ia (siguiente_intento, creado_en)
  where estado in ('preparado', 'reclamado', 'respuesta_vinculada');

revoke all on table private.intentos_chat_ia
  from public, anon, authenticated, service_role;

create or replace function private.intento_chat_ia_json(
  p_intento_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(i)
  from private.intentos_chat_ia i
  where i.id = p_intento_id;
$$;

revoke all on function private.intento_chat_ia_json(uuid)
  from public, anon, authenticated, service_role;

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
  v_token uuid := gen_random_uuid();
  v_existente private.intentos_chat_ia;
begin
  if p_intento_id is null
     or p_conversacion_id is null
     or p_mensaje_id is null
     or p_usuario_id is null
     or nullif(btrim(coalesce(p_actor, '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'intento, conversación, mensaje, usuario y actor son requeridos';
  end if;
  if jsonb_typeof(coalesce(p_solicitud, 'null'::jsonb)) <> 'object'
     or nullif(btrim(p_solicitud ->> 'model'), '') is null
     or p_solicitud ->> 'background' is distinct from 'true'
     or jsonb_typeof(p_solicitud -> 'input') <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'la solicitud durable de OpenAI no es válida';
  end if;
  if jsonb_typeof(coalesce(p_referencias, 'null'::jsonb)) <> 'array'
     or p_modo_referencias not in ('none', 'direct', 'retrieval')
     or ((p_modo_referencias = 'none') <>
       (jsonb_array_length(p_referencias) = 0)) then
    raise exception using
      errcode = '22023',
      message = 'el snapshot documental durable no es válido';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_referencias) r(value)
    group by r.value ->> 'fileVersionId'
    having count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'hay versiones documentales duplicadas';
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

  insert into private.intentos_chat_ia (
    id,
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
    p_tipo_conversacion,
    p_conversacion_id,
    p_mensaje_id,
    p_usuario_id,
    'reclamado',
    p_solicitud,
    p_modo_referencias,
    coalesce(p_consulta_referencias, ''),
    p_referencias,
    v_token,
    p_actor,
    now() + interval '2 minutes',
    1
  )
  on conflict (id) do nothing;

  select *
  into v_existente
  from private.intentos_chat_ia i
  where i.id = p_intento_id;

  if v_existente.tipo_conversacion is distinct from p_tipo_conversacion
     or v_existente.conversacion_id is distinct from p_conversacion_id
     or v_existente.mensaje_id is distinct from p_mensaje_id
     or v_existente.usuario_id is distinct from p_usuario_id
     or v_existente.solicitud is distinct from p_solicitud
     or v_existente.modo_referencias is distinct from p_modo_referencias
     or v_existente.consulta_referencias is distinct from coalesce(p_consulta_referencias, '')
     or v_existente.referencias is distinct from p_referencias then
    raise exception using
      errcode = '23505',
      message = 'el identificador del intento ya corresponde a otra solicitud';
  end if;

  return private.intento_chat_ia_json(p_intento_id);
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
  select private.intento_chat_ia_json(p_intento_id);
$$;

create or replace function public.vincular_respuesta_intento_chat_ia(
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
  v_intento private.intentos_chat_ia;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
  v_resolution text;
begin
  if p_intento_id is null or p_token_reclamacion is null or v_response_id is null then
    raise exception using errcode = '22023', message = 'intento, token y response_id son requeridos';
  end if;

  select * into v_intento
  from private.intentos_chat_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'intento de chat no encontrado';
  end if;

  if v_intento.openai_response_id is not null then
    v_resolution := case
      when v_intento.openai_response_id = v_response_id then 'already_linked'
      else 'claimed_elsewhere'
    end;
    return jsonb_build_object(
      'resolution', v_resolution,
      'attempt', private.intento_chat_ia_json(p_intento_id)
    );
  end if;

  if v_intento.estado not in ('reclamado', 'preparado')
     or v_intento.token_reclamacion is distinct from p_token_reclamacion
     or v_intento.reclamado_hasta <= now() then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_chat_ia_json(p_intento_id)
    );
  end if;

  update private.intentos_chat_ia
  set estado = 'respuesta_vinculada',
      openai_response_id = v_response_id,
      estado_openai = coalesce(nullif(btrim(p_estado_openai), ''), 'queued'),
      iniciado_en = coalesce(p_iniciado_en, now()),
      actualizado_en = now()
  where id = p_intento_id;

  return jsonb_build_object(
    'resolution', 'linked',
    'attempt', private.intento_chat_ia_json(p_intento_id)
  );
end;
$$;

create or replace function private.publicar_intento_chat_ia_interno(
  p_intento_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intento private.intentos_chat_ia;
  v_trabajo public.trabajos_generacion_ia;
begin
  select * into v_intento
  from private.intentos_chat_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'intento de chat no encontrado';
  end if;
  if v_intento.estado = 'publicado' then
    return jsonb_build_object(
      'resolution', 'already_applied',
      'attempt', private.intento_chat_ia_json(p_intento_id),
      'job', (
        select to_jsonb(j)
        from public.trabajos_generacion_ia j
        where j.openai_response_id = v_intento.openai_response_id
      )
    );
  end if;
  if v_intento.estado in ('fallido', 'expirado') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_chat_ia_json(p_intento_id)
    );
  end if;
  if v_intento.openai_response_id is null then
    raise exception using errcode = '55000', message = 'el intento todavía no tiene response_id';
  end if;

  v_trabajo := public.publicar_solicitud_chat_ia(
    v_intento.tipo_conversacion,
    v_intento.conversacion_id,
    v_intento.mensaje_id,
    v_intento.usuario_id,
    v_intento.openai_response_id,
    coalesce(v_intento.estado_openai, 'queued'),
    coalesce(v_intento.iniciado_en, v_intento.creado_en),
    jsonb_build_object(
      'source', 'chat-attempt-outbox',
      'chatAttemptId', v_intento.id,
      'initiatedBy', v_intento.usuario_id
    ),
    v_intento.modo_referencias,
    v_intento.consulta_referencias,
    v_intento.referencias
  );

  update private.intentos_chat_ia
  set estado = 'publicado',
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null,
      actualizado_en = now(),
      publicado_en = coalesce(publicado_en, now()),
      ultimo_error = null
  where id = p_intento_id;

  return jsonb_build_object(
    'resolution', 'applied',
    'attempt', private.intento_chat_ia_json(p_intento_id),
    'job', to_jsonb(v_trabajo)
  );
end;
$$;

revoke all on function private.publicar_intento_chat_ia_interno(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.publicar_intento_chat_ia(
  p_intento_id uuid,
  p_token_reclamacion uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intento private.intentos_chat_ia;
begin
  select * into v_intento
  from private.intentos_chat_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'intento de chat no encontrado';
  end if;
  if v_intento.estado = 'publicado' then
    return private.publicar_intento_chat_ia_interno(p_intento_id);
  end if;
  if p_token_reclamacion is null
     or v_intento.token_reclamacion is distinct from p_token_reclamacion
     or v_intento.reclamado_hasta <= now() then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_chat_ia_json(p_intento_id)
    );
  end if;
  return private.publicar_intento_chat_ia_interno(p_intento_id);
end;
$$;

create or replace function public.adoptar_publicar_intento_chat_ia_webhook(
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
  v_intento private.intentos_chat_ia;
  v_response_id text := nullif(btrim(p_openai_response_id), '');
begin
  if p_intento_id is null or v_response_id is null then
    raise exception using errcode = '22023', message = 'intento y response_id son requeridos';
  end if;
  select * into v_intento
  from private.intentos_chat_ia i
  where i.id = p_intento_id
  for update;
  if not found then
    return jsonb_build_object('resolution', 'stale');
  end if;
  if v_intento.estado in ('fallido', 'expirado') then
    return jsonb_build_object(
      'resolution', 'stale',
      'attempt', private.intento_chat_ia_json(p_intento_id)
    );
  end if;
  if v_intento.openai_response_id is not null
     and v_intento.openai_response_id <> v_response_id then
    return jsonb_build_object(
      'resolution', 'claimed_elsewhere',
      'attempt', private.intento_chat_ia_json(p_intento_id)
    );
  end if;
  if v_intento.openai_response_id is null then
    update private.intentos_chat_ia
    set estado = 'respuesta_vinculada',
        openai_response_id = v_response_id,
        estado_openai = coalesce(nullif(btrim(p_estado_openai), ''), 'queued'),
        iniciado_en = coalesce(p_iniciado_en, now()),
        actualizado_en = now()
    where id = p_intento_id;
  end if;
  return private.publicar_intento_chat_ia_interno(p_intento_id);
end;
$$;

create or replace function public.reclamar_intentos_chat_ia(
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
  if nullif(btrim(coalesce(p_actor, '')), '') is null then
    raise exception using errcode = '22023', message = 'actor es requerido';
  end if;
  with candidatas as (
    select i.id
    from private.intentos_chat_ia i
    where i.estado in ('preparado', 'reclamado', 'respuesta_vinculada')
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
    update private.intentos_chat_ia i
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

create or replace function public.reprogramar_intento_chat_ia(
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
  update private.intentos_chat_ia i
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

create or replace function public.expirar_intentos_chat_ia()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expirados integer;
begin
  with expirados as (
    update private.intentos_chat_ia i
    set estado = 'expirado',
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null,
        ultimo_error = jsonb_build_object(
          'code', 'CHAT_ATTEMPT_TIMEOUT',
          'message', 'El intento de chat excedió el límite de 60 minutos.'
        ),
        actualizado_en = now()
    where i.estado in ('preparado', 'reclamado', 'respuesta_vinculada')
      and i.fecha_limite <= now()
    returning i.tipo_conversacion, i.mensaje_id, i.openai_response_id
  ), plan_error as (
    update public.plan_mensajes_ia m
    set estado = 'ERROR',
        respuesta = 'La generación excedió el tiempo máximo. Puedes reintentarlo.',
        propuesta = '{"recommendations":[]}'::jsonb,
        is_refusal = false,
        fecha_actualizacion = now()
    from expirados e
    where e.tipo_conversacion = 'plan'
      and m.id = e.mensaje_id
      and m.estado = 'PROCESANDO'
      and (m.openai_response_id is null or m.openai_response_id = e.openai_response_id)
    returning m.id
  ), asignatura_error as (
    update public.asignatura_mensajes_ia m
    set estado = 'ERROR',
        respuesta = 'La generación excedió el tiempo máximo. Puedes reintentarlo.',
        propuesta = '{"recommendations":[]}'::jsonb,
        is_refusal = false,
        fecha_actualizacion = now()
    from expirados e
    where e.tipo_conversacion = 'asignatura'
      and m.id = e.mensaje_id
      and m.estado = 'PROCESANDO'
      and (m.openai_response_id is null or m.openai_response_id = e.openai_response_id)
    returning m.id
  )
  select count(*)::integer into v_expirados from expirados;

  delete from private.intentos_chat_ia i
  where i.estado in ('publicado', 'fallido', 'expirado')
    and i.actualizado_en < now() - interval '90 days';

  return v_expirados;
end;
$$;

comment on table private.intentos_chat_ia is
  'Outbox privada que permite recuperar una creación de chat aunque la función caiga antes de publicar response_id.';
comment on function public.preparar_intento_chat_ia(
  uuid, public.tipo_conversacion_documental, uuid, uuid, uuid, jsonb,
  text, text, jsonb, text
) is
  'Persiste y reclama el snapshot completo antes de iniciar cualquier efecto remoto en OpenAI.';
comment on function public.vincular_respuesta_intento_chat_ia(
  uuid, uuid, text, text, timestamptz
) is
  'Vincula por CAS el primer response_id conocido al intento privado; nunca sustituye al ganador.';
comment on function public.publicar_intento_chat_ia(uuid, uuid) is
  'Publica mensaje, trabajo, referencias e intento en una sola transacción verificando el arrendamiento.';
comment on function public.adoptar_publicar_intento_chat_ia_webhook(
  uuid, text, text, timestamptz
) is
  'Permite al webhook verificado rescatar y publicar un intento cuyo iniciador cayó antes de guardar response_id.';

revoke all on function public.preparar_intento_chat_ia(
  uuid, public.tipo_conversacion_documental, uuid, uuid, uuid, jsonb,
  text, text, jsonb, text
) from public, anon, authenticated;
revoke all on function public.consultar_intento_chat_ia(uuid)
  from public, anon, authenticated;
revoke all on function public.vincular_respuesta_intento_chat_ia(
  uuid, uuid, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.publicar_intento_chat_ia(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.adoptar_publicar_intento_chat_ia_webhook(
  uuid, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.reclamar_intentos_chat_ia(text, integer)
  from public, anon, authenticated;
revoke all on function public.reprogramar_intento_chat_ia(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.expirar_intentos_chat_ia()
  from public, anon, authenticated;

grant execute on function public.preparar_intento_chat_ia(
  uuid, public.tipo_conversacion_documental, uuid, uuid, uuid, jsonb,
  text, text, jsonb, text
) to service_role;
grant execute on function public.consultar_intento_chat_ia(uuid)
  to service_role;
grant execute on function public.vincular_respuesta_intento_chat_ia(
  uuid, uuid, text, text, timestamptz
) to service_role;
grant execute on function public.publicar_intento_chat_ia(uuid, uuid)
  to service_role;
grant execute on function public.adoptar_publicar_intento_chat_ia_webhook(
  uuid, text, text, timestamptz
) to service_role;
grant execute on function public.reclamar_intentos_chat_ia(text, integer)
  to service_role;
grant execute on function public.reprogramar_intento_chat_ia(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.expirar_intentos_chat_ia()
  to service_role;
