begin;

select plan(10);

set local role service_role;

create temporary table chat_title_fixture as
select
  (select id from public.planes_estudio order by creado_en limit 1) as plan_id,
  (select id from public.asignaturas order by creado_en limit 1) as asignatura_id,
  (select id from public.usuarios_app order by creado_en limit 1) as usuario_id;

select ok(
  (select plan_id is not null and asignatura_id is not null and usuario_id is not null
   from chat_title_fixture),
  'existen entidades base para probar títulos de ambos tipos de chat'
);

insert into public.conversaciones_plan (
  id, plan_estudio_id, openai_conversation_id, nombre
)
select
  'c7100000-0000-4000-8000-000000000001',
  plan_id,
  'conv_plan_titulo_legacy_test',
  'Consulta académica'
from chat_title_fixture;

insert into public.conversaciones_plan (
  id, plan_estudio_id, openai_conversation_id, nombre
)
select
  'c7100000-0000-4000-8000-000000000002',
  plan_id,
  'conv_plan_titulo_manual_test',
  'Arquitectura curricular institucional'
from chat_title_fixture;

insert into public.conversaciones_asignatura (
  id, asignatura_id, openai_conversation_id, nombre
)
select
  'c7100000-0000-4000-8000-000000000003',
  asignatura_id,
  'conv_asignatura_titulo_legacy_test',
  'Chat 2026-07-21'
from chat_title_fixture;

insert into public.plan_mensajes_ia (
  id, enviado_por, mensaje, conversacion_plan_id, fecha_creacion
)
select
  'c7200000-0000-4000-8000-000000000001',
  usuario_id,
  'Necesito comparar la progresión de competencias entre semestres.',
  'c7100000-0000-4000-8000-000000000001',
  '2026-07-21 10:00:00'
from chat_title_fixture;

insert into public.plan_mensajes_ia (
  id, enviado_por, mensaje, conversacion_plan_id, fecha_creacion
)
select
  'c7200000-0000-4000-8000-000000000002',
  usuario_id,
  'Este segundo mensaje no debe convertirse en título.',
  'c7100000-0000-4000-8000-000000000001',
  '2026-07-21 10:01:00'
from chat_title_fixture;

insert into public.plan_mensajes_ia (
  id, enviado_por, mensaje, conversacion_plan_id, fecha_creacion
)
select
  'c7200000-0000-4000-8000-000000000003',
  usuario_id,
  'Analiza los créditos del plan.',
  'c7100000-0000-4000-8000-000000000002',
  '2026-07-21 10:00:00'
from chat_title_fixture;

insert into public.asignatura_mensajes_ia (
  id, enviado_por, mensaje, conversacion_asignatura_id, fecha_creacion
)
select
  'c7200000-0000-4000-8000-000000000004',
  usuario_id,
  'Por favor revisa la secuencia de resultados de aprendizaje.',
  'c7100000-0000-4000-8000-000000000003',
  '2026-07-21 10:00:00'
from chat_title_fixture;

create temporary table primer_backfill as
select * from private.reparar_titulos_conversaciones_ia_legacy();

select is(
  private.titulo_conversacion_ia_desde_prompt(
    'Necesito comparar la progresión de competencias entre semestres.'
  ),
  'comparar la progresión de competencias entre semestres',
  'el título determinista elimina frases introductorias'
);

select is(
  (select nombre from public.conversaciones_plan
   where id = 'c7100000-0000-4000-8000-000000000001'),
  'comparar la progresión de competencias entre semestres',
  'el chat de plan adopta el primer prompt como título'
);

select is(
  (select nombre from public.conversaciones_asignatura
   where id = 'c7100000-0000-4000-8000-000000000003'),
  'la secuencia de resultados de aprendizaje',
  'el chat de asignatura también se repara'
);

select is(
  (select nombre from public.conversaciones_plan
   where id = 'c7100000-0000-4000-8000-000000000002'),
  'Arquitectura curricular institucional',
  'un título manual no se sobrescribe'
);

select is(
  (select planes_actualizados from primer_backfill),
  1,
  'la primera ejecución actualiza sólo el plan genérico'
);

select is(
  (select asignaturas_actualizadas from primer_backfill),
  1,
  'la primera ejecución actualiza sólo la asignatura genérica'
);

create temporary table segundo_backfill as
select * from private.reparar_titulos_conversaciones_ia_legacy();

select ok(
  (select planes_actualizados = 0 and asignaturas_actualizadas = 0
   from segundo_backfill),
  'una segunda ejecución es idempotente'
);

reset role;

select ok(
  not has_function_privilege(
    'authenticated',
    'private.reparar_titulos_conversaciones_ia_legacy()',
    'execute'
  ),
  'el cliente no puede ejecutar el backfill interno'
);

set local role service_role;
select lives_ok(
  $$select * from private.reparar_titulos_conversaciones_ia_legacy()$$,
  'service_role puede volver a ejecutar el mantenimiento sin errores'
);
reset role;

select * from finish();
rollback;
