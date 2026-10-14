begin;
\ir _fixtures_usuarios.inc
select plan(12);
set local request.jwt.claims = '{"role":"service_role"}';

select ok(not has_function_privilege(
  'authenticated', 'public.reintentar_generacion_asignatura_ia(uuid,uuid,uuid,text)', 'execute'
), 'el cliente no puede saltarse el backend de reintento');
select ok(has_function_privilege(
  'service_role', 'public.reintentar_generacion_asignatura_ia(uuid,uuid,uuid,text)', 'execute'
), 'el backend puede reintentar');

insert into public.planes_estudio (
  id, carrera_id, estructura_id, fecha_inicio_imparticion, tipo_ciclo,
  numero_ciclos, estado_actual_id, tipo_origen, creado_por
) values (
  'ea300000-0000-4000-8000-000000000001',
  (select id from public.carreras limit 1),
  (select id from public.estructuras_plan where tipo = 'CURRICULAR' limit 1),
  '2026-08-01', 'Semestre', 8,
  (select id from public.estados_plan where clave = 'BORRADOR' limit 1),
  'IA', '90000000-0000-4000-8000-000000000001'
);
insert into public.asignaturas (
  id, plan_estudio_id, estructura_id, nombre, estado, tipo_origen, creado_por
) values (
  'ea400000-0000-4000-8000-000000000001',
  'ea300000-0000-4000-8000-000000000001',
  (select id from public.estructuras_asignatura where estructura_plan_id =
    (select estructura_id from public.planes_estudio where id = 'ea300000-0000-4000-8000-000000000001') limit 1),
  'Asignatura de prueba de reintento', 'generando', 'IA',
  '90000000-0000-4000-8000-000000000001'
);

select public.preparar_intento_entidad_ia(
  'ea500000-0000-4000-8000-000000000001', 'asignatura',
  'ea400000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001',
  '{"model":"modelo-original","reasoningEffort":"high"}',
  '{"model":"modelo-original","background":true,"input":[{"role":"system","content":"Reglas originales"},{"role":"user","content":"Prompt original con enfoque e instrucciones"}],"reasoning":{"effort":"high"},"tools":[{"type":"web_search"}],"text":{"format":{"type":"json_schema","name":"asignatura","schema":{"type":"object"}}},"metadata":{"tabla":"asignaturas","id":"ea400000-0000-4000-8000-000000000001"}}',
  'retrieval', 'consulta original',
  '[{"fileId":"ea600000-0000-4000-8000-000000000001","fileVersionId":"ea600000-0000-4000-8000-000000000002","chunkIds":["ea600000-0000-4000-8000-000000000003"],"scores":{}}]',
  'test:retry'
) is not null as preparado;

update public.asignaturas set estado = 'fallida'
where id = 'ea400000-0000-4000-8000-000000000001';

select throws_ok($$select public.reintentar_generacion_asignatura_ia(
  'ea400000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002',
  'ea500000-0000-4000-8000-000000000002', 'usuario'
)$$, '42501', 'No tienes permiso para generar asignaturas con IA en este plan.',
'rechaza a otro usuario sin permisos');

create temporary table _reintento as select public.reintentar_generacion_asignatura_ia(
  'ea400000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
  'ea500000-0000-4000-8000-000000000002', 'safety-actual'
) as value;

select is((select estado::text from public.asignaturas where id = 'ea400000-0000-4000-8000-000000000001'),
  'generando', 'reutiliza la asignatura y pasa a generando');
select is((select count(*)::integer from public.asignaturas where plan_estudio_id = 'ea300000-0000-4000-8000-000000000001'),
  1, 'no crea otra asignatura');
select is((select value #>> '{attempt,contexto,retryOfAttemptId}' from _reintento),
  'ea500000-0000-4000-8000-000000000001', 'conserva la trazabilidad del intento anterior');
select is(
  (select value #> '{attempt,solicitud}' from _reintento) - 'safety_identifier',
  (select solicitud from private.intentos_generacion_ia where id = 'ea500000-0000-4000-8000-000000000001'),
  'conserva exactamente prompt, modelo, esquema, herramientas y razonamiento');
select is((select value #> '{attempt,referencias}' from _reintento),
  (select referencias from private.intentos_generacion_ia where id = 'ea500000-0000-4000-8000-000000000001'),
  'conserva las versiones y fragmentos documentales');
select is((select meta_origen #>> '{ai,activeAttemptId}' from public.asignaturas where id = 'ea400000-0000-4000-8000-000000000001'),
  'ea500000-0000-4000-8000-000000000002', 'el nuevo intento queda activo en la misma transacción');
select throws_ok($$select public.reintentar_generacion_asignatura_ia(
  'ea400000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
  'ea500000-0000-4000-8000-000000000003', 'usuario'
)$$, '55000', 'La asignatura ya no admite un reintento.',
'un segundo reintento no duplica el trabajo activo');

update public.asignaturas set estado = 'fallida', meta_origen = '{}'
where id = 'ea400000-0000-4000-8000-000000000001';
select throws_ok($$select public.reintentar_generacion_asignatura_ia(
  'ea400000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
  'ea500000-0000-4000-8000-000000000003', 'usuario'
)$$, 'P0001', 'No se conserva la solicitud original de esta generación.',
'un registro antiguo sin snapshot devuelve un error explícito');
select is((select estado::text from public.asignaturas where id = 'ea400000-0000-4000-8000-000000000001'),
  'fallida', 'un reintento rechazado conserva el estado fallido');

select * from finish();
rollback;
