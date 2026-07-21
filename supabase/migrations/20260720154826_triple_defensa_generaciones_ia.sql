-- Triple defensa para respuestas asíncronas de OpenAI.
-- Las reclamaciones son transacciones cortas; ninguna RPC mantiene bloqueos
-- mientras un worker consulta a OpenAI.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'tipo_trabajo_generacion_ia'
  ) then
    create type public.tipo_trabajo_generacion_ia as enum (
      'plan',
      'asignatura',
      'chat_plan',
      'chat_asignatura',
      'recursos_aprendizaje',
      'observabilidad'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'estado_trabajo_generacion_ia'
  ) then
    create type public.estado_trabajo_generacion_ia as enum (
      'pendiente',
      'reclamado',
      'completado',
      'fallido',
      'cancelado',
      'incompleto',
      'expirado',
      'obsoleto'
    );
  end if;
end $$;

create table public.trabajos_generacion_ia (
  id uuid primary key default gen_random_uuid(),
  tipo_entidad public.tipo_trabajo_generacion_ia not null,
  entidad_id uuid not null,
  openai_response_id text not null unique,
  estado public.estado_trabajo_generacion_ia not null default 'pendiente',
  estado_openai text,
  token_reclamacion uuid,
  reclamado_por text,
  reclamado_hasta timestamptz,
  intentos integer not null default 0 check (intentos >= 0),
  proxima_revision_en timestamptz not null default now(),
  ultimo_error jsonb,
  metadata jsonb not null default '{}'::jsonb,
  cancelacion_solicitada_en timestamptz,
  iniciado_en timestamptz not null default now(),
  fecha_limite timestamptz not null default (now() + interval '60 minutes'),
  completado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint trabajos_generacion_ia_response_id_no_vacio
    check (btrim(openai_response_id) <> ''),
  constraint trabajos_generacion_ia_entidad_response_unique
    unique (tipo_entidad, entidad_id, openai_response_id),
  constraint trabajos_generacion_ia_reclamacion_consistente
    check (
      (estado = 'reclamado' and token_reclamacion is not null
        and reclamado_por is not null and reclamado_hasta is not null)
      or
      (estado <> 'reclamado' and token_reclamacion is null
        and reclamado_por is null and reclamado_hasta is null)
    ),
  constraint trabajos_generacion_ia_fecha_limite_valida
    check (fecha_limite >= iniciado_en)
);

comment on table public.trabajos_generacion_ia is
  'Bitácora operacional privada y cola con arrendamientos para respuestas asíncronas de OpenAI.';

create unique index trabajos_generacion_ia_entidad_activa_idx
  on public.trabajos_generacion_ia (tipo_entidad, entidad_id)
  where estado in ('pendiente', 'reclamado');

create index trabajos_generacion_ia_cola_idx
  on public.trabajos_generacion_ia (proxima_revision_en, creado_en)
  where estado in ('pendiente', 'reclamado');

create index trabajos_generacion_ia_arrendamientos_idx
  on public.trabajos_generacion_ia (reclamado_hasta)
  where estado = 'reclamado';

create index trabajos_generacion_ia_terminales_idx
  on public.trabajos_generacion_ia (completado_en)
  where estado in (
    'completado', 'fallido', 'cancelado', 'incompleto', 'expirado', 'obsoleto'
  );

drop trigger if exists trg_trabajos_generacion_ia_actualizado_en
  on public.trabajos_generacion_ia;
create trigger trg_trabajos_generacion_ia_actualizado_en
before update on public.trabajos_generacion_ia
for each row execute function public.set_actualizado_en();

alter table public.trabajos_generacion_ia enable row level security;
revoke all on table public.trabajos_generacion_ia from public, anon, authenticated;
grant select, insert, update, delete on table public.trabajos_generacion_ia
  to service_role;

create table public.ejecuciones_recuperacion_ia (
  id uuid primary key default gen_random_uuid(),
  iniciado_en timestamptz not null default now(),
  completado_en timestamptz,
  descubiertos integer not null default 0 check (descubiertos >= 0),
  reclamados integer not null default 0 check (reclamados >= 0),
  completados integer not null default 0 check (completados >= 0),
  reprogramados integer not null default 0 check (reprogramados >= 0),
  fallidos integer not null default 0 check (fallidos >= 0),
  error text,
  metadata jsonb not null default '{}'::jsonb
);

