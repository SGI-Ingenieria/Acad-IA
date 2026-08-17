-- Elimina el sondeo documental cada minuto. La carga despierta al worker de
-- inmediato; la higiene diaria sólo lo despierta si realmente encoló GC.
create or replace function public.ejecutar_higiene_documental(
  p_dias_gracia_gc integer default 7
)
returns table(
  blobs_encolados integer,
  selecciones_expiradas integer,
  selecciones_purgadas integer
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_blob record;
  v_blobs integer := 0;
  v_expiradas integer;
  v_purgadas integer;
  v_worker_url text;
  v_worker_secret text;
begin
  for v_blob in
    select id
    from public.file_blobs
    where refcount = 0
      and refcount_cero_desde is not null
      and refcount_cero_desde <= now() - make_interval(days => greatest(p_dias_gracia_gc, 1))
      and deleted_at is null
    limit 200
  loop
    perform public.encolar_trabajo_ingesta_documental(
      (select tenant_id from public.file_blobs where id = v_blob.id),
      null,
      null,
      'blob_gc',
      format('blobgc:%s:%s', v_blob.id, to_char(now(), 'YYYYMMDD')),
      jsonb_build_object('blob_id', v_blob.id)
    );
    v_blobs := v_blobs + 1;
  end loop;

  -- Los vector stores expiran solos en OpenAI; aquí sólo se invalida su
  -- referencia local para que la siguiente generación no use un ID muerto.
  update public.vector_store_selecciones
  set estado = 'expirado'
  where estado = 'listo' and expires_at <= now();
  get diagnostics v_expiradas = row_count;

  delete from public.vector_store_selecciones
  where (estado in ('expirado', 'fallido') and last_active_at <= now() - interval '30 days')
     or (estado = 'creando' and created_at <= now() - interval '7 days');
  get diagnostics v_purgadas = row_count;

  if v_blobs > 0 then
    select decrypted_secret
    into v_worker_url
    from vault.decrypted_secrets
    where name = 'AI_RECOVERY_CRON_URL';

    select decrypted_secret
    into v_worker_secret
    from vault.decrypted_secrets
    where name = 'AI_RECOVERY_CRON_SECRET';

    if v_worker_url is null or v_worker_secret is null then
      raise warning
        'La higiene documental encoló % trabajos GC sin credencial para despertar process-file-jobs.',
        v_blobs;
    else
      perform net.http_post(
        url := v_worker_url || '/functions/v1/process-file-jobs',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-file-jobs-cron-secret', v_worker_secret
        ),
        body := jsonb_build_object('source', 'higiene-documental'),
        timeout_milliseconds := 5000
      );
    end if;
  end if;

  blobs_encolados := v_blobs;
  selecciones_expiradas := v_expiradas;
  selecciones_purgadas := v_purgadas;
  return next;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'procesar-documentos-ia-1m';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

-- Ambos trabajos estaban pendientes desde principios de agosto, nunca fueron
-- reclamados y no bloquean el flujo actual: el warm-up ya no tiene selección y
-- la sincronización de OpenAI es una caché que se reintenta bajo demanda.
update public.ingestion_jobs
set
  status = 'cancelled',
  completed_at = now(),
  last_error = jsonb_build_object(
    'code', 'STALE_JOB_CANCELLED',
    'message', 'Trabajo pendiente cancelado al retirar el sondeo documental.'
  )
where id in (
  '23645bf9-aa62-42b5-bef8-62e3b15020f1'::uuid,
  '5f70990f-6a4a-4a77-ba16-ba2dabfc7fc7'::uuid
)
  and status = 'pending'
  and attempts = 0;
