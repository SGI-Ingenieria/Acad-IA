begin;

select plan(26);

select has_table(
  'private',
  'intentos_generacion_ia',
  'existe el outbox privado y genérico de generaciones'
);
select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'private.intentos_generacion_ia'::regclass),
  'el outbox tiene RLS habilitado'
);
select ok(
  not has_table_privilege(
    'service_role', 'private.intentos_generacion_ia', 'select'
  ),
  'service_role tampoco puede leer el outbox directamente'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.preparar_intento_chat_ia(uuid,public.tipo_conversacion_documental,uuid,uuid,uuid,jsonb,text,text,jsonb,text)',
    'execute'
  ),
  'authenticated no puede preparar intentos internos'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.preparar_intento_chat_ia(uuid,public.tipo_conversacion_documental,uuid,uuid,uuid,jsonb,text,text,jsonb,text)',
    'execute'
  ),
  'service_role puede preparar intentos internos'
);

set local role service_role;

create temporary table chat_intento_fixture as
select
  (select id from public.planes_estudio order by creado_en limit 1) as plan_id,
  (select id from public.usuarios_app order by creado_en limit 1) as usuario_id;

select ok(
  (select plan_id is not null and usuario_id is not null
   from chat_intento_fixture),
  'existen plan y usuario base'
);

insert into public.conversaciones_plan (
  id, plan_estudio_id, openai_conversation_id, creado_por, nombre
)
select
  'da100000-0000-4000-8000-000000000001',
  plan_id,
  'conv_chat_intento_durable',
  usuario_id,
  'Intento durable'
from chat_intento_fixture;

insert into public.plan_mensajes_ia (
  id, enviado_por, mensaje, conversacion_plan_id, estado
)
select
  'da200000-0000-4000-8000-000000000001',
  usuario_id,
  'Solicitud durable sin referencias.',
  'da100000-0000-4000-8000-000000000001',
  'PROCESANDO'
from chat_intento_fixture;

create temporary table chat_intento_claim (
  id uuid primary key,
  token uuid not null
) on commit drop;

insert into chat_intento_claim (id, token)
select
  (prepared ->> 'id')::uuid,
  (prepared ->> 'token_reclamacion')::uuid
from (
  select public.preparar_intento_chat_ia(
    'da300000-0000-4000-8000-000000000001',
    'plan',
    'da100000-0000-4000-8000-000000000001',
    'da200000-0000-4000-8000-000000000001',
    (select usuario_id from chat_intento_fixture),
    '{
      "model":"gpt-5.6-luna",
      "background":true,
      "metadata":{"tabla":"plan_mensajes_ia"},
      "input":[
        {"role":"system","content":"Sistema"},
        {"role":"user","content":"Solicitud durable"}
      ]
    }'::jsonb,
    'none',
    'Solicitud durable',
    '[]'::jsonb,
    'pgtap:init'
  ) prepared
) created;

select is(
  (select count(*)::integer from chat_intento_claim),
  1,
  'el intento queda durable y reclamado antes de OpenAI'
);
select is(
  (select openai_response_id
   from public.plan_mensajes_ia
   where id = 'da200000-0000-4000-8000-000000000001'),
  null::text,
  'preparar no expone un response_id parcial en el mensaje'
);
select is(
  jsonb_array_length(public.reclamar_intentos_chat_ia('cron-temprano', 5)),
  0,
  'otro actor no roba un arrendamiento vigente'
);

select is(
  public.vincular_respuesta_intento_chat_ia(
    'da300000-0000-4000-8000-000000000001',
    'da400000-0000-4000-8000-000000000099',
    'resp_token_incorrecto',
    'queued',
    now()
  ) ->> 'resolution',
  'claimed_elsewhere',
  'un token ajeno no puede vincular la respuesta'
);
select is(
  public.consultar_intento_chat_ia(
    'da300000-0000-4000-8000-000000000001'
  ) ->> 'openai_response_id',
  null::text,
  'el token ajeno no deja un vínculo parcial'
);

select is(
  public.vincular_respuesta_intento_chat_ia(
    'da300000-0000-4000-8000-000000000001',
    (select token from chat_intento_claim),
    'resp_chat_intento_durable',
    'queued',
    now()
  ) ->> 'resolution',
  'linked',
  'el propietario vincula el primer response_id por CAS'
);
select is(
  (select openai_response_id
   from public.plan_mensajes_ia
   where id = 'da200000-0000-4000-8000-000000000001'),
  null::text,
  'el vínculo privado todavía no expone response_id al cliente'
);
select is(
  public.publicar_intento_chat_ia(
    'da300000-0000-4000-8000-000000000001',
    'da400000-0000-4000-8000-000000000099'
  ) ->> 'resolution',
  'claimed_elsewhere',
  'un token ajeno tampoco puede publicar'
);

