begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
\ir _fixtures_usuarios.inc
select no_plan();
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"service_role"}',true);
insert into public.planes_estudio(id,carrera_id,estructura_id,fecha_inicio_imparticion,nombre_display,tipo_ciclo,numero_ciclos,estado_actual_id)
values('a2980000-0000-4000-8000-000000000001',(select id from public.carreras limit 1),
 'ac000000-0000-4000-8000-000000000001','2026-09-01','Pruebas de bloques propios','Semestre',8,
 (select id from public.estados_plan where clave='BORRADOR' limit 1));
insert into public.lineas_plan(id,plan_estudio_id,nombre,orden) values
 ('a2980000-0000-4000-8000-000000000002','a2980000-0000-4000-8000-000000000001','Línea propia',1);
insert into public.asignaturas(id,plan_estudio_id,estructura_id,nombre,codigo,tipo,numero_ciclo,linea_plan_id,horas_academicas,horas_independientes,datos)
select ('a2980000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'a2980000-0000-4000-8000-000000000001',
 (select estructura_id from public.asignaturas where codigo='ACC02' limit 1),'Alternativa '||n,'E'||n,'OBLIGATORIA',n-10,
 'a2980000-0000-4000-8000-000000000002',24,0,'{}'::jsonb from generate_series(11,14) n;

select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','crear','a2980000-0000-4000-8000-000000000101',
 '{"nombre":"Electiva I","numero_ciclo":5,"linea_plan_id":"a2980000-0000-4000-8000-000000000002"}')$$,'crea bloque vacío');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','crear','a2980000-0000-4000-8000-000000000102',
 '{"nombre":"Electiva II","numero_ciclo":7,"linea_plan_id":"a2980000-0000-4000-8000-000000000002"}')$$,'crea segundo bloque');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','incorporar','a2980000-0000-4000-8000-000000000101',
 '{"revision":1,"asignatura_id":"a2980000-0000-4000-8000-000000000011"}')$$,'incorpora primera alternativa');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','incorporar','a2980000-0000-4000-8000-000000000101',
 '{"revision":2,"asignatura_id":"a2980000-0000-4000-8000-000000000012"}')$$,'incorpora alternativa con carga igual');
select is((select numero_ciclo from public.asignaturas where id='a2980000-0000-4000-8000-000000000011'),5,'sincroniza ubicación');
select throws_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','mover','a2980000-0000-4000-8000-000000000101',
 '{"revision":1,"numero_ciclo":4}')$$,'40001',null,'rechaza revisión obsoleta');
select throws_ok($$update public.asignaturas set horas_academicas=48 where id='a2980000-0000-4000-8000-000000000011'$$,'23514',null,'rechaza cambio incompatible de carga');
select throws_ok($$update public.asignaturas set numero_ciclo=2 where id='a2980000-0000-4000-8000-000000000011'$$,'23514',null,'no mueve alternativa individualmente');
select throws_ok($$update public.asignaturas set grupo_electivo_id=null where id='a2980000-0000-4000-8000-000000000011'$$,'42501',null,'pertenencia solo por RPC');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','editar','a2980000-0000-4000-8000-000000000102',
 '{"revision":1,"prerrequisito_grupo_id":"a2980000-0000-4000-8000-000000000101"}')$$,'seria I hacia II');
select throws_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','editar','a2980000-0000-4000-8000-000000000101',
 '{"revision":3,"prerrequisito_grupo_id":"a2980000-0000-4000-8000-000000000102"}')$$,'23514',null,'rechaza ciclo');
select throws_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','mover','a2980000-0000-4000-8000-000000000101',
 '{"revision":3,"numero_ciclo":7}')$$,'23514',null,'no rompe dependencia sucesora');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','mover','a2980000-0000-4000-8000-000000000101',
 '{"revision":3,"numero_ciclo":4}')$$,'mueve bloque completo');
select is((select count(*)::integer from public.asignaturas where grupo_electivo_id='a2980000-0000-4000-8000-000000000101' and numero_ciclo=4),2,'mueve ambas alternativas');
update public.asignaturas set horas_academicas=48 where id='a2980000-0000-4000-8000-000000000013';
select throws_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','incorporar','a2980000-0000-4000-8000-000000000101',
 '{"revision":4,"asignatura_id":"a2980000-0000-4000-8000-000000000013"}')$$,'23514',null,'no incorpora cargas distintas');
select is((select grupo_electivo_id from public.asignaturas where id='a2980000-0000-4000-8000-000000000013'),null::uuid,'rollback no deja pertenencia parcial');
update public.asignaturas set horas_academicas=24,prerrequisito_asignatura_id='a2980000-0000-4000-8000-000000000014',numero_ciclo=5 where id='a2980000-0000-4000-8000-000000000013';
select throws_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','incorporar','a2980000-0000-4000-8000-000000000101',
 '{"revision":4,"asignatura_id":"a2980000-0000-4000-8000-000000000013"}')$$,'23514',null,'exige confirmar retiro de relaciones');
