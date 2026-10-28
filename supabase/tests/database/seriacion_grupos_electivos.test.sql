begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
\ir _fixtures_usuarios.inc
select no_plan();
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"service_role"}',true);

-- Aislar la prueba de estados editados en la base de desarrollo.
update public.asignaturas set estado='borrador' where plan_estudio_id='ac000000-0000-4000-8000-000000000003' and estado in ('archivada','generando','fallida');
create temp table distribuciones_prueba as select borrador as original,
  jsonb_set(borrador,'{0,espacios,11,prerrequisito_grupo_clave}','"electiva-1"') as seriada
  from public.area_comun_configuracion;
select lives_ok($$select private.validar_seriaciones_grupos_electivos(original) from distribuciones_prueba$$,'compatibilidad con distribuciones anteriores');
select lives_ok($$select public.area_comun_guardar_configuracion('ac000000-0000-4000-8000-000000000003',
  (select revision from public.area_comun_configuracion),(select seriada from distribuciones_prueba))$$,'guardar I hacia II');
select is((select borrador#>>'{0,espacios,11,prerrequisito_grupo_clave}' from public.area_comun_configuracion),'electiva-1','dependencia persistida');
select throws_ok($$update public.area_comun_configuracion set borrador=jsonb_set(borrador,'{0,espacios,11,prerrequisito_grupo_clave}','"electiva-2"')$$,'23514',null,'rechaza autorreferencia');
select throws_ok($$update public.area_comun_configuracion set borrador=jsonb_set(borrador,'{0,espacios,11,prerrequisito_grupo_clave}','"otro"')$$,'23514',null,'rechaza grupo inexistente o de otra distribución');
select throws_ok($$update public.area_comun_configuracion set borrador=borrador#-'{0,espacios,7}'$$,'23514',null,'no elimina antecedente con dependencias');
select throws_ok($$update public.area_comun_configuracion set borrador=jsonb_set(borrador#-'{0,espacios,7,opciones}','{0,espacios,7,asignatura_id}','"ac000000-0000-4000-8000-000000000112"')$$,'23514',null,'no convierte antecedente a materia fija');
select throws_ok($$update public.area_comun_configuracion set borrador=jsonb_set(borrador,'{0,espacios,7,numero_ciclo}','8')$$,'23514',null,'rechaza el mismo ciclo');
select throws_ok($$update public.area_comun_configuracion set borrador=jsonb_set(borrador,'{0,espacios,7,numero_ciclo}','9')$$,'23514',null,'rechaza antecedente posterior');
select throws_ok($$update public.area_comun_configuracion set borrador=jsonb_set(borrador,'{0,espacios,7,prerrequisito_grupo_clave}','"electiva-2"')$$,'23514',null,'rechaza ciclo de dependencias');
select lives_ok($$select public.area_comun_guardar_configuracion('ac000000-0000-4000-8000-000000000003',
  (select revision from public.area_comun_configuracion),(select original from distribuciones_prueba))$$,'permite quitar dependencia');
select lives_ok($$select public.area_comun_guardar_configuracion('ac000000-0000-4000-8000-000000000003',
  (select revision from public.area_comun_configuracion),(select seriada from distribuciones_prueba))$$,'permite restaurar dependencia');
select throws_ok($$update public.asignaturas set prerrequisito_asignatura_id='ac000000-0000-4000-8000-000000000112' where id='ac000000-0000-4000-8000-000000000115'$$,'23514',null,'alternativas no se serian individualmente entre grupos');
select throws_ok($$update public.asignaturas set prerrequisito_asignatura_id='ac000000-0000-4000-8000-000000000101' where id='ac000000-0000-4000-8000-000000000112'$$,'23514',null,'alternativa no admite antecedente individual fijo');
select lives_ok($$update public.asignaturas set prerrequisito_asignatura_id='ac000000-0000-4000-8000-000000000104' where id='ac000000-0000-4000-8000-000000000107'$$,'materias fijas conservan reglas individuales sin restricción temática');
select lives_ok($$update public.asignaturas set prerrequisito_asignatura_id=null where id='ac000000-0000-4000-8000-000000000107'$$,'permite quitar relación individual');
select lives_ok($$select public.area_comun_publicar('ac000000-0000-4000-8000-000000000003',(select revision from public.area_comun_configuracion))$$,'publica grupos seriados');
select is((select contenido#>>'{distribuciones,0,espacios,11,prerrequisito_grupo_clave}' from public.area_comun_publicaciones where id=(select publicacion_id from public.area_comun_configuracion)),'electiva-1','publicación conserva la dependencia de grupo');

insert into public.planes_estudio(id,carrera_id,estructura_id,fecha_inicio_imparticion,nombre_display,tipo_ciclo,numero_ciclos,estado_actual_id)
values('a2960000-0000-4000-8000-000000000001',(select id from public.carreras limit 1),
 'ac000000-0000-4000-8000-000000000001','2026-09-01','Plan seriación grupos','Semestre',8,
 (select id from public.estados_plan where clave='BORRADOR' limit 1));
select lives_ok($$select public.area_comun_incorporar('a2960000-0000-4000-8000-000000000001',
 '{"electiva-1":"ac000000-0000-4000-8000-000000000112","electiva-2":"ac000000-0000-4000-8000-000000000115"}')$$,'incorpora grupos sin generar relaciones individuales');
select is((public.area_comun_contexto('a2960000-0000-4000-8000-000000000001')#>>'{distribucion,espacios,11,prerrequisito_grupo_clave}'),'electiva-1','reabrir receptor conserva I hacia II');
select is(jsonb_array_length(public.area_comun_contexto('a2960000-0000-4000-8000-000000000001')#>'{distribucion,espacios,7,opciones}'),3,'conserva alternativas I');
select is(jsonb_array_length(public.area_comun_contexto('a2960000-0000-4000-8000-000000000001')#>'{distribucion,espacios,11,opciones}'),6,'conserva alternativas II');
select is((select count(*)::integer from public.asignaturas where plan_estudio_id='a2960000-0000-4000-8000-000000000001' and area_comun_espacio in ('electiva-1','electiva-2') and prerrequisito_asignatura_id is not null),0,'ninguna relación artificial entre alternativas');
-- Simular una relación heredada, anterior a la nueva validación.
alter table public.asignaturas disable trigger validar_seriacion_individual_electiva;
update public.asignaturas set prerrequisito_asignatura_id='ac000000-0000-4000-8000-000000000101' where id='ac000000-0000-4000-8000-000000000112';
alter table public.asignaturas enable trigger validar_seriacion_individual_electiva;
select is((select prerrequisito_asignatura_id from public.asignaturas where id='ac000000-0000-4000-8000-000000000112'),'ac000000-0000-4000-8000-000000000101'::uuid,'relación histórica permanece hasta resolverla');
select lives_ok($$update public.asignaturas set prerrequisito_asignatura_id=null where id='ac000000-0000-4000-8000-000000000112'$$,'permite quitar relación histórica incompatible');
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.area_comun_guardar_configuracion('ac000000-0000-4000-8000-000000000003',(select revision from public.area_comun_configuracion),(select original from distribuciones_prueba))$$,'42501','No puedes gestionar Área común','sin permiso no se cambia la seriación del catálogo');
select * from finish();
rollback;
