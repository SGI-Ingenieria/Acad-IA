begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
\ir _fixtures_usuarios.inc
select no_plan();

select has_table('public','area_comun_incorporaciones','existen incorporaciones independientes');
select is((select count(*)::int from public.asignaturas where plan_estudio_id='ac000000-0000-4000-8000-000000000003'),20,'catálogo inicial: once fijas y nueve opciones');
select is((select publicacion_id from public.area_comun_configuracion limit 1),null::uuid,'el catálogo inicial permanece en borrador');
select is((select carrera_id from public.planes_estudio where categoria='AREA_COMUN'),null::uuid,'el área no utiliza una carrera ficticia');
select is((select count(*)::int from public.usuarios_roles ur join public.roles r on r.id=ur.rol_id where r.clave='AREA_COMUN'),0,'el rol no se asigna automáticamente');

insert into public.usuarios_roles(usuario_id,rol_id)
select '90000000-0000-4000-8000-000000000002',id from public.roles where clave='AREA_COMUN';
insert into public.usuarios_roles(usuario_id,rol_id,carrera_id)
select '90000000-0000-4000-8000-000000000003',r.id,c.id from public.roles r
cross join (select id from public.carreras limit 1) c where r.clave='SECRETARIO_ACADEMICO';
insert into public.planes_estudio(id,carrera_id,estructura_id,fecha_inicio_imparticion,nombre_display,tipo_ciclo,numero_ciclos,estado_actual_id)
values('a1000000-0000-4000-8000-000000000001',(select id from public.carreras limit 1),
  'ac000000-0000-4000-8000-000000000001','2026-09-01','Plan prueba','Semestre',8,
  (select id from public.estados_plan where clave='BORRADOR' limit 1));
insert into public.planes_estudio(id,carrera_id,estructura_id,fecha_inicio_imparticion,nombre_display,tipo_ciclo,numero_ciclos,estado_actual_id)
values('a1000000-0000-4000-8000-000000000002',(select id from public.carreras limit 1),
  'ac000000-0000-4000-8000-000000000001','2026-09-01','Plan corto','Cuatrimestre',6,
  (select id from public.estados_plan where clave='BORRADOR' limit 1));

select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select ok(public.authz_plan_write_allowed('ac000000-0000-4000-8000-000000000003'),'Área común edita su plan institucional');
select ok(not public.authz_can_access_plan('a1000000-0000-4000-8000-000000000001'),'Área común no recibe alcance global');
set local role authenticated;
select is((select count(*)::int from public.planes_estudio where id='ac000000-0000-4000-8000-000000000003'),1,
  'Área común puede leer la fila de su plan institucional');
reset role;
select lives_ok($$select public.area_comun_publicar('ac000000-0000-4000-8000-000000000003',1)$$,'se publica el catálogo inicial');
select lives_ok($$insert into public.bibliografia_asignatura(asignatura_id,tipo,cita,referencia_en_linea)
  values('ac000000-0000-4000-8000-000000000101','BASICA','Referencia común','https://example.org/referencia')$$,'el área puede editar bibliografía del borrador');
select lives_ok($$select public.area_comun_publicar('ac000000-0000-4000-8000-000000000003',2)$$,'publicación incluye bibliografía textual');

select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select ok(not public.authz_can_access_plan('ac000000-0000-4000-8000-000000000003'),'la licenciatura no accede al borrador');
set local role authenticated;
select is((select count(*)::int from public.planes_estudio where id='ac000000-0000-4000-8000-000000000003'),0,
  'el receptor no lee la fila del plan ni sus datos de gestión');
reset role;
select throws_ok($$select public.area_comun_publicar('ac000000-0000-4000-8000-000000000003',3)$$,'42501','No puedes publicar Área común','la licenciatura no publica');
select throws_ok($$select public.area_comun_incorporar('a1000000-0000-4000-8000-000000000002','{}')$$,'23514','Área común no ha publicado una distribución compatible con este plan','no se adivina distribución para un plan incompatible');
select throws_ok($$select public.area_comun_incorporar('a1000000-0000-4000-8000-000000000001','{}','a1000000-0000-4000-8000-000000000999')$$,
  '40001','La publicación cambió; revisa la línea antes de incorporarla','se rechazan previsualizaciones obsoletas');
