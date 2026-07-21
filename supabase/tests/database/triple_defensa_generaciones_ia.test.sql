begin;

select plan(30);

select has_table(
  'public',
  'trabajos_generacion_ia',
  'existe la bitácora privada de generaciones'
);
select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.trabajos_generacion_ia'::regclass),
  'la bitácora tiene RLS habilitado'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'trabajos_generacion_ia'
      and indexname = 'trabajos_generacion_ia_entidad_activa_idx'
      and indexdef like '%UNIQUE%'
  ),
  'sólo puede existir un trabajo activo por entidad'
);
select ok(
  not has_table_privilege('anon', 'public.trabajos_generacion_ia', 'select'),
  'anon no puede leer la bitácora'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.trabajos_generacion_ia',
    'select'
  ),
  'authenticated no puede leer la bitácora'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.registrar_trabajo_generacion_ia(public.tipo_trabajo_generacion_ia,uuid,text,text,timestamptz,jsonb)',
    'execute'
  ),
  'authenticated no puede registrar trabajos directamente'
);

set local role service_role;

create temporary table test_claims (
  nombre text primary key,
  trabajo_id uuid not null,
  token uuid not null
) on commit drop;

select lives_ok(
  $$ select public.registrar_trabajo_generacion_ia(
       'observabilidad',
       '10000000-0000-0000-0000-000000000001',
       'resp_claim_race',
       'queued'
     ) $$,
  'service_role puede registrar una generación'
);

insert into test_claims (nombre, trabajo_id, token)
select 'primera', (claim).id, (claim).token_reclamacion
from (
  select public.reclamar_trabajo_generacion_ia(
    'resp_claim_race', 'worker-webhook'
  ) as claim
) claimed;

select is(
  (select count(*)::integer from test_claims where nombre = 'primera'),
  1,
  'la primera reclamación gana'
);
select is(
  (
    select (public.reclamar_trabajo_generacion_ia(
      'resp_claim_race', 'worker-frontend'
    )).id
  ),
  null::uuid,
  'una reclamación simultánea no obtiene el mismo trabajo'
);

update public.trabajos_generacion_ia
set reclamado_hasta = now() - interval '1 second'
where openai_response_id = 'resp_claim_race';

insert into test_claims (nombre, trabajo_id, token)
select 'recuperada', (claim).id, (claim).token_reclamacion
from (
  select public.reclamar_trabajo_generacion_ia(
    'resp_claim_race', 'worker-cron'
  ) as claim
) claimed;

select is(
  (select count(*)::integer from test_claims where nombre = 'recuperada'),
  1,
  'un arrendamiento vencido se puede recuperar'
);
select isnt(
  (select token from test_claims where nombre = 'primera'),
  (select token from test_claims where nombre = 'recuperada'),
  'la recuperación entrega un token nuevo'
);
select is(
  public.liberar_trabajo_generacion_ia(
    (select trabajo_id from test_claims where nombre = 'primera'),
    (select token from test_claims where nombre = 'primera'),
    'in_progress',
    now() + interval '30 seconds'
  ),
  false,
  'el token anterior no puede liberar el trabajo'
);
select is(
  (
    public.finalizar_trabajo_generacion_ia(
      (select trabajo_id from test_claims where nombre = 'primera'),
      (select token from test_claims where nombre = 'primera'),
      'fallido',
      'failed'
    )
  ).id,
  null::uuid,
  'el token anterior no puede finalizar el trabajo'
);
select is(
  public.liberar_trabajo_generacion_ia(
    (select trabajo_id from test_claims where nombre = 'recuperada'),
    (select token from test_claims where nombre = 'recuperada'),
    'in_progress',
    now() + interval '30 seconds'
  ),
  true,
  'el propietario vigente sí puede liberar el trabajo'
);

insert into public.observability_test_runs (
  id, tipo, estado, openai_response_id
) values (
  '20000000-0000-0000-0000-000000000002',
  'openai_background',
  'running',
  'resp_stale_old'
);
select public.registrar_trabajo_generacion_ia(
  'observabilidad',
  '20000000-0000-0000-0000-000000000002',
  'resp_stale_old',
  'completed'
);
insert into test_claims (nombre, trabajo_id, token)
select 'obsoleta', (claim).id, (claim).token_reclamacion
from (
  select public.reclamar_trabajo_generacion_ia(
    'resp_stale_old', 'worker-antiguo'
  ) as claim
) claimed;

update public.observability_test_runs
set openai_response_id = 'resp_stale_new'
where id = '20000000-0000-0000-0000-000000000002';
select public.registrar_trabajo_generacion_ia(
  'observabilidad',
  '20000000-0000-0000-0000-000000000002',
  'resp_stale_new',
  'queued'
);
-- Simula un webhook atrasado de la respuesta anterior después de registrar la
-- nueva. No debe retirar el trabajo vigente.
select public.registrar_trabajo_generacion_ia(
  'observabilidad',
  '20000000-0000-0000-0000-000000000002',
  'resp_stale_old',
  'completed'
);

select is(
  (
    public.finalizar_trabajo_generacion_ia(
      (select trabajo_id from test_claims where nombre = 'obsoleta'),
      (select token from test_claims where nombre = 'obsoleta'),
      'completado',
      'completed',
      '{"output_text":"OK"}'::jsonb
    )
  ).id,
  null::uuid,
  'una respuesta sustituida no puede finalizar con el token viejo'
);
select is(
  (
    select estado
    from public.observability_test_runs
    where id = '20000000-0000-0000-0000-000000000002'
  ),
  'running',
  'la respuesta obsoleta no modifica la entidad'
);
select is(
  (
    select estado::text
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_stale_old'
  ),
  'obsoleto',
  'el trabajo sustituido conserva trazabilidad como obsoleto'
);
select is(
  (
    select count(*)::integer
    from public.trabajos_generacion_ia
    where tipo_entidad = 'observabilidad'
      and entidad_id = '20000000-0000-0000-0000-000000000002'
      and estado in ('pendiente', 'reclamado')
  ),
  1,
  'sólo la respuesta nueva permanece activa'
);