create index ejecuciones_recuperacion_ia_iniciado_en_idx
  on public.ejecuciones_recuperacion_ia (iniciado_en desc);

alter table public.ejecuciones_recuperacion_ia enable row level security;
revoke all on table public.ejecuciones_recuperacion_ia
  from public, anon, authenticated;
grant select, insert, update, delete on table public.ejecuciones_recuperacion_ia
  to service_role;

alter table public.observability_webhook_events
  add column if not exists delivery_count integer not null default 1
    check (delivery_count > 0),
  add column if not exists last_received_at timestamptz not null default now();

create or replace function public.registrar_entrega_webhook_ia(
  p_event_id text,
  p_event_type text,
  p_openai_response_id text,
  p_test_run_id uuid,
  p_payload jsonb
) returns public.observability_webhook_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento public.observability_webhook_events;
begin
  insert into public.observability_webhook_events (
    event_id,
    event_type,
    openai_response_id,
    test_run_id,
    received_at,
    last_received_at,
    delivery_count,
    signature_valid,
    payload,
    processing_status,
    processing_error
  ) values (
    p_event_id,
    p_event_type,
    p_openai_response_id,
    p_test_run_id,
    now(),
    now(),
    1,
    true,
    coalesce(p_payload, '{}'::jsonb),
    'received',
    null
  )
  on conflict (event_id) do update
  set last_received_at = now(),
      delivery_count = public.observability_webhook_events.delivery_count + 1,
      payload = excluded.payload,
      processing_status = 'received',
      processing_error = null
  returning * into v_evento;
  return v_evento;
end;
$$;

create or replace function private.openai_response_id_vigente_trabajo_ia(
  p_tipo public.tipo_trabajo_generacion_ia,
  p_entidad_id uuid
) returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_response_id text;
begin
  case p_tipo
    when 'plan' then
      select p.meta_origen #>> '{ai,responseId}' into v_response_id
      from public.planes_estudio p where p.id = p_entidad_id;
    when 'asignatura' then
      select a.meta_origen #>> '{ai,responseId}' into v_response_id
      from public.asignaturas a where a.id = p_entidad_id;
    when 'chat_plan' then
      select m.openai_response_id into v_response_id
      from public.plan_mensajes_ia m where m.id = p_entidad_id;
    when 'chat_asignatura' then
      select m.openai_response_id into v_response_id
      from public.asignatura_mensajes_ia m where m.id = p_entidad_id;
    when 'recursos_aprendizaje' then
      select j.openai_response_id into v_response_id
      from public.learning_generation_jobs j where j.id = p_entidad_id;
    when 'observabilidad' then
      select o.openai_response_id into v_response_id
      from public.observability_test_runs o where o.id = p_entidad_id;
  end case;

  return v_response_id;
end;
$$;

revoke all on function private.openai_response_id_vigente_trabajo_ia(
  public.tipo_trabajo_generacion_ia, uuid
) from public, anon, authenticated;
grant execute on function private.openai_response_id_vigente_trabajo_ia(
  public.tipo_trabajo_generacion_ia, uuid
) to service_role;

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
  set estado_openai = coalesce(excluded.estado_openai, public.trabajos_generacion_ia.estado_openai),
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

create or replace function public.reclamar_trabajo_generacion_ia(
  p_openai_response_id text,
  p_reclamado_por text,
  p_arrendamiento interval default interval '2 minutes'
) returns public.trabajos_generacion_ia
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trabajo public.trabajos_generacion_ia;
begin
  if nullif(btrim(p_reclamado_por), '') is null
     or p_arrendamiento <= interval '0 seconds'
     or p_arrendamiento > interval '10 minutes' then
    raise exception using errcode = '22023', message = 'Reclamación inválida';
  end if;

  update public.trabajos_generacion_ia t
  set estado = 'reclamado',
      token_reclamacion = gen_random_uuid(),
      reclamado_por = p_reclamado_por,
      reclamado_hasta = now() + p_arrendamiento,
      intentos = t.intentos + 1
  where t.id = (
    select q.id
    from public.trabajos_generacion_ia q
    where q.openai_response_id = p_openai_response_id
      and q.fecha_limite > now()
      and (
        q.estado = 'pendiente'
        or (q.estado = 'reclamado' and q.reclamado_hasta <= now())
      )
    for update skip locked
  )
  returning t.* into v_trabajo;

  return v_trabajo;