select throws_ok($$select public.area_comun_incorporar('a1000000-0000-4000-8000-000000000001','{}')$$,'23514',null,'electivas obligatorias');
select lives_ok($$select public.area_comun_incorporar('a1000000-0000-4000-8000-000000000001',
  '{"electiva-1":"ac000000-0000-4000-8000-000000000112","electiva-2":"ac000000-0000-4000-8000-000000000115"}')$$,'incorporación transaccional');
select is((select count(*)::int from public.asignaturas where plan_estudio_id='a1000000-0000-4000-8000-000000000001'),13,'el receptor tiene once fijas y dos elecciones');
select is((select count(*)::int from public.asignaturas where plan_estudio_id='ac000000-0000-4000-8000-000000000003'),20,'incorporar no modifica el catálogo');
select is((select referencia_en_linea from public.bibliografia_asignatura b join public.asignaturas a on a.id=b.asignatura_id
  where a.plan_estudio_id='a1000000-0000-4000-8000-000000000001' and a.area_comun_origen_id='ac000000-0000-4000-8000-000000000101'),
  'https://example.org/referencia','bibliografía publicada integrada en el receptor');
select ok((select count(*)=1 from public.asignaturas a join public.asignaturas p on p.id=a.prerrequisito_asignatura_id
  where a.plan_estudio_id='a1000000-0000-4000-8000-000000000001' and a.area_comun_origen_id='ac000000-0000-4000-8000-000000000104'
  and p.area_comun_origen_id='ac000000-0000-4000-8000-000000000103' and p.plan_estudio_id=a.plan_estudio_id),'prerrequisitos usan identidades receptoras');
select lives_ok($$select public.area_comun_incorporar('a1000000-0000-4000-8000-000000000001',
  '{"electiva-1":"ac000000-0000-4000-8000-000000000112","electiva-2":"ac000000-0000-4000-8000-000000000115"}')$$,'incorporación repetida idempotente');
select is((select count(*)::int from public.area_comun_incorporaciones where plan_id='a1000000-0000-4000-8000-000000000001'),1,'una sola incorporación por plan');
select is((select count(*)::int from public.asignaturas where plan_estudio_id='a1000000-0000-4000-8000-000000000001'),13,'no se duplican materias');
select throws_ok($$update public.asignaturas set nombre='Cambio local' where plan_estudio_id='a1000000-0000-4000-8000-000000000001'$$,
  '42501','La asignatura es administrada por Área común','se impide editar la proyección incluso por SQL');
select ok(not public.authz_asignatura_ia_allowed((select id from public.asignaturas where plan_estudio_id='a1000000-0000-4000-8000-000000000001' limit 1)),'la IA no puede modificar proyecciones');
select throws_ok($$update public.bibliografia_asignatura set cita='Cambio local' where asignatura_id in
  (select id from public.asignaturas where plan_estudio_id='a1000000-0000-4000-8000-000000000001')$$,
  '42501','El contenido vinculado es de solo lectura','bibliografía protegida');
select throws_ok($$update public.planes_estudio set numero_ciclos=7 where id='a1000000-0000-4000-8000-000000000001'$$,
  '23514','Retira la línea común antes de cambiar la carrera o duración del plan','no se rompe la distribución cambiando duración');

set local role authenticated;
select is((select count(*)::int from public.asignaturas where plan_estudio_id='ac000000-0000-4000-8000-000000000003'),0,'RLS oculta el catálogo en borrador');
select is((select count(*)::int from public.asignaturas where plan_estudio_id='a1000000-0000-4000-8000-000000000001'),13,'RLS permite las materias publicadas del propio plan');
select is((public.area_comun_contexto('a1000000-0000-4000-8000-000000000001')->>'borrador'),null::text,'previsualización no expone borradores');
reset role;

