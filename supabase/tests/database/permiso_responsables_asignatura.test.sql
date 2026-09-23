begin;

\ir _fixtures_usuarios.inc

select plan(19);

select is((select count(*)::integer from pg_policies
  where schemaname = 'public' and tablename = 'responsables_asignatura'
    and policyname like '%permiso_gestion' and permissive = 'RESTRICTIVE'),
  3, 'se exige permiso de gestión sin sustituir las políticas de ámbito');

insert into public.planes_estudio (
  id, carrera_id, estructura_id, fecha_inicio_imparticion, tipo_ciclo,
  numero_ciclos, semanas_por_ciclo, estado_actual_id, tipo_origen, creado_por
)
select '96000000-0000-4000-8000-000000000001',
  (select id from public.carreras order by id limit 1), ep.id, '2098-01-01',
  'Semestre', 8, 16, (select id from public.estados_plan where clave = 'BORRADOR'),
  'MANUAL', '90000000-0000-4000-8000-000000000001'
from public.estructuras_plan ep
where ep.tipo = 'CURRICULAR' and ep.estado_publicacion = 'PUBLICADA' limit 1;

insert into public.asignaturas (id, plan_estudio_id, estructura_id, nombre, estado, creado_por)
select '96000000-0000-4000-8000-000000000002', p.id, ea.id,
  'Responsables de prueba', 'borrador', '90000000-0000-4000-8000-000000000001'
from public.planes_estudio p join public.estructuras_asignatura ea on ea.estructura_plan_id = p.estructura_id
where p.id = '96000000-0000-4000-8000-000000000001' limit 1;

-- Secretary is a real content editor without the responsibility-management permission.
insert into public.usuarios_roles (usuario_id, rol_id, facultad_id)
select '90000000-0000-4000-8000-000000000002', r.id, c.facultad_id
from public.roles r, public.planes_estudio p join public.carreras c on c.id = p.carrera_id
where r.clave = 'SECRETARIO_ACADEMICO' and p.id = '96000000-0000-4000-8000-000000000001';
insert into public.usuarios_roles (usuario_id, rol_id, carrera_id)
select '90000000-0000-4000-8000-000000000003', r.id, p.carrera_id
from public.roles r, public.planes_estudio p
where r.clave = 'JEFE_CARRERA' and p.id = '96000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.responsables_asignatura (id, asignatura_id, usuario_id, rol, asignado_por)
  values ('96000000-0000-4000-8000-000000000003', '96000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000002', 'PROFESOR_RESPONSABLE', '90000000-0000-4000-8000-000000000001')$$,
  'ADMIN puede asignar dentro de una etapa editable');
with filas as (update public.responsables_asignatura set rol = 'COAUTOR'
  where id = '96000000-0000-4000-8000-000000000003' returning id)
select is((select count(*)::integer from filas), 1, 'ADMIN conserva actualización autorizada');
with filas as (delete from public.responsables_asignatura
  where id = '96000000-0000-4000-8000-000000000003' returning id)
select is((select count(*)::integer from filas), 1, 'ADMIN conserva eliminación autorizada');

-- Keep a visible assignment so UPDATE/DELETE test permission, not absence of a row.
insert into public.responsables_asignatura (id, asignatura_id, usuario_id, rol, asignado_por)
values ('96000000-0000-4000-8000-000000000003', '96000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000002', 'PROFESOR_RESPONSABLE', '90000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select ok(public.authz_asignatura_write_allowed('96000000-0000-4000-8000-000000000002'),
  'el actor sin permiso específico sí puede editar el contenido');
select ok(not public.authz_has_permission('asignaturas.responsables.gestionar'),
  'el editor no tiene permiso para gestionar responsables');
select is((select count(*)::integer from public.responsables_asignatura
  where id = '96000000-0000-4000-8000-000000000003'), 1,
  'la lectura de los responsables permanece intacta');
select throws_ok($$insert into public.responsables_asignatura (asignatura_id, usuario_id, rol, asignado_por)
  values ('96000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
    'PROFESOR_RESPONSABLE', '90000000-0000-4000-8000-000000000002')$$,
  '42501', null::text, 'un editor sin permiso no puede asignar responsables');
with filas as (update public.responsables_asignatura set rol = 'REVISOR'
  where id = '96000000-0000-4000-8000-000000000003' returning id)
select is((select count(*)::integer from filas), 0, 'un editor sin permiso no puede actualizar responsables');
with filas as (delete from public.responsables_asignatura
  where id = '96000000-0000-4000-8000-000000000003' returning id)
select is((select count(*)::integer from filas), 0, 'un editor sin permiso no puede retirar responsables');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select ok(public.authz_has_permission('asignaturas.responsables.gestionar'),
  'la jefatura posee el permiso canónico');
select ok(public.authz_asignatura_write_allowed('96000000-0000-4000-8000-000000000002'),
  'la jefatura conserva ámbito y etapa válidos');
select lives_ok($$insert into public.responsables_asignatura (id, asignatura_id, usuario_id, rol, asignado_por)
  values ('96000000-0000-4000-8000-000000000004', '96000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000001', 'PROFESOR_RESPONSABLE', '90000000-0000-4000-8000-000000000003')$$,
  'el gestor válido puede asignar');
with filas as (update public.responsables_asignatura set rol = 'COAUTOR'
  where id = '96000000-0000-4000-8000-000000000004' returning id)
select is((select count(*)::integer from filas), 1, 'el gestor válido puede actualizar');
with filas as (delete from public.responsables_asignatura
  where id = '96000000-0000-4000-8000-000000000004' returning id)
select is((select count(*)::integer from filas), 1, 'el gestor válido puede retirar');

-- Internal endpoints already authorize callers before using service_role.
-- An unprivileged actor claim does not accidentally restrict that internal role.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"service_role"}', true);
set local role service_role;
select lives_ok($$insert into public.responsables_asignatura (id, asignatura_id, usuario_id, rol, asignado_por)
  values ('96000000-0000-4000-8000-000000000005', '96000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000003', 'COAUTOR', '90000000-0000-4000-8000-000000000001')$$,
  'service_role conserva la asignación de los flujos internos');
with filas as (update public.responsables_asignatura set rol = 'REVISOR'
  where id = '96000000-0000-4000-8000-000000000005' returning id)
select is((select count(*)::integer from filas), 1, 'service_role conserva actualización');
with filas as (delete from public.responsables_asignatura
  where id = '96000000-0000-4000-8000-000000000005' returning id)
select is((select count(*)::integer from filas), 1, 'service_role conserva eliminación');

-- Permission alone must not bypass the existing workflow-stage rule.
reset role;
update public.planes_estudio set estado_actual_id =
  (select id from public.estados_plan where clave = 'REV_PLANEACION')
where id = '96000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into public.responsables_asignatura (asignatura_id, usuario_id, rol, asignado_por)
  values ('96000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
    'REVISOR', '90000000-0000-4000-8000-000000000003')$$,
  '42501', null::text, 'el permiso no omite las restricciones de ámbito y etapa');

select * from finish();
rollback;