select is(
  public.publicar_intento_chat_ia(
    'da300000-0000-4000-8000-000000000001',
    (select token from chat_intento_claim)
  ) ->> 'resolution',
  'applied',
  'el propietario publica mediante una sola transacción'
);
select is(
  (select openai_response_id
   from public.plan_mensajes_ia
   where id = 'da200000-0000-4000-8000-000000000001'),
  'resp_chat_intento_durable',
  'la publicación hace visible el response_id ganador'
);
select is(
  (select count(*)::integer
   from public.trabajos_generacion_ia
   where openai_response_id = 'resp_chat_intento_durable'
     and tipo_entidad = 'chat_plan'),
  1,
  'la misma transacción registra un único trabajo'
);
select is(
  public.consultar_intento_chat_ia(
    'da300000-0000-4000-8000-000000000001'
  ) ->> 'estado',
  'publicado',
  'el outbox queda terminal sólo después del commit completo'
);
select is(
  public.publicar_intento_chat_ia(
    'da300000-0000-4000-8000-000000000001',
    (select token from chat_intento_claim)
  ) ->> 'resolution',
  'already_applied',
  'repetir una publicación confirmada es idempotente'
);

insert into public.plan_mensajes_ia (
  id, enviado_por, mensaje, conversacion_plan_id, estado
)
select
  'da200000-0000-4000-8000-000000000002',
  usuario_id,
  'El webhook debe rescatar este intento.',
  'da100000-0000-4000-8000-000000000001',
  'PROCESANDO'
from chat_intento_fixture;

select public.preparar_intento_chat_ia(
  'da300000-0000-4000-8000-000000000002',
  'plan',
  'da100000-0000-4000-8000-000000000001',
  'da200000-0000-4000-8000-000000000002',
  (select usuario_id from chat_intento_fixture),
  '{
    "model":"gpt-5.6-luna",
    "background":true,
    "metadata":{"tabla":"plan_mensajes_ia"},
    "input":[
      {"role":"system","content":"Sistema"},
      {"role":"user","content":"Rescate webhook"}
    ]
  }'::jsonb,
  'none', '', '[]'::jsonb, 'pgtap:caido'
);

select is(
  public.adoptar_publicar_intento_chat_ia_webhook(
    'da300000-0000-4000-8000-000000000002',
    'resp_rescatada_webhook',
    'completed',
    now()
  ) ->> 'resolution',
  'applied',
  'el webhook rescata la caída entre OpenAI y la vinculación local'
);
select is(
  (select openai_response_id
   from public.plan_mensajes_ia
   where id = 'da200000-0000-4000-8000-000000000002'),
  'resp_rescatada_webhook',
  'el rescate publica la respuesta de webhook'
);
select is(
  public.adoptar_publicar_intento_chat_ia_webhook(
    'da300000-0000-4000-8000-000000000002',
    'resp_duplicada_tardia',
    'completed',
    now()
  ) ->> 'resolution',
  'claimed_elsewhere',
  'una respuesta remota duplicada no sustituye al ganador'
);
select is(
  (select openai_response_id
   from public.plan_mensajes_ia
   where id = 'da200000-0000-4000-8000-000000000002'),
  'resp_rescatada_webhook',
  'el ganador permanece intacto tras el duplicado'
);

insert into public.plan_mensajes_ia (
  id, enviado_por, mensaje, conversacion_plan_id, estado
)
select
  'da200000-0000-4000-8000-000000000003',
  usuario_id,
  'El cron debe recuperar el arrendamiento.',
  'da100000-0000-4000-8000-000000000001',
  'PROCESANDO'
from chat_intento_fixture;

create temporary table chat_lease_old as
select
  (prepared ->> 'token_reclamacion')::uuid as token
from (
  select public.preparar_intento_chat_ia(
    'da300000-0000-4000-8000-000000000003',
    'plan',
    'da100000-0000-4000-8000-000000000001',
    'da200000-0000-4000-8000-000000000003',
    (select usuario_id from chat_intento_fixture),
    '{
      "model":"gpt-5.6-luna",
      "background":true,
      "metadata":{"tabla":"plan_mensajes_ia"},
      "input":[
        {"role":"system","content":"Sistema"},
        {"role":"user","content":"Rescate cron"}
      ]
    }'::jsonb,
    'none', '', '[]'::jsonb, 'pgtap:old-worker'
  ) prepared
) created;

reset role;
update private.intentos_chat_ia
set reclamado_hasta = now() - interval '1 second'
where id = 'da300000-0000-4000-8000-000000000003';
set local role service_role;

create temporary table chat_lease_new as
select
  (item ->> 'token_reclamacion')::uuid as token
from jsonb_array_elements(
  public.reclamar_intentos_chat_ia('pgtap:new-worker', 1)
) item;

select isnt(
  (select token from chat_lease_old),
  (select token from chat_lease_new),
  'un arrendamiento vencido se recupera con token nuevo'
);
select is(
  public.vincular_respuesta_intento_chat_ia(
    'da300000-0000-4000-8000-000000000003',
    (select token from chat_lease_old),
    'resp_worker_antiguo',
    'queued', now()
  ) ->> 'resolution',
  'claimed_elsewhere',
  'el trabajador antiguo no puede vincular tras la recuperación'
);
select is(
  public.vincular_respuesta_intento_chat_ia(
    'da300000-0000-4000-8000-000000000003',
    (select token from chat_lease_new),
    'resp_worker_nuevo',
    'queued', now()
  ) ->> 'resolution',
  'linked',
  'el trabajador recuperado sí vincula la nueva respuesta'
);

select * from finish();
rollback;