select throws_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','incorporar','a2980000-0000-4000-8000-000000000101',
 '{"revision":4,"asignatura_id":"a2980000-0000-4000-8000-000000000013","confirmar_retiro_relaciones":true,"relaciones_esperadas":[]}')$$,'40001',null,'no elimina relaciones que cambiaron desde la confirmación');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','incorporar','a2980000-0000-4000-8000-000000000101',
 '{"revision":4,"asignatura_id":"a2980000-0000-4000-8000-000000000013","confirmar_retiro_relaciones":true}')$$,'retiro de relaciones e incorporación atómicos');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','retirar','a2980000-0000-4000-8000-000000000101',
 '{"revision":5,"asignatura_id":"a2980000-0000-4000-8000-000000000013"}')$$,'retira alternativa');
select ok((select numero_ciclo is null and linea_plan_id is null and grupo_electivo_id is null from public.asignaturas where id='a2980000-0000-4000-8000-000000000013'),'retirada queda pendiente');

create temp table version_clonada as select (public.crear_version_redisenio('a2980000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001','{}')).id;
select is((select count(*)::integer from public.grupos_electivos_plan where plan_estudio_id=(select id from version_clonada)),2,'clona bloques');
select is((select count(*)::integer from public.asignaturas where plan_estudio_id=(select id from version_clonada) and grupo_electivo_id is not null),2,'clona pertenencia sin reutilizar identidades');
select ok(exists(select 1 from public.grupos_electivos_plan a join public.grupos_electivos_plan p on p.id=a.prerrequisito_grupo_id where a.plan_estudio_id=(select id from version_clonada) and p.plan_estudio_id=a.plan_estudio_id),'clona dependencia con identidades nuevas');
-- Regresión: igual crédito no exige igual reparto HD/HI.
select lives_ok($$update public.asignaturas set horas_academicas=16,horas_independientes=8 where id='a2980000-0000-4000-8000-000000000012'$$,'admite redistribuir horas conservando la carga total');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','crear','a2980000-0000-4000-8000-000000000103','{"nombre":"Electiva 7 CR","numero_ciclo":8,"linea_plan_id":"a2980000-0000-4000-8000-000000000002"}')$$,'crea bloque para regresión de siete créditos');
update public.asignaturas set horas_academicas=48,horas_independientes=64 where id='a2980000-0000-4000-8000-000000000013';
update public.asignaturas set horas_academicas=64,horas_independientes=48 where id='a2980000-0000-4000-8000-000000000014';
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','incorporar','a2980000-0000-4000-8000-000000000103','{"revision":1,"asignatura_id":"a2980000-0000-4000-8000-000000000013"}')$$,'incorpora siete créditos con 48 HD y 64 HI');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','incorporar','a2980000-0000-4000-8000-000000000103','{"revision":2,"asignatura_id":"a2980000-0000-4000-8000-000000000014"}')$$,'incorpora siete créditos con 64 HD y 48 HI');
select is((select count(*)::integer from public.asignaturas where grupo_electivo_id='a2980000-0000-4000-8000-000000000103' and creditos=7),2,'ambas alternativas de siete créditos permanecen en el bloque');
select throws_ok($$update public.asignaturas set horas_independientes=64 where id='a2980000-0000-4000-8000-000000000014'$$,'23514',null,'sigue rechazando un cambio de carga total');
select throws_ok($$update public.planes_estudio set numero_ciclos=6 where id='a2980000-0000-4000-8000-000000000001'$$,'23514',null,'no deja bloques fuera de la duración del plan');
select throws_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','editar','a2980000-0000-4000-8000-000000000102',jsonb_build_object('revision',2,'prerrequisito_grupo_id',(select id from public.grupos_electivos_plan where plan_estudio_id=(select id from version_clonada) limit 1)))$$,'23514',null,'no seria entre planes distintos');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','incorporar','a2980000-0000-4000-8000-000000000102','{"revision":2,"asignatura_id":"a2980000-0000-4000-8000-000000000011"}')$$,'traslada alternativa entre bloques');
select is((select grupo_electivo_id from public.asignaturas where id='a2980000-0000-4000-8000-000000000011'),'a2980000-0000-4000-8000-000000000102'::uuid,'una sola pertenencia tras traslado');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','incorporar','a2980000-0000-4000-8000-000000000101','{"revision":7,"asignatura_id":"a2980000-0000-4000-8000-000000000011"}')$$,'permite devolver alternativa');
select throws_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','eliminar','a2980000-0000-4000-8000-000000000101','{"revision":8}')$$,'23514',null,'eliminación relacionada requiere confirmación');
select lives_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','eliminar','a2980000-0000-4000-8000-000000000101','{"revision":8,"confirmar_retiro_relaciones":true}')$$,'elimina bloque sin borrar materias');
select is((select count(*)::integer from public.asignaturas where plan_estudio_id='a2980000-0000-4000-8000-000000000001'),4,'conserva todas las asignaturas');
select is((select prerrequisito_grupo_id from public.grupos_electivos_plan where id='a2980000-0000-4000-8000-000000000102'),null::uuid,'retira dependencia del bloque eliminado');
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.gestionar_grupo_electivo_plan('a2980000-0000-4000-8000-000000000001','crear',null,'{"nombre":"Sin permiso","numero_ciclo":1,"linea_plan_id":"a2980000-0000-4000-8000-000000000002"}')$$,'42501',null,'autorización en backend');
select * from finish();
rollback;
