begin;

select plan(30);

select has_table(
  'private',
  'intentos_generacion_ia',
  'existe el núcleo genérico de intentos'
);
select has_column(
  'private',
  'intentos_generacion_ia',
  'payload_version',
  'el payload durable está versionado'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'private'
      and tablename = 'intentos_generacion_ia'
      and indexname = 'intentos_generacion_ia_entidad_activa_idx'
      and indexdef like '%UNIQUE%'
  ),
  'sólo hay un intento activo por handler y entidad'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.intentos_generacion_ia'::regclass
      and conname = 'intentos_generacion_ia_sin_file_data_check'
  ),
  'el outbox prohíbe persistir file_data'
);
select ok(
  not has_table_privilege(
    'service_role', 'private.intentos_generacion_ia', 'select'
  ),
  'service_role no puede saltarse las RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.preparar_intento_generacion_ia(uuid,public.tipo_trabajo_generacion_ia,uuid,text,integer,jsonb,jsonb,text,text,jsonb,text)',
    'execute'
  ),
  'authenticated no puede preparar intentos'
);

set local role service_role;

create temporary table intento_a as
select prepared as value
from (
  select public.preparar_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000001',
    'observabilidad',
    'ea200000-0000-4000-8000-000000000001',
    'pgtap-core',
    1,
    '{"run":"A"}'::jsonb,
    '{"model":"gpt-5.6-luna","input":"A"}'::jsonb,
    'none', '', '[]'::jsonb, 'worker-a'
  ) prepared
) created;

select is(
  (select value ->> 'estado' from intento_a),
  'reclamado',
  'el núcleo prepara y reclama antes del HTTP'
);
select is(
  (select (value ->> 'payload_version')::integer from intento_a),
  1,
  'conserva la versión del payload'
);
select is(
  public.preparar_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000001',
    'observabilidad',
    'ea200000-0000-4000-8000-000000000001',
    'pgtap-core',
    1,
    '{"run":"A"}'::jsonb,
    '{"model":"gpt-5.6-luna","input":"A"}'::jsonb,
    'none', '', '[]'::jsonb, 'worker-a'
  ) ->> 'token_reclamacion',
  (select value ->> 'token_reclamacion' from intento_a),
  'repetir el mismo ID devuelve el mismo arrendamiento'
);

create temporary table intento_b as
select prepared as value
from (
  select public.preparar_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000002',
    'observabilidad',
    'ea200000-0000-4000-8000-000000000001',
    'pgtap-core',
    1,
    '{"run":"B"}'::jsonb,
    '{"model":"gpt-5.6-luna","input":"B"}'::jsonb,
    'none', '', '[]'::jsonb, 'worker-b'
  ) prepared
) created;

select is(
  (select value ->> 'estado' from intento_b),
  'reclamado',
  'un intento más reciente queda activo'
);
select is(
  public.consultar_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000001'
  ) ->> 'estado',
  'obsoleto',
  'preparar B vuelve obsoleto A bajo el lock de entidad'
);
select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.reclamar_intentos_generacion_ia('pgtap-core', 'cron', 20)
    )
  ),
  0,
  'el cron no roba el arrendamiento vigente de B ni reclama A obsoleto'
);
select is(
  public.vincular_respuesta_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000001',
    (select (value ->> 'token_reclamacion')::uuid from intento_a),
    'resp_a_tardia', 'completed', now()
  ) ->> 'resolution',
  'stale',
  'A no puede vincular una respuesta después de ser sustituido'
);
select is(
  public.vincular_respuesta_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000002',
    'ea300000-0000-4000-8000-000000000099',
    'resp_b', 'queued', now()
  ) ->> 'resolution',
  'claimed_elsewhere',
  'un token ajeno no puede vincular B'
);
select is(
  public.vincular_respuesta_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000002',
    (select (value ->> 'token_reclamacion')::uuid from intento_b),
    'resp_b', 'queued', now()
  ) ->> 'resolution',
  'linked',
  'el propietario de B vincula el response_id ganador'
);
select is(
  public.marcar_intento_generacion_ia_publicado(
    'ea100000-0000-4000-8000-000000000002',
    'ea300000-0000-4000-8000-000000000099'
  ),
  false,
  'un token ajeno no marca publicado'
);
select is(
  public.marcar_intento_generacion_ia_publicado(
    'ea100000-0000-4000-8000-000000000002',
    (select (value ->> 'token_reclamacion')::uuid from intento_b)
  ),
  true,
  'el handler vigente puede cerrar el outbox en su transacción'
);
select is(
  public.consultar_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000002'
  ) ->> 'estado',
  'publicado',
  'el intento publicado queda terminal'
);

