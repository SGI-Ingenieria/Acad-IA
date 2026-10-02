begin;

\ir _fixtures_usuarios.inc

select plan(15);

select is((select count(*)::integer from pg_policies
  where schemaname = 'public' and tablename in ('comentarios_asignatura', 'comentarios_plan')
    and policyname like '%revision_abierta' and permissive = 'RESTRICTIVE'),
  6, 'el cierre agrega restricciones sin conceder permisos ni ocultar el historial');

insert into public.planes_estudio (
  id, carrera_id, estructura_id, fecha_inicio_imparticion, tipo_ciclo,
  numero_ciclos, semanas_por_ciclo, estado_actual_id, tipo_origen, creado_por
)
select '95000000-0000-4000-8000-000000000001',
  (select id from public.carreras order by id limit 1), ep.id, '2099-01-01',
  'Semestre', 8, 16, (select id from public.estados_plan where clave = 'BORRADOR'),
  'MANUAL', '90000000-0000-4000-8000-000000000001'
from public.estructuras_plan ep
where ep.tipo = 'CURRICULAR' and ep.estado_publicacion = 'PUBLICADA' limit 1;

insert into public.asignaturas (id, plan_estudio_id, estructura_id, nombre, estado, creado_por)
select '95000000-0000-4000-8000-000000000002', p.id, ea.id,
  'Observaciones de prueba', 'borrador', '90000000-0000-4000-8000-000000000001'
from public.planes_estudio p join public.estructuras_asignatura ea on ea.estructura_plan_id = p.estructura_id
where p.id = '95000000-0000-4000-8000-000000000001' limit 1;

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$insert into public.comentarios_asignatura (id, asignatura_id, autor_id, cuerpo)
  values ('95000000-0000-4000-8000-000000000003', '95000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000001', 'Observación previa')$$,
  'se puede observar una asignatura en borrador');
select lives_ok($$insert into public.comentarios_plan (id, plan_estudio_id, asignatura_id, autor_id, cuerpo)
  values ('95000000-0000-4000-8000-000000000004', '95000000-0000-4000-8000-000000000001',
    '95000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'Observación legada')$$,
  'la ruta legada funciona antes de aprobar');

reset role;
update public.asignaturas set estado = 'aprobada' where id = '95000000-0000-4000-8000-000000000002';
set local role service_role;
select lives_ok($$insert into public.comentarios_plan (plan_estudio_id, asignatura_id, autor_id, cuerpo)
  values ('95000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000001', 'Motivo de aprobación')$$,
  'el servicio de transición conserva su comentario histórico después de aprobar');
set local role authenticated;

select throws_ok($$insert into public.comentarios_asignatura (asignatura_id, autor_id, cuerpo)
  values ('95000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'No permitido')$$,
  '42501', null::text, 'ni ADMIN puede añadir observaciones directas a una asignatura aprobada');
select throws_ok($$insert into public.comentarios_plan (plan_estudio_id, asignatura_id, autor_id, cuerpo)
  values ('95000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000001', 'No permitido')$$,
  '42501', null::text, 'la ruta legada no permite eludir el cierre');

with filas as (update public.comentarios_asignatura set resuelto = true
  where id = '95000000-0000-4000-8000-000000000003' returning id)
select is((select count(*)::integer from filas), 0, 'no se puede resolver ni reabrir observaciones cerradas');
with filas as (update public.comentarios_plan set resuelto = true
  where id = '95000000-0000-4000-8000-000000000004' returning id)
select is((select count(*)::integer from filas), 0, 'no se puede modificar una observación legada cerrada');
with filas as (delete from public.comentarios_asignatura
  where id = '95000000-0000-4000-8000-000000000003' returning id)
select is((select count(*)::integer from filas), 0, 'las observaciones aprobadas no se borran');
with filas as (delete from public.comentarios_plan
  where id = '95000000-0000-4000-8000-000000000004' returning id)
select is((select count(*)::integer from filas), 0, 'se conserva el historial legado');
select is((select count(*)::integer from public.comentarios_asignatura
  where asignatura_id = '95000000-0000-4000-8000-000000000002'), 1,
  'las observaciones siguen siendo visibles después de aprobar');
select lives_ok($$insert into public.comentarios_plan (plan_estudio_id, autor_id, cuerpo)
  values ('95000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'Comentario del plan')$$,
  'las observaciones generales del plan no se bloquean por una asignatura aprobada');

reset role;
update public.asignaturas set estado = 'borrador' where id = '95000000-0000-4000-8000-000000000002';
set local role authenticated;
select lives_ok($$insert into public.comentarios_asignatura (asignatura_id, autor_id, cuerpo)
  values ('95000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'Tras reapertura')$$,
  'volver a borrador habilita nuevas observaciones');
with filas as (update public.comentarios_asignatura set resuelto = true
  where id = '95000000-0000-4000-8000-000000000003' returning id)
select is((select count(*)::integer from filas), 1, 'volver a borrador habilita resolver observaciones');
with filas as (update public.comentarios_plan set resuelto = true
  where id = '95000000-0000-4000-8000-000000000004' returning id)
select is((select count(*)::integer from filas), 1, 'volver a borrador habilita la ruta legada');

select * from finish();
rollback;
