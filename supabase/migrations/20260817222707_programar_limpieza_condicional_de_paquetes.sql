create or replace function private.invocar_limpieza_paquetes_aprendizaje_si_necesaria()
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_url text;
  v_publishable_key text;
  v_secret text;
begin
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'learning-packages'
      and (
        (name like 'cache/%' and created_at < now() - interval '7 days')
        or (
          name like 'asignaturas/%/ondemand/%'
          and created_at < now() - interval '1 hour'
        )
      )
  ) then
    return false;
  end if;

  select decrypted_secret
  into v_url
  from vault.decrypted_secrets
  where name = 'AI_RECOVERY_CRON_URL';

  select decrypted_secret
  into v_publishable_key
  from vault.decrypted_secrets
  where name = 'AI_RECOVERY_CRON_PUBLISHABLE_KEY';

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = 'AI_RECOVERY_CRON_SECRET';

  if v_url is null or v_publishable_key is null or v_secret is null then
    raise warning
      'La limpieza de paquetes tiene artefactos vencidos, pero faltan credenciales internas.';
    return false;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/learning-package-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_publishable_key,
      'apikey', v_publishable_key,
      'x-cron-secret', v_secret
    ),
    body := jsonb_build_object('action', 'all'),
    timeout_milliseconds := 5000
  );
  return true;
end;
$$;

revoke all on function private.invocar_limpieza_paquetes_aprendizaje_si_necesaria() from public;
grant execute on function private.invocar_limpieza_paquetes_aprendizaje_si_necesaria() to postgres;

do $$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'limpiar-paquetes-aprendizaje-diaria';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  v_job_id := cron.schedule(
    'limpiar-paquetes-aprendizaje-diaria',
    '37 4 * * *',
    $cron$select private.invocar_limpieza_paquetes_aprendizaje_si_necesaria();$cron$
  );
  perform cron.alter_job(
    v_job_id,
    active => (
      select count(*) = 3
      from vault.decrypted_secrets
      where name in (
        'AI_RECOVERY_CRON_URL',
        'AI_RECOVERY_CRON_PUBLISHABLE_KEY',
        'AI_RECOVERY_CRON_SECRET'
      )
    )
  );
end;
$$;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') like '%ai-storage%'
        or coalesce(with_check, '') like '%ai-storage%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', v_policy.policyname);
  end loop;
end;
$$;