end;
$$;

create or replace function public.reclamar_lote_trabajos_generacion_ia(
  p_reclamado_por text,
  p_limite integer default 20,
  p_arrendamiento interval default interval '2 minutes'
) returns setof public.trabajos_generacion_ia
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(p_reclamado_por), '') is null
     or p_limite < 1 or p_limite > 100
     or p_arrendamiento <= interval '0 seconds'
     or p_arrendamiento > interval '10 minutes' then
    raise exception using errcode = '22023', message = 'Lote de reclamación inválido';
  end if;

  return query
  with seleccionados as (
    select q.id
    from public.trabajos_generacion_ia q
    where q.fecha_limite > now()
      and (
        (q.estado = 'pendiente' and q.proxima_revision_en <= now())
        or (q.estado = 'reclamado' and q.reclamado_hasta <= now())
      )
    order by q.proxima_revision_en, q.creado_en
    limit p_limite
    for update skip locked
  )
  update public.trabajos_generacion_ia t
  set estado = 'reclamado',
      token_reclamacion = gen_random_uuid(),
      reclamado_por = p_reclamado_por,
      reclamado_hasta = now() + p_arrendamiento,
      intentos = t.intentos + 1
  from seleccionados s
  where t.id = s.id
  returning t.*;
end;
$$;

