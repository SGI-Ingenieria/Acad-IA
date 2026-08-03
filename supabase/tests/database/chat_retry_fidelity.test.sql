begin;

\ir _fixtures_usuarios.inc

select plan(11);

set local role service_role;

create temporary table chat_retry_fixture as
select
  (select id from public.planes_estudio order by creado_en limit 1) as plan_id,
  (select id from public.asignaturas order by creado_en limit 1) as asignatura_id,
  (select id from public.usuarios_app order by creado_en limit 1) as usuario_id;

select ok(
  (select plan_id is not null and asignatura_id is not null and usuario_id is not null
   from chat_retry_fixture),
  'existen entidades base para probar reintentos de ambos tipos de chat'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plan_mensajes_ia'
      and column_name = 'retry_of_message_id'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plan_mensajes_ia'
      and column_name = 'web_search_enabled'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plan_mensajes_ia'
      and column_name = 'reasoning_effort'
  ),
  'los mensajes de plan conservan controles y linaje del request'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asignatura_mensajes_ia'
      and column_name = 'retry_of_message_id'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asignatura_mensajes_ia'
      and column_name = 'web_search_enabled'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asignatura_mensajes_ia'
      and column_name = 'reasoning_effort'
  ),
  'los mensajes de asignatura conservan controles y linaje del request'
);

insert into public.conversaciones_plan (
  id, plan_estudio_id, openai_conversation_id, creado_por
)
select
  'ca100000-0000-4000-8000-000000000001',
  plan_id,
  'conv_retry_plan_1',
  usuario_id
from chat_retry_fixture;

insert into public.conversaciones_plan (
  id, plan_estudio_id, openai_conversation_id, creado_por
)
select
  'ca100000-0000-4000-8000-000000000002',
  plan_id,
  'conv_retry_plan_2',
  usuario_id
from chat_retry_fixture;

insert into public.plan_mensajes_ia (
  id, enviado_por, mensaje, conversacion_plan_id
)
select
  'ca200000-0000-4000-8000-000000000001',
  usuario_id,
  'Solicitud original de plan.',
  'ca100000-0000-4000-8000-000000000001'
from chat_retry_fixture;

select ok(
  (select web_search_enabled = false and reasoning_effort = 'auto'
   from public.plan_mensajes_ia
   where id = 'ca200000-0000-4000-8000-000000000001'),
  'los controles anteriores conservan defaults compatibles'
);

select lives_ok(
  $$ insert into public.plan_mensajes_ia (
       id, enviado_por, mensaje, conversacion_plan_id,
       web_search_enabled, reasoning_effort, retry_of_message_id
     )
     select
       'ca200000-0000-4000-8000-000000000002', usuario_id,
       'Reintento fiel de plan.', 'ca100000-0000-4000-8000-000000000001',
       true, 'high', 'ca200000-0000-4000-8000-000000000001'
     from chat_retry_fixture $$,
  'un reintento con el mismo autor y conversación es válido'
);

select throws_ok(
  $$ insert into public.plan_mensajes_ia (
       id, enviado_por, mensaje, conversacion_plan_id, retry_of_message_id
     )
     select
       'ca200000-0000-4000-8000-000000000003', usuario_id,
       'Cruce de conversación.', 'ca100000-0000-4000-8000-000000000002',
       'ca200000-0000-4000-8000-000000000001'
     from chat_retry_fixture $$,
  '23503',
  null,
  'la base rechaza un mensaje original de otra conversación'
);

select throws_ok(
  $$ insert into public.plan_mensajes_ia (
       id, enviado_por, mensaje, conversacion_plan_id, retry_of_message_id
     ) values (
       'ca200000-0000-4000-8000-000000000004',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
       'Suplantación de autor.',
       'ca100000-0000-4000-8000-000000000001',
       'ca200000-0000-4000-8000-000000000001'
     ) $$,
  '23503',
  null,
  'la base rechaza un mensaje original de otro autor'
);

select throws_ok(
  $$ insert into public.plan_mensajes_ia (
       enviado_por, mensaje, conversacion_plan_id, reasoning_effort
     )
     select usuario_id, 'Control inválido.',
       'ca100000-0000-4000-8000-000000000001', 'extreme'
     from chat_retry_fixture $$,
  '23514',
  null,
  'la base rechaza niveles de razonamiento desconocidos'
);

insert into public.conversaciones_asignatura (
  id, asignatura_id, openai_conversation_id, creado_por
)
select
  'ca100000-0000-4000-8000-000000000003',
  asignatura_id,
  'conv_retry_asignatura_1',
  usuario_id
from chat_retry_fixture;

insert into public.asignatura_mensajes_ia (
  id, enviado_por, mensaje, conversacion_asignatura_id
)
select
  'ca200000-0000-4000-8000-000000000005',
  usuario_id,
  'Solicitud original de asignatura.',
  'ca100000-0000-4000-8000-000000000003'
from chat_retry_fixture;

select lives_ok(
  $$ insert into public.asignatura_mensajes_ia (
       id, enviado_por, mensaje, conversacion_asignatura_id,
       web_search_enabled, reasoning_effort, retry_of_message_id
     )
     select
       'ca200000-0000-4000-8000-000000000006', usuario_id,
       'Reintento fiel de asignatura.',
       'ca100000-0000-4000-8000-000000000003',
       true, 'medium', 'ca200000-0000-4000-8000-000000000005'
     from chat_retry_fixture $$,
  'el mismo linaje protegido aplica al chat de asignatura'
);

select throws_ok(
  $$ delete from public.plan_mensajes_ia
     where id = 'ca200000-0000-4000-8000-000000000001' $$,
  '23503',
  null,
  'un mensaje original con reintentos no pierde su trazabilidad'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'plan_mensajes_ia_retry_of_message_id_idx'
  ) and exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'asignatura_mensajes_ia_retry_of_message_id_idx'
  ),
  'ambos linajes de reintento tienen índices de consulta'
);

select * from finish();
rollback;