select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$update public.asignaturas set nombre='Nombre revisado' where id='ac000000-0000-4000-8000-000000000101'$$,'edición normal del borrador');
select is((select nombre from public.asignaturas where plan_estudio_id='a1000000-0000-4000-8000-000000000001' and area_comun_origen_id='ac000000-0000-4000-8000-000000000101'),
  'Procesos y Expresión del Pensamiento','guardar borrador no altera lo publicado');
select lives_ok($$select public.area_comun_publicar('ac000000-0000-4000-8000-000000000003',3)$$,'publicar propaga cambios');
select is((select nombre from public.asignaturas where plan_estudio_id='a1000000-0000-4000-8000-000000000001' and area_comun_origen_id='ac000000-0000-4000-8000-000000000101'),
  'Nombre revisado','el receptor observa la nueva publicación');
select throws_ok($$select public.area_comun_publicar('ac000000-0000-4000-8000-000000000003',3)$$,'40001','La configuración cambió; recarga antes de publicar','rechazo de revisión obsoleta');

select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.crear_version_redisenio('a1000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001','{}')$$,'clonar conserva incorporación');
select is((select count(*)::int from public.asignaturas where plan_estudio_id in
  (select id from public.planes_estudio where plan_origen_id='a1000000-0000-4000-8000-000000000001') and area_comun_origen_id is not null),13,'clon contiene proyecciones protegidas');
select is((select count(*)::int from public.asignaturas where plan_estudio_id in
  (select id from public.planes_estudio where plan_origen_id='a1000000-0000-4000-8000-000000000001') and area_comun_origen_id is null),0,'clon no contiene copias editables comunes');

select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
create temp table _ac_config_original as select borrador from public.area_comun_configuracion;
create temp table _ac_publicacion_original as select publicacion_id from public.area_comun_configuracion;
select public.area_comun_guardar_configuracion(plan_id,revision,
  (select jsonb_agg(jsonb_set(d,'{espacios}',(select jsonb_agg(case when e->>'clave'='electiva-1'
    then jsonb_set(e,'{opciones}','["ac000000-0000-4000-8000-000000000114"]') else e end)
    from jsonb_array_elements(d->'espacios') e))) from jsonb_array_elements(borrador) d))
from public.area_comun_configuracion;
select throws_ok($$select public.area_comun_publicar(plan_id,revision) from public.area_comun_configuracion$$,
  '23514',null,'una publicación no puede invalidar las elecciones existentes');
select is((select publicacion_id from public.area_comun_configuracion),
  (select publicacion_id from _ac_publicacion_original),'publicación fallida conserva el puntero vigente');
select is((select count(*)::int from public.asignaturas where area_comun_incorporacion_id is not null),26,'publicación fallida revierte todas las proyecciones');
select is((select count(*)::int from private.area_comun_operaciones),0,'el fallo no deja activo el marcador privado');
select public.area_comun_guardar_configuracion(plan_id,revision,(select borrador from _ac_config_original)) from public.area_comun_configuracion;

-- Una distribución alternativa por duración y una variante explícita por carrera.
select public.area_comun_guardar_configuracion(plan_id,revision,borrador || jsonb_build_array(
  jsonb_set(jsonb_set(jsonb_set(borrador->0,'{clave}','"cuatrimestral-6"'),'{tipo_ciclo}','"Cuatrimestre"'),'{numero_ciclos}','6') ||
    jsonb_build_object('espacios',(select jsonb_agg(jsonb_set(e,'{numero_ciclo}',to_jsonb(least((e->>'numero_ciclo')::int,6)))) from jsonb_array_elements(borrador->0->'espacios') e)),
  borrador->0 || jsonb_build_object('clave','por-carrera','carrera_id',(select carrera_id from public.planes_estudio where id='a1000000-0000-4000-8000-000000000001'),
    'espacios',(select jsonb_agg(case when e->>'clave'='electiva-1' then jsonb_set(e,'{opciones}',
      '["ac000000-0000-4000-8000-000000000112","ac000000-0000-4000-8000-000000000113"]') else e end) from jsonb_array_elements(borrador->0->'espacios') e))
)) from public.area_comun_configuracion;
select lives_ok($$select public.area_comun_publicar(plan_id,revision) from public.area_comun_configuracion$$,'publicación de variantes compatibles');
select is((public.area_comun_contexto('ac000000-0000-4000-8000-000000000003')->'planes_usuarios')::jsonb->0->>'nombre',
  (select nombre_display from public.planes_estudio where id='a1000000-0000-4000-8000-000000000001'),'el área identifica los planes usuarios');