create or replace function public.liberar_trabajo_generacion_ia(
  p_trabajo_id uuid,
  p_token_reclamacion uuid,
  p_estado_openai text,
  p_proxima_revision_en timestamptz,
  p_error jsonb default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actualizados integer;
begin
  update public.trabajos_generacion_ia
  set estado = case
        when fecha_limite <= now()
          then 'expirado'::public.estado_trabajo_generacion_ia
        else 'pendiente'::public.estado_trabajo_generacion_ia
      end,
      estado_openai = coalesce(p_estado_openai, estado_openai),
      proxima_revision_en = greatest(coalesce(p_proxima_revision_en, now()), now()),
      ultimo_error = p_error,
      completado_en = case when fecha_limite <= now() then now() else null end,
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null
  where id = p_trabajo_id
    and estado = 'reclamado'
    and token_reclamacion = p_token_reclamacion
    and reclamado_hasta > now();

  get diagnostics v_actualizados = row_count;
  return v_actualizados = 1;
end;
$$;

create or replace function public.solicitar_cancelacion_trabajo_generacion_ia(
  p_openai_response_id text
) returns public.trabajos_generacion_ia
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trabajo public.trabajos_generacion_ia;
begin
  update public.trabajos_generacion_ia
  set cancelacion_solicitada_en = coalesce(cancelacion_solicitada_en, now())
  where openai_response_id = p_openai_response_id
    and estado in ('pendiente', 'reclamado')
  returning * into v_trabajo;
  return v_trabajo;
end;
$$;

create or replace function public.finalizar_trabajo_generacion_ia(
  p_trabajo_id uuid,
  p_token_reclamacion uuid,
  p_estado public.estado_trabajo_generacion_ia,
  p_estado_openai text,
  p_resultado jsonb default null,
  p_error jsonb default null
) returns public.trabajos_generacion_ia
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trabajo public.trabajos_generacion_ia;
  v_response_vigente text;
  v_estado_plan_id uuid;
  v_actualizados integer := 0;
  v_patch jsonb;
begin
  if p_estado not in ('completado', 'fallido', 'cancelado', 'incompleto', 'expirado') then
    raise exception using errcode = '22023', message = 'Estado terminal inválido';
  end if;

  select * into v_trabajo
  from public.trabajos_generacion_ia
  where id = p_trabajo_id
    and estado = 'reclamado'
    and token_reclamacion = p_token_reclamacion
    and reclamado_hasta > now()
  for update;

  if v_trabajo.id is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_trabajo.tipo_entidad::text || ':' || v_trabajo.entidad_id::text, 0)
  );
  v_response_vigente := private.openai_response_id_vigente_trabajo_ia(
    v_trabajo.tipo_entidad,
    v_trabajo.entidad_id
  );

  if v_response_vigente is distinct from v_trabajo.openai_response_id then
    update public.trabajos_generacion_ia
    set estado = 'obsoleto',
        estado_openai = coalesce(p_estado_openai, estado_openai),
        completado_en = now(),
        ultimo_error = jsonb_build_object(
          'code', 'STALE_RESPONSE',
          'message', 'La entidad ya apunta a otra respuesta de OpenAI.'
        ),
        token_reclamacion = null,
        reclamado_por = null,
        reclamado_hasta = null
    where id = v_trabajo.id
    returning * into v_trabajo;
    return v_trabajo;
  end if;

  if p_estado = 'completado' and p_resultado is not null then
    case v_trabajo.tipo_entidad
      when 'plan' then
        select ep.id into v_estado_plan_id
        from public.estados_plan ep where upper(ep.clave) = 'BORRADOR' limit 1;
        update public.planes_estudio p
        set datos = p_resultado -> 'datos',
            estado_actual_id = v_estado_plan_id
        where p.id = v_trabajo.entidad_id
          and p.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id
          and exists (
            select 1 from public.estados_plan ep
            where ep.id = p.estado_actual_id and upper(ep.clave) = 'GENERANDO'
          );
      when 'asignatura' then
        v_patch := coalesce(p_resultado -> 'patch', '{}'::jsonb);
        update public.asignaturas a
        set datos = case when v_patch ? 'datos' then v_patch -> 'datos' else a.datos end,
            codigo = case when v_patch ? 'codigo' then v_patch ->> 'codigo' else a.codigo end,
            contenido_tematico = case when v_patch ? 'contenido_tematico' then v_patch -> 'contenido_tematico' else a.contenido_tematico end,
            criterios_de_evaluacion = case when v_patch ? 'criterios_de_evaluacion' then v_patch -> 'criterios_de_evaluacion' else a.criterios_de_evaluacion end,
            nombre = case when v_patch ? 'nombre' then v_patch ->> 'nombre' else a.nombre end,
            tipo = case when v_patch ? 'tipo' then (v_patch ->> 'tipo')::public.tipo_asignatura else a.tipo end,
            numero_ciclo = case when v_patch ? 'numero_ciclo' then (v_patch ->> 'numero_ciclo')::integer else a.numero_ciclo end,
            horas_academicas = case when v_patch ? 'horas_academicas' then (v_patch ->> 'horas_academicas')::integer else a.horas_academicas end,
            horas_independientes = case when v_patch ? 'horas_independientes' then (v_patch ->> 'horas_independientes')::integer else a.horas_independientes end,
            estado = 'borrador'
        where a.id = v_trabajo.entidad_id
          and a.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id
          and exists (
            select 1
            from public.planes_estudio p
            left join public.estados_plan ep on ep.id = p.estado_actual_id
            where p.id = a.plan_estudio_id
              and coalesce(ep.clave, '') not in (
                'REV_PLANEACION', 'CONSULTA_EXPERTOS', 'REV_SEDES',
                'CONSEJO_FACULTAD', 'CONSEJO_UNIVERSITARIO',
                'JUNTA_GOBIERNO', 'ENVIADO_SEP', 'APROBADO', 'RECHAZADO'
              )
          );
      when 'chat_plan' then
        update public.plan_mensajes_ia m
        set respuesta = p_resultado ->> 'respuesta',
            propuesta = coalesce(p_resultado -> 'propuesta', '{}'::jsonb),
            is_refusal = coalesce((p_resultado ->> 'is_refusal')::boolean, false),
            estado = 'COMPLETADO'
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id
          and exists (
            select 1
            from public.conversaciones_plan c
            join public.planes_estudio p on p.id = c.plan_estudio_id
            left join public.estados_plan ep on ep.id = p.estado_actual_id
            where c.id = m.conversacion_plan_id
              and coalesce(ep.clave, '') not in (
                'REV_PLANEACION', 'CONSULTA_EXPERTOS', 'REV_SEDES',
                'CONSEJO_FACULTAD', 'CONSEJO_UNIVERSITARIO',
                'JUNTA_GOBIERNO', 'ENVIADO_SEP', 'APROBADO', 'RECHAZADO'
              )
          );
      when 'chat_asignatura' then
        update public.asignatura_mensajes_ia m
        set respuesta = p_resultado ->> 'respuesta',
            propuesta = coalesce(p_resultado -> 'propuesta', '{}'::jsonb),
            is_refusal = coalesce((p_resultado ->> 'is_refusal')::boolean, false),
            estado = 'COMPLETADO'
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id
          and exists (
            select 1
            from public.conversaciones_asignatura c
            join public.asignaturas a on a.id = c.asignatura_id
            join public.planes_estudio p on p.id = a.plan_estudio_id
            left join public.estados_plan ep on ep.id = p.estado_actual_id
            where c.id = m.conversacion_asignatura_id
              and coalesce(ep.clave, '') not in (
                'REV_PLANEACION', 'CONSULTA_EXPERTOS', 'REV_SEDES',
                'CONSEJO_FACULTAD', 'CONSEJO_UNIVERSITARIO',
                'JUNTA_GOBIERNO', 'ENVIADO_SEP', 'APROBADO', 'RECHAZADO'
              )
          );
      when 'observabilidad' then
        update public.observability_test_runs o
        set estado = 'completed',
            completed_at = now(),
            latency_ms = greatest(0, floor(extract(epoch from (now() - o.started_at)) * 1000)::integer),
            error_code = null,
            error_message = null,
            metadata = o.metadata || coalesce(p_resultado, '{}'::jsonb)
        where o.id = v_trabajo.entidad_id
          and o.openai_response_id = v_trabajo.openai_response_id;
      when 'recursos_aprendizaje' then
        -- Los objetos y su score se escriben por el finalizador especializado.
        -- El arrendamiento global evita que dos actores entren a ese finalizador.
        update public.learning_generation_jobs j
        set estado = 'completed',
            resultado_json = coalesce(p_resultado -> 'resultado_json', j.resultado_json),
            error = null,
            completado_en = coalesce(j.completado_en, now())
        where j.id = v_trabajo.entidad_id
          and j.openai_response_id = v_trabajo.openai_response_id;
    end case;

    get diagnostics v_actualizados = row_count;
    if v_actualizados <> 1 then
      if v_trabajo.tipo_entidad = 'asignatura' then
        update public.asignaturas a
        set estado = 'fallida',
            meta_origen = jsonb_set(
              a.meta_origen,
              '{ai,error}',
              jsonb_build_object(
                'code', 'AI_NOT_ALLOWED_IN_CURRENT_STAGE',
                'message', 'El plan cambió de etapa antes de aplicar la respuesta.'
              ),
              true
            )
        where a.id = v_trabajo.entidad_id
          and a.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id;
      elsif v_trabajo.tipo_entidad = 'chat_plan' then
        update public.plan_mensajes_ia m
        set estado = 'ERROR',
            respuesta = 'La etapa actual del plan ya no permite aplicar esta respuesta.',
            propuesta = '{"recommendations":[]}'::jsonb,
            is_refusal = false
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id;
      elsif v_trabajo.tipo_entidad = 'chat_asignatura' then
        update public.asignatura_mensajes_ia m
        set estado = 'ERROR',
            respuesta = 'La etapa actual del plan ya no permite aplicar esta respuesta.',
            propuesta = '{"recommendations":[]}'::jsonb,
            is_refusal = false
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id;
      end if;
      get diagnostics v_actualizados = row_count;

      if v_actualizados = 1 and v_trabajo.tipo_entidad in (
        'asignatura', 'chat_plan', 'chat_asignatura'
      ) then
        update public.trabajos_generacion_ia
        set estado = 'fallido',
            estado_openai = coalesce(p_estado_openai, estado_openai),
            completado_en = now(),
            ultimo_error = jsonb_build_object(
              'code', 'AI_NOT_ALLOWED_IN_CURRENT_STAGE',
              'message', 'La etapa académica cambió antes de aplicar la respuesta.'
            ),
            token_reclamacion = null,
            reclamado_por = null,
            reclamado_hasta = null
        where id = v_trabajo.id
        returning * into v_trabajo;
        return v_trabajo;
      end if;

      update public.trabajos_generacion_ia
      set estado = 'obsoleto',
          completado_en = now(),
          ultimo_error = jsonb_build_object(
            'code', 'ENTITY_NOT_APPLIED',
            'message', 'La entidad dejó de aceptar esta respuesta antes de aplicarla.'
          ),
          token_reclamacion = null,
          reclamado_por = null,
          reclamado_hasta = null
      where id = v_trabajo.id
      returning * into v_trabajo;
      return v_trabajo;
    end if;
  elsif p_estado <> 'completado' then
    case v_trabajo.tipo_entidad
      when 'plan' then
        select ep.id into v_estado_plan_id
        from public.estados_plan ep where upper(ep.clave) = 'FALLIDO' limit 1;
        update public.planes_estudio p
        set estado_actual_id = v_estado_plan_id,
            meta_origen = jsonb_set(
              p.meta_origen,
              '{ai,error}',
              coalesce(p_error, jsonb_build_object('status', p_estado_openai)),
              true
            )
        where p.id = v_trabajo.entidad_id
          and p.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id;
      when 'asignatura' then
        update public.asignaturas a
        set estado = 'fallida',
            meta_origen = jsonb_set(
              a.meta_origen,
              '{ai,error}',
              coalesce(p_error, jsonb_build_object('status', p_estado_openai)),
              true
            )
        where a.id = v_trabajo.entidad_id
          and a.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id;
      when 'chat_plan' then
        update public.plan_mensajes_ia m
        set estado = case
              when p_estado = 'cancelado'
                then 'CANCELADO'::public.estado_mensaje_ia
              else 'ERROR'::public.estado_mensaje_ia
            end,
            respuesta = case when p_estado = 'cancelado'
              then 'Esta respuesta se ha cancelado.'
              else 'No se pudo generar la respuesta de la IA.' end,
            propuesta = '{"recommendations":[]}'::jsonb,
            is_refusal = false
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id;
      when 'chat_asignatura' then
        update public.asignatura_mensajes_ia m
        set estado = case
              when p_estado = 'cancelado'
                then 'CANCELADO'::public.estado_mensaje_ia
              else 'ERROR'::public.estado_mensaje_ia
            end,
            respuesta = case when p_estado = 'cancelado'
              then 'Esta respuesta se ha cancelado.'
              else 'No se pudo generar la respuesta de la IA.' end,
            propuesta = '{"recommendations":[]}'::jsonb,
            is_refusal = false
        where m.id = v_trabajo.entidad_id
          and m.openai_response_id = v_trabajo.openai_response_id;
      when 'recursos_aprendizaje' then
        update public.learning_generation_jobs j
        set estado = 'failed',
            error = coalesce(p_error ->> 'message', 'La generación de recursos no pudo completarse.'),
            completado_en = now()
        where j.id = v_trabajo.entidad_id
          and j.openai_response_id = v_trabajo.openai_response_id;
      when 'observabilidad' then
        update public.observability_test_runs o
        set estado = 'failed',
            completed_at = now(),
            latency_ms = greatest(0, floor(extract(epoch from (now() - o.started_at)) * 1000)::integer),
            error_code = coalesce(p_error ->> 'code', upper(coalesce(p_estado_openai, p_estado::text))),
            error_message = coalesce(p_error ->> 'message', 'La prueba asíncrona no pudo completarse.')
        where o.id = v_trabajo.entidad_id
          and o.openai_response_id = v_trabajo.openai_response_id;
    end case;
  end if;

  update public.trabajos_generacion_ia
  set estado = p_estado,
      estado_openai = coalesce(p_estado_openai, estado_openai),
      ultimo_error = p_error,
      completado_en = now(),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null
  where id = v_trabajo.id
  returning * into v_trabajo;

  return v_trabajo;
