-- El webhook sigue siendo la ruta primaria. Este preflight permite que el cron
-- de respaldo despierte la Edge Function únicamente cuando existe trabajo que
-- ya puede recuperarse o una generación activa que aún no está registrada.
create or replace function private.hay_recuperacion_ia_pendiente()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    exists (
      select 1
      from public.trabajos_generacion_ia t
      where t.estado in ('pendiente', 'reclamado')
        and (
          t.fecha_limite <= now()
          or (
            t.estado = 'pendiente'
            and t.proxima_revision_en <= now()
          )
          or (
            t.estado = 'reclamado'
            and (t.reclamado_hasta is null or t.reclamado_hasta <= now())
          )
        )
    )
    or exists (
      select 1
      from private.intentos_generacion_ia i
      where i.handler = 'chat'
        and i.terminal_aplicado_en is null
        and (
          (
            i.estado in ('preparado', 'reclamado', 'respuesta_vinculada')
            and (
              i.fecha_limite <= now()
              or (
                i.siguiente_intento <= now()
                and (
                  i.estado = 'preparado'
                  or i.reclamado_hasta is null
                  or i.reclamado_hasta <= now()
                )
              )
            )
          )
          or (
            i.estado in ('fallido', 'expirado')
            and (i.reclamado_hasta is null or i.reclamado_hasta <= now())
          )
        )
    )
    or exists (
      select 1
      from public.planes_estudio p
      join public.estados_plan e on e.id = p.estado_actual_id
      where e.clave = 'GENERANDO'
        and nullif(p.meta_origen #>> '{ai,responseId}', '') is not null
    )
    or exists (
      select 1
      from public.asignaturas a
      where a.estado = 'generando'
        and nullif(a.meta_origen #>> '{ai,responseId}', '') is not null
    )
    or exists (
      select 1
      from public.plan_mensajes_ia m
      where m.estado = 'PROCESANDO'
        and nullif(m.openai_response_id, '') is not null
    )
    or exists (
      select 1
      from public.asignatura_mensajes_ia m
      where m.estado = 'PROCESANDO'
        and nullif(m.openai_response_id, '') is not null
    )
    or exists (
      select 1
      from public.learning_generation_jobs j
      where j.estado in ('queued', 'running', 'needs_review')
        and nullif(j.openai_response_id, '') is not null
    )
    or exists (
      select 1
      from public.observability_test_runs r
      where r.estado = 'running'
        and nullif(r.openai_response_id, '') is not null
    );
$$;

alter function private.hay_recuperacion_ia_pendiente() owner to postgres;
revoke all on function private.hay_recuperacion_ia_pendiente() from public;

create or replace function private.invocar_recuperacion_ia_si_necesaria()
returns bigint
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_url text;
  v_publishable_key text;
  v_secret text;
  v_request_id bigint;
begin
  -- Evita solapar lotes si una ejecución anterior aún está trabajando.
  if exists (
    select 1
    from public.ejecuciones_recuperacion_ia e
    where e.completado_en is null
      and e.iniciado_en >= now() - interval '10 minutes'
  ) then
    return null;
  end if;

  if not private.hay_recuperacion_ia_pendiente() then
    return null;
  end if;

  select
    max(s.decrypted_secret) filter (where s.name = 'AI_RECOVERY_CRON_URL'),
    max(s.decrypted_secret) filter (
      where s.name = 'AI_RECOVERY_CRON_PUBLISHABLE_KEY'
    ),
    max(s.decrypted_secret) filter (
      where s.name = 'AI_RECOVERY_CRON_SECRET'
    )
  into v_url, v_publishable_key, v_secret
  from vault.decrypted_secrets s
  where s.name in (
    'AI_RECOVERY_CRON_URL',
    'AI_RECOVERY_CRON_PUBLISHABLE_KEY',
    'AI_RECOVERY_CRON_SECRET'
  );

  if nullif(v_url, '') is null
     or nullif(v_publishable_key, '') is null
     or nullif(v_secret, '') is null then
    raise exception using
      errcode = '55000',
      message = 'Faltan secretos de recuperación de IA en Vault';
  end if;

  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/openai-responses/reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_publishable_key,
      'apikey', v_publishable_key,
      'x-ai-recovery-secret', v_secret
    ),
    body := '{"source":"supabase-cron","preflight":true}'::jsonb,
    timeout_milliseconds := 5000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

alter function private.invocar_recuperacion_ia_si_necesaria() owner to postgres;
revoke all on function private.invocar_recuperacion_ia_si_necesaria() from public;

-- pg_cron no purga su historial automáticamente. La misma rutina conserva
-- sólo la ventana operativa útil de las auditorías propias y de pg_net.
create or replace function private.ejecutar_retencion_operativa()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_cron integer := 0;
  v_recuperaciones integer := 0;
  v_http integer := 0;
begin
  delete from cron.job_run_details d
  where d.start_time < now() - interval '7 days';
  get diagnostics v_cron = row_count;

  delete from public.ejecuciones_recuperacion_ia e
  where e.iniciado_en < now() - interval '30 days';
  get diagnostics v_recuperaciones = row_count;

  delete from net._http_response r
  where r.created < now() - interval '6 hours';
  get diagnostics v_http = row_count;

  return jsonb_build_object(
    'cron_eliminados', v_cron,
    'recuperaciones_eliminadas', v_recuperaciones,
    'respuestas_http_eliminadas', v_http
  );
end;
$$;

alter function private.ejecutar_retencion_operativa() owner to postgres;
revoke all on function private.ejecutar_retencion_operativa() from public;

create index if not exists asignaturas_generando_recuperacion_idx
  on public.asignaturas (creado_en, id)
  where estado = 'generando';
create index if not exists plan_mensajes_ia_procesando_recuperacion_idx
  on public.plan_mensajes_ia (fecha_creacion, id)
  where estado = 'PROCESANDO';
create index if not exists asignatura_mensajes_ia_procesando_recuperacion_idx
  on public.asignatura_mensajes_ia (fecha_creacion, id)
  where estado = 'PROCESANDO';
create index if not exists learning_generation_jobs_recuperacion_idx
  on public.learning_generation_jobs (creado_en, id)
  where estado in ('queued', 'running', 'needs_review');
create index if not exists observability_test_runs_running_recuperacion_idx
  on public.observability_test_runs (started_at, id)
  where estado = 'running';

create or replace function public.activar_cron_recuperacion_ia()
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_job_id bigint;
  v_secretos integer;
begin
  select j.jobid
  into v_job_id
  from cron.job j
  where j.jobname = 'recuperar-generaciones-ia-5m';

  if v_job_id is null then
    raise exception using
      errcode = '55000',
      message = 'El cron de recuperación no está provisionado';
  end if;

  select count(*)
  into v_secretos
  from vault.decrypted_secrets
  where name in (
    'AI_RECOVERY_CRON_URL',
    'AI_RECOVERY_CRON_PUBLISHABLE_KEY',
    'AI_RECOVERY_CRON_SECRET'
  )
    and nullif(decrypted_secret, '') is not null;

  if v_secretos <> 3 then
    raise exception using
      errcode = '55000',
      message = 'Faltan secretos de recuperación en Vault';
  end if;

  perform cron.alter_job(job_id := v_job_id, active := true);
  return true;
end;
$$;

alter function public.activar_cron_recuperacion_ia() owner to postgres;
revoke all on function public.activar_cron_recuperacion_ia() from public;
grant all on function public.activar_cron_recuperacion_ia() to service_role;

create or replace function public.resumen_trabajos_generacion_ia()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with cola as (
    select
      count(*) filter (
        where t.estado in ('pendiente', 'reclamado')
      ) as pendientes,
      min(t.iniciado_en) filter (
        where t.estado in ('pendiente', 'reclamado')
      ) as mas_antiguo_en,
      count(*) filter (
        where t.estado = 'reclamado'
          and t.reclamado_hasta <= now()
      ) as arrendamientos_vencidos,
      count(*) filter (
        where t.estado = 'expirado'
          and t.completado_en >= now() - interval '24 hours'
      ) as expirados_24h
    from public.trabajos_generacion_ia t
  ), cron_config as (
    select j.jobid, j.active, j.schedule
    from cron.job j
    where j.jobname = 'recuperar-generaciones-ia-5m'
    limit 1
  ), cron_ultima as (
    select d.start_time, d.status
    from cron.job_run_details d
    join cron_config c on c.jobid = d.jobid
    order by d.start_time desc
    limit 1
  ), cron_hora as (
    select
      count(*) as ejecuciones,
      count(*) filter (where d.status = 'failed') as fallos
    from cron.job_run_details d
    join cron_config c on c.jobid = d.jobid
    where d.start_time >= now() - interval '1 hour'
  ), recuperaciones_hora as (
    select
      count(*) as ejecuciones,
      count(*) filter (
        where e.error is null
          and e.descubiertos = 0
          and e.reclamados = 0
          and e.completados = 0
          and e.reprogramados = 0
          and e.fallidos = 0
      ) as vacias,
      count(*) filter (where e.error is not null) as errores
    from public.ejecuciones_recuperacion_ia e
    where e.iniciado_en >= now() - interval '1 hour'
  )
  select jsonb_build_object(
    'pendientes', c.pendientes,
    'mas_antiguo_en', c.mas_antiguo_en,
    'arrendamientos_vencidos', c.arrendamientos_vencidos,
    'expirados_24h', c.expirados_24h,
    'cron_activo', coalesce(cfg.active, false),
    'cron_programacion', cfg.schedule,
    'cron_ultima_ejecucion_en', u.start_time,
    'cron_ultimo_estado', u.status,
    'cron_ejecuciones_1h', coalesce(ch.ejecuciones, 0),
    'cron_fallos_1h', coalesce(ch.fallos, 0),
    'recuperaciones_1h', coalesce(rh.ejecuciones, 0),
    'recuperaciones_vacias_1h', coalesce(rh.vacias, 0),
    'recuperaciones_errores_1h', coalesce(rh.errores, 0)
  )
  from cola c
  left join cron_config cfg on true
  left join cron_ultima u on true
  left join cron_hora ch on true
  left join recuperaciones_hora rh on true;
$$;

alter function public.resumen_trabajos_generacion_ia() owner to postgres;
revoke all on function public.resumen_trabajos_generacion_ia() from public;
grant all on function public.resumen_trabajos_generacion_ia() to service_role;

do $cron$
declare
  v_job_id bigint;
  v_job record;
  v_recuperacion_activa boolean;
begin
  for v_job in
    select j.jobid
    from cron.job j
    where j.jobname in (
      'expirar-generaciones-ia-1m',
      'recuperar-generaciones-ia-30s',
      'recuperar-generaciones-ia-5m',
      'retencion-operativa-diaria'
    )
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  select count(*) = 3
  into v_recuperacion_activa
  from vault.decrypted_secrets
  where name in (
    'AI_RECOVERY_CRON_URL',
    'AI_RECOVERY_CRON_PUBLISHABLE_KEY',
    'AI_RECOVERY_CRON_SECRET'
  )
    and nullif(decrypted_secret, '') is not null;

  v_job_id := cron.schedule(
    'recuperar-generaciones-ia-5m',
    '*/5 * * * *',
    $job$select private.invocar_recuperacion_ia_si_necesaria();$job$
  );
  perform cron.alter_job(v_job_id, active => v_recuperacion_activa);

  perform cron.schedule(
    'retencion-operativa-diaria',
    '17 4 * * *',
    $job$select private.ejecutar_retencion_operativa();$job$
  );
end;
$cron$;

-- Reduce de inmediato la mayor fuente de crecimiento detectada. El espacio
-- queda disponible para reutilización; el mantenimiento posterior compacta
-- estadísticas sin bloquear la base con VACUUM FULL.
select private.ejecutar_retencion_operativa();