select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is(public.area_comun_contexto('a1000000-0000-4000-8000-000000000001')->'distribucion'->>'clave','por-carrera','la distribución de carrera prevalece');
select throws_ok($$select public.area_comun_incorporar('a1000000-0000-4000-8000-000000000001',
  '{"electiva-1":"ac000000-0000-4000-8000-000000000114","electiva-2":"ac000000-0000-4000-8000-000000000115"}')$$,
  '23514',null,'se respetan restricciones de electivas por carrera');
select lives_ok($$select public.area_comun_incorporar('a1000000-0000-4000-8000-000000000002',
  '{"electiva-1":"ac000000-0000-4000-8000-000000000112","electiva-2":"ac000000-0000-4000-8000-000000000115"}')$$,'se incorpora una distribución alternativa de cuatrimestres');
select is((select max(numero_ciclo) from public.asignaturas where plan_estudio_id='a1000000-0000-4000-8000-000000000002'),6,'la distribución alternativa respeta sus ciclos');
select lives_ok($$select public.area_comun_incorporar('a1000000-0000-4000-8000-000000000001',
  '{"electiva-1":"ac000000-0000-4000-8000-000000000113","electiva-2":"ac000000-0000-4000-8000-000000000116"}')$$,'se pueden cambiar electivas');
select is((select count(*)::int from public.asignaturas where plan_estudio_id='a1000000-0000-4000-8000-000000000001' and area_comun_origen_id='ac000000-0000-4000-8000-000000000113'),1,'elección nueva aplicada');
insert into public.asignaturas(id,plan_estudio_id,estructura_id,nombre,numero_ciclo,prerrequisito_asignatura_id)
values('a1000000-0000-4000-8000-000000000099','a1000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000002',
  'Materia propia dependiente',3,(select id from public.asignaturas where plan_estudio_id='a1000000-0000-4000-8000-000000000001'
    and area_comun_origen_id='ac000000-0000-4000-8000-000000000101'));
select throws_ok($$select public.area_comun_retirar('a1000000-0000-4000-8000-000000000001')$$,'23514',null,'retirar exige resolver prerrequisitos externos');
delete from public.asignaturas where id='a1000000-0000-4000-8000-000000000099';
select lives_ok($$select public.area_comun_retirar('a1000000-0000-4000-8000-000000000001')$$,'retirar línea');
select is((select count(*)::int from public.asignaturas where plan_estudio_id='a1000000-0000-4000-8000-000000000001'),0,'retirar elimina solo las proyecciones receptoras');
select is((select count(*)::int from public.asignaturas where plan_estudio_id='ac000000-0000-4000-8000-000000000003'),20,'catálogo conservado');
select ok(exists(select 1 from public.cambios_plan where plan_estudio_id='a1000000-0000-4000-8000-000000000001' and campo='area_comun'),'acciones integradas en historial habitual');
select is((select count(*)::int from private.area_comun_operaciones),0,'no queda un bypass de escritura activo');
delete from public.usuarios_roles where usuario_id='90000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"permisos":["area_comun.gestionar","area_comun.publicar"]}}',true);
select throws_ok($$select public.area_comun_publicar('ac000000-0000-4000-8000-000000000003',1)$$,'42501','No puedes publicar Área común','revocar el rol invalida la publicación incluso con claims antiguos');
select * from finish();
rollback;