end;
$$;

create or replace function public.finalizar_cancelacion_generacion_ia(
  p_trabajo_id uuid,
  p_token_reclamacion uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trabajo public.trabajos_generacion_ia;
  v_eliminados integer := 0;
begin
  select * into v_trabajo
  from public.trabajos_generacion_ia
  where id = p_trabajo_id
    and estado = 'reclamado'
    and token_reclamacion = p_token_reclamacion
    and reclamado_hasta > now()
    and cancelacion_solicitada_en is not null
  for update;

  if v_trabajo.id is null then return false; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_trabajo.tipo_entidad::text || ':' || v_trabajo.entidad_id::text, 0)
  );

  if private.openai_response_id_vigente_trabajo_ia(
    v_trabajo.tipo_entidad,
    v_trabajo.entidad_id
  ) is distinct from v_trabajo.openai_response_id then
    return false;
  end if;

  if v_trabajo.tipo_entidad = 'plan' then
    delete from public.lineas_plan l
    where l.plan_estudio_id = v_trabajo.entidad_id
      and exists (
        select 1
        from public.planes_estudio p
        join public.estados_plan ep on ep.id = p.estado_actual_id
        where p.id = v_trabajo.entidad_id and upper(ep.clave) = 'GENERANDO'
          and p.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id
      );
    delete from public.planes_estudio p
    using public.estados_plan ep
    where p.id = v_trabajo.entidad_id
      and ep.id = p.estado_actual_id
      and upper(ep.clave) = 'GENERANDO'
      and p.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id;
    get diagnostics v_eliminados = row_count;
  elsif v_trabajo.tipo_entidad = 'asignatura' then
    delete from public.asignaturas a
    where a.id = v_trabajo.entidad_id
      and a.estado = 'generando'
      and a.meta_origen #>> '{ai,responseId}' = v_trabajo.openai_response_id;
    get diagnostics v_eliminados = row_count;
  else
    return false;
  end if;

  if v_eliminados <> 1 then return false; end if;

  update public.trabajos_generacion_ia
  set estado = 'cancelado',
      estado_openai = 'cancelled',
      completado_en = now(),
      token_reclamacion = null,
      reclamado_por = null,
      reclamado_hasta = null
  where id = v_trabajo.id;

  return true;