insert into test_claims (nombre, trabajo_id, token)
select 'vigente', (claim).id, (claim).token_reclamacion
from (
  select public.reclamar_trabajo_generacion_ia(
    'resp_stale_new', 'worker-vigente'
  ) as claim
) claimed;
select is(
  (
    public.finalizar_trabajo_generacion_ia(
      (select trabajo_id from test_claims where nombre = 'vigente'),
      (select token from test_claims where nombre = 'vigente'),
      'completado',
      'completed',
      '{"output_text":"OK"}'::jsonb
    )
  ).estado::text,
  'completado',
  'el propietario vigente finaliza el trabajo'
);
select is(
  (
    select estado
    from public.observability_test_runs
    where id = '20000000-0000-0000-0000-000000000002'
  ),
  'completed',
  'la entidad se actualiza en la misma transición terminal'
);
select is(
  (
    select count(*)::integer
    from public.trabajos_generacion_ia
    where tipo_entidad = 'observabilidad'
      and entidad_id = '20000000-0000-0000-0000-000000000002'
      and estado in ('pendiente', 'reclamado')
  ),
  0,
  'la transición terminal no deja otro trabajo activo'
);

reset role;
create function public.test_forzar_rollback_trabajo_ia()
returns trigger
language plpgsql
as $$
begin
  if old.openai_response_id = 'resp_atomic_rollback'
     and new.estado = 'completado' then
    raise exception using errcode = 'P0001', message = 'forced atomic rollback';
  end if;
  return new;
end;
$$;
create trigger test_forzar_rollback_trabajo_ia
before update on public.trabajos_generacion_ia
for each row execute function public.test_forzar_rollback_trabajo_ia();

set local role service_role;
insert into public.observability_test_runs (
  id, tipo, estado, openai_response_id
) values (
  '30000000-0000-0000-0000-000000000003',
  'openai_background',
  'running',
  'resp_atomic_rollback'
);
select public.registrar_trabajo_generacion_ia(
  'observabilidad',
  '30000000-0000-0000-0000-000000000003',
  'resp_atomic_rollback',
  'completed'
);
insert into test_claims (nombre, trabajo_id, token)
select 'rollback', (claim).id, (claim).token_reclamacion
from (
  select public.reclamar_trabajo_generacion_ia(
    'resp_atomic_rollback', 'worker-rollback'
  ) as claim
) claimed;

select throws_ok(
  $$ select public.finalizar_trabajo_generacion_ia(
       (select trabajo_id from test_claims where nombre = 'rollback'),
       (select token from test_claims where nombre = 'rollback'),
       'completado',
       'completed',
       '{"output_text":"no debe persistir"}'::jsonb
     ) $$,
  'P0001',
  'forced atomic rollback',
  'una falla al cerrar la bitácora aborta la transición completa'
);
select is(
  (
    select estado
    from public.observability_test_runs
    where id = '30000000-0000-0000-0000-000000000003'
  ),
  'running',
  'la actualización de la entidad se revierte junto con el trabajo'
);
select is(
  (
    select estado::text
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_atomic_rollback'
  ),
  'reclamado',
  'el trabajo conserva su reclamación después del rollback'
);

insert into public.observability_test_runs (
  id, tipo, estado, openai_response_id, started_at
) values (
  '40000000-0000-0000-0000-000000000004',
  'openai_background',
  'running',
  'resp_timeout',
  now() - interval '61 minutes'
);
select public.registrar_trabajo_generacion_ia(
  'observabilidad',
  '40000000-0000-0000-0000-000000000004',
  'resp_timeout',
  'in_progress',
  now() - interval '61 minutes'
);
select is(
  public.expirar_trabajos_generacion_ia(),
  1,
  'el expirador cierra trabajos que exceden 60 minutos'
);
select is(
  (
    select estado::text
    from public.trabajos_generacion_ia
    where openai_response_id = 'resp_timeout'
  ),
  'expirado',
  'el timeout se conserva como expirado y no se borra silenciosamente'
);

select public.registrar_entrega_webhook_ia(
  'evt_duplicate_test',
  'response.completed',
  'resp_duplicate_test',
  null,
  '{"delivery":1}'::jsonb
);
select public.registrar_entrega_webhook_ia(
  'evt_duplicate_test',
  'response.completed',
  'resp_duplicate_test',
  null,
  '{"delivery":2}'::jsonb
);
select is(
  (
    select delivery_count
    from public.observability_webhook_events
    where event_id = 'evt_duplicate_test'
  ),
  2,
  'las entregas duplicadas del webhook quedan contabilizadas'
);

reset role;
select ok(
  exists (
    select 1 from cron.job
    where jobname = 'recuperar-generaciones-ia-30s'
  ),
  'el cron de recuperación queda provisionado'
);
select ok(
  not exists (
    select 1 from cron.job
    where jobname in (
      'limpieza-planes-fallidos-10m',
      'limpieza-asignaturas-fallidas-10m'
    )
  ),
  'los cron destructivos anteriores se retiraron'
);
select ok(
  to_regprocedure('public.borrar_planes_fallidos()') is null
    and to_regprocedure('public.borrar_asignaturas_fallidas()') is null,
  'las funciones públicas de limpieza destructiva se retiraron'
);

select * from finish();
rollback;