create temporary table intento_expirable as
select prepared as value
from (
  select public.preparar_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000003',
    'observabilidad',
    'ea200000-0000-4000-8000-000000000003',
    'pgtap-expiry',
    1,
    '{"run":"expiry"}'::jsonb,
    '{"model":"gpt-5.6-luna","input":"expiry"}'::jsonb,
    'none', '', '[]'::jsonb, 'worker-expiry'
  ) prepared
) created;

reset role;
update private.intentos_generacion_ia
set fecha_limite = now() - interval '1 second',
    reclamado_hasta = now() - interval '1 second'
where id = 'ea100000-0000-4000-8000-000000000003';
set local role service_role;

create temporary table expiracion_reclamada as
select item as value
from jsonb_array_elements(
  public.expirar_intentos_generacion_ia('pgtap-expiry', 10)
) item;

select is(
  (select count(*)::integer from expiracion_reclamada),
  1,
  'la primitiva reclama el intento vencido para su handler'
);
select is(
  (select value ->> 'estado' from expiracion_reclamada),
  'expirado',
  'el outbox queda expirado sin asumir la transición de la entidad'
);
select isnt(
  (select value ->> 'token_reclamacion' from expiracion_reclamada),
  (select value ->> 'token_reclamacion' from intento_expirable),
  'la aplicación terminal recibe un token nuevo'
);
select is(
  public.confirmar_terminal_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000003',
    (select (value ->> 'token_reclamacion')::uuid from intento_expirable)
  ),
  false,
  'el token anterior no confirma el fallo terminal'
);
select is(
  public.confirmar_terminal_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000003',
    (select (value ->> 'token_reclamacion')::uuid from expiracion_reclamada)
  ),
  true,
  'el adaptador vigente confirma la aplicación terminal por CAS'
);
select ok(
  (
    public.consultar_intento_generacion_ia(
      'ea100000-0000-4000-8000-000000000003'
    ) ->> 'terminal_aplicado_en'
  ) is not null,
  'la confirmación terminal queda observable'
);
select is(
  jsonb_array_length(
    public.expirar_intentos_generacion_ia('pgtap-expiry', 10)
  ),
  0,
  'un terminal confirmado no vuelve a entregarse'
);

create temporary table intento_fallido as
select prepared as value
from (
  select public.preparar_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000004',
    'observabilidad',
    'ea200000-0000-4000-8000-000000000004',
    'pgtap-failure',
    1,
    '{"run":"failure"}'::jsonb,
    '{"model":"gpt-5.6-luna","input":"failure"}'::jsonb,
    'none', '', '[]'::jsonb, 'worker-failure'
  ) prepared
) created;

reset role;
update private.intentos_generacion_ia
set estado = 'fallido',
    token_reclamacion = null,
    reclamado_por = null,
    reclamado_hasta = null,
    ultimo_error = '{"code":"OPENAI_FAILED","message":"fallo remoto"}'::jsonb
where id = 'ea100000-0000-4000-8000-000000000004';
set local role service_role;

create temporary table fallo_reclamado as
select item as value
from jsonb_array_elements(
  public.expirar_intentos_generacion_ia('pgtap-failure', 10)
) item;

select is(
  (select count(*)::integer from fallo_reclamado),
  1,
  'un fallo terminal no confirmado se vuelve a entregar'
);
select is(
  (select value ->> 'estado' from fallo_reclamado),
  'fallido',
  'la reentrega conserva el estado fallido'
);
select is(
  (select value #>> '{ultimo_error,code}' from fallo_reclamado),
  'OPENAI_FAILED',
  'la reentrega conserva el error terminal original'
);
select ok(
  public.confirmar_terminal_intento_generacion_ia(
    'ea100000-0000-4000-8000-000000000004',
    (select (value ->> 'token_reclamacion')::uuid from fallo_reclamado)
  ),
  'el adaptador confirma el fallo con el token de reentrega'
);
select is(
  jsonb_array_length(
    public.expirar_intentos_generacion_ia('pgtap-failure', 10)
  ),
  0,
  'el fallo confirmado deja de reentregarse'
);

select * from finish();
rollback;