end;
$$;

create or replace function public.expirar_trabajos_generacion_ia()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trabajo public.trabajos_generacion_ia;
  v_total integer := 0;
  v_token uuid;
begin
  for v_trabajo in
    select *
    from public.trabajos_generacion_ia t
    where t.estado in ('pendiente', 'reclamado')
      and t.fecha_limite <= now()
    order by t.fecha_limite
    for update skip locked
  loop
    v_token := gen_random_uuid();
    update public.trabajos_generacion_ia
    set estado = 'reclamado', token_reclamacion = v_token,
        reclamado_por = 'expirador', reclamado_hasta = now() + interval '1 minute'
    where id = v_trabajo.id;

    perform public.finalizar_trabajo_generacion_ia(
      v_trabajo.id,
      v_token,
      'expirado',
      coalesce(v_trabajo.estado_openai, 'timeout'),
      null,
      jsonb_build_object(
        'code', 'GENERATION_TIMEOUT',
        'message', 'La generación excedió el límite de 60 minutos.'
      )
    );
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

create or replace function public.purgar_trabajos_generacion_ia()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  delete from public.trabajos_generacion_ia
  where estado in (
      'completado', 'fallido', 'cancelado', 'incompleto', 'expirado', 'obsoleto'
    )
    and completado_en < now() - interval '90 days';
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

