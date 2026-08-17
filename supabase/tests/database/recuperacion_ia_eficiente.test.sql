begin;

select plan(6);

select has_function(
  'private',
  'hay_recuperacion_ia_pendiente',
  array[]::text[],
  'existe el preflight barato de recuperación'
);
select has_function(
  'private',
  'invocar_recuperacion_ia_si_necesaria',
  array[]::text[],
  'existe el invocador condicionado de recuperación'
);
select has_function(
  'private',
  'ejecutar_retencion_operativa',
  array[]::text[],
  'existe la retención operativa'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.invocar_recuperacion_ia_si_necesaria()',
    'execute'
  ),
  'authenticated no puede invocar el cron privado'
);

insert into public.trabajos_generacion_ia (
  tipo_entidad,
  entidad_id,
  openai_response_id,
  estado,
  estado_openai,
  proxima_revision_en,
  iniciado_en,
  fecha_limite
) values (
  'observabilidad',
  '50000000-0000-0000-0000-000000000005',
  'resp_preflight_due',
  'pendiente',
  'queued',
  now() - interval '1 second',
  now(),
  now() + interval '1 hour'
);

select ok(
  private.hay_recuperacion_ia_pendiente(),
  'el preflight detecta un trabajo vencido para revisión'
);
select ok(
  exists (
    select 1
    from cron.job
    where jobname = 'recuperar-generaciones-ia-5m'
      and schedule = '*/5 * * * *'
      and command = 'select private.invocar_recuperacion_ia_si_necesaria();'
  )
  and not exists (
    select 1
    from cron.job
    where jobname in (
      'recuperar-generaciones-ia-30s',
      'expirar-generaciones-ia-1m'
    )
  ),
  'no quedan ciclos redundantes o incondicionales'
);

select * from finish();
rollback;