create or replace function public.resumen_trabajos_generacion_ia()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pendientes', count(*) filter (where estado in ('pendiente', 'reclamado')),
    'mas_antiguo_en', min(iniciado_en) filter (where estado in ('pendiente', 'reclamado')),
    'arrendamientos_vencidos', count(*) filter (
      where estado = 'reclamado' and reclamado_hasta <= now()
    ),
    'expirados_24h', count(*) filter (
      where estado = 'expirado' and completado_en >= now() - interval '24 hours'
    )
  )
  from public.trabajos_generacion_ia;
$$;

create or replace function public.activar_cron_recuperacion_ia()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
  v_secretos integer;
begin
  select j.jobid into v_job_id
  from cron.job j
  where j.jobname = 'recuperar-generaciones-ia-30s';
  if v_job_id is null then
    raise exception using errcode = '55000', message = 'El cron de recuperación no está provisionado';
  end if;

  select count(*) into v_secretos
  from vault.decrypted_secrets
  where name in (
    'AI_RECOVERY_CRON_URL',
    'AI_RECOVERY_CRON_PUBLISHABLE_KEY',
    'AI_RECOVERY_CRON_SECRET'
  ) and nullif(decrypted_secret, '') is not null;
  if v_secretos <> 3 then
    raise exception using errcode = '55000', message = 'Faltan secretos de recuperación en Vault';
  end if;

  perform cron.alter_job(job_id := v_job_id, active := true);
  return true;
end;
$$;

do $$
declare
  v_signature regprocedure;
begin
  foreach v_signature in array array[
    'public.registrar_trabajo_generacion_ia(public.tipo_trabajo_generacion_ia,uuid,text,text,timestamptz,jsonb)'::regprocedure,
    'public.reclamar_trabajo_generacion_ia(text,text,interval)'::regprocedure,
    'public.reclamar_lote_trabajos_generacion_ia(text,integer,interval)'::regprocedure,
    'public.liberar_trabajo_generacion_ia(uuid,uuid,text,timestamptz,jsonb)'::regprocedure,
    'public.solicitar_cancelacion_trabajo_generacion_ia(text)'::regprocedure,
    'public.finalizar_trabajo_generacion_ia(uuid,uuid,public.estado_trabajo_generacion_ia,text,jsonb,jsonb)'::regprocedure,
    'public.finalizar_cancelacion_generacion_ia(uuid,uuid)'::regprocedure,
    'public.expirar_trabajos_generacion_ia()'::regprocedure,
    'public.purgar_trabajos_generacion_ia()'::regprocedure,
    'public.resumen_trabajos_generacion_ia()'::regprocedure,
    'public.activar_cron_recuperacion_ia()'::regprocedure,
    'public.registrar_entrega_webhook_ia(text,text,text,uuid,jsonb)'::regprocedure
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to service_role', v_signature);
  end loop;
end $$;

-- Retira la limpieza destructiva anterior.
select cron.unschedule('limpieza-planes-fallidos-10m')
where exists (select 1 from cron.job where jobname = 'limpieza-planes-fallidos-10m');
select cron.unschedule('limpieza-asignaturas-fallidas-10m')
where exists (select 1 from cron.job where jobname = 'limpieza-asignaturas-fallidas-10m');
drop function if exists public.borrar_planes_fallidos();
drop function if exists public.borrar_asignaturas_fallidas();

select cron.unschedule('expirar-generaciones-ia-1m')
where exists (select 1 from cron.job where jobname = 'expirar-generaciones-ia-1m');
select cron.schedule(
  'expirar-generaciones-ia-1m',
  '* * * * *',
  'select public.expirar_trabajos_generacion_ia();'
);

select cron.unschedule('purgar-generaciones-ia-90d')
where exists (select 1 from cron.job where jobname = 'purgar-generaciones-ia-90d');
select cron.schedule(
  'purgar-generaciones-ia-90d',
  '0 3 * * *',
  'select public.purgar_trabajos_generacion_ia();'
);

select cron.unschedule('recuperar-generaciones-ia-30s')
where exists (select 1 from cron.job where jobname = 'recuperar-generaciones-ia-30s');

do $$
declare
  v_job_id bigint;
  v_secrets_ready boolean;
begin
  select cron.schedule(
    'recuperar-generaciones-ia-30s',
    '30 seconds',
    $cron$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'AI_RECOVERY_CRON_URL'
        ) || '/functions/v1/openai-responses/reconcile',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'AI_RECOVERY_CRON_PUBLISHABLE_KEY'
          ),
          'apikey', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'AI_RECOVERY_CRON_PUBLISHABLE_KEY'
          ),
          'x-ai-recovery-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'AI_RECOVERY_CRON_SECRET'
          )
        ),
        body := '{"source":"supabase-cron"}'::jsonb,
        timeout_milliseconds := 5000
      );
    $cron$
  ) into v_job_id;

  select count(*) = 3 into v_secrets_ready
  from vault.decrypted_secrets
  where name in (
    'AI_RECOVERY_CRON_URL',
    'AI_RECOVERY_CRON_PUBLISHABLE_KEY',
    'AI_RECOVERY_CRON_SECRET'
  ) and nullif(decrypted_secret, '') is not null;

  -- Una instalación nueva queda segura e inactiva hasta provisionar Vault y
  -- el secreto homónimo de la Edge Function. Volver a aplicar esta activación
  -- o usar el Dashboard de Cron después del aprovisionamiento.
  perform cron.alter_job(job_id := v_job_id, active := v_secrets_ready);
end $$;
