begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select is((select count(*)::int from public.area_comun_bloques),4,
  'el catálogo distingue los cuatro bloques de referencia');
select is((select sum(asignaturas_referencia)::int from public.area_comun_bloques),13,
  'el total de materias de referencia es el agregado ACC');
select is((select sum(horas_referencia)::int from public.area_comun_bloques),576,
  'el total de horas de referencia es el agregado ACC');
select is((select nombre_display from public.planes_estudio where categoria='AREA_COMUN' limit 1),
  '2. Área curricular común','el plan institucional usa el nombre ordinal acordado');
select is((select alcance_default from public.roles where clave='ENCARGADO_BLOQUE'),
  'area_comun_bloque','el rol usa alcance por bloque');
select ok(has_table_privilege(
  'supabase_auth_admin','public.area_comun_encargados_bloque','select'
),'Auth puede leer asignaciones de bloque al emitir JWT');

insert into auth.users(id,email,raw_user_meta_data) values
  ('90000000-0000-4000-8000-000000000091','encargado-bloque-test@acad-ia.invalid','{}'::jsonb)
on conflict(id) do nothing;
insert into public.usuarios_app(id,nombre_completo)
values('90000000-0000-4000-8000-000000000091','Encargado de prueba')
on conflict(id) do nothing;
insert into public.usuarios_roles(id,usuario_id,rol_id)
select 'a2000000-0000-4000-8000-000000000091','90000000-0000-4000-8000-000000000091',id
from public.roles where clave='ENCARGADO_BLOQUE'
on conflict(id) do nothing;
insert into public.area_comun_encargados_bloque(usuario_id,asignacion_id,bloque_clave)
values('90000000-0000-4000-8000-000000000091','a2000000-0000-4000-8000-000000000091','PENSAMIENTO_COMUNICACION')
on conflict(usuario_id,bloque_clave) do nothing;
select ok(private.area_comun_encargado('90000000-0000-4000-8000-000000000091','PENSAMIENTO_COMUNICACION'),
  'el encargado tiene acceso a su bloque');
select ok(not private.area_comun_encargado('90000000-0000-4000-8000-000000000091','LENGUA_EXTRANJERA'),
  'el encargado no tiene acceso a otros bloques');
select lives_ok($$select public.asignar_encargado_area_comun(
  '90000000-0000-4000-8000-000000000091','LENGUA_EXTRANJERA',
  '90000000-0000-4000-8000-000000000091')$$,
  'una persona puede recibir otro bloque');
select is((select count(*)::int from public.area_comun_encargados_bloque
  where usuario_id='90000000-0000-4000-8000-000000000091'),2,
  'las asignaciones quedan separadas por bloque');
select lives_ok($$select public.asignar_encargado_area_comun(
  '90000000-0000-4000-8000-000000000091','LENGUA_EXTRANJERA',
  '90000000-0000-4000-8000-000000000091')$$,
  'la asignación del mismo bloque es idempotente');
select is((select count(*)::int from public.area_comun_encargados_bloque
  where usuario_id='90000000-0000-4000-8000-000000000091'),2,
  'la repetición no duplica el bloque');
select ok(exists(
  select 1 from jsonb_array_elements(
    public.custom_access_token_hook(jsonb_build_object('claims',jsonb_build_object(
      'sub','90000000-0000-4000-8000-000000000091','app_metadata','{}'::jsonb
    )))->'claims'->'app_metadata'->'roles'
  ) asignacion where asignacion->>'bloque_clave'='PENSAMIENTO_COMUNICACION'
),'el token incluye el bloque de cada asignación');
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
select ok(public.authz_can_access_asignatura('ac000000-0000-4000-8000-000000000101'),
  'el encargado puede consultar contenido y archivos de su materia');
select ok(not public.authz_can_access_asignatura('ac000000-0000-4000-8000-000000000105'),
  'el encargado no consulta contenido y archivos de otros bloques');
select lives_ok($$update public.asignaturas set nombre='Nombre de bloque actualizado'
  where id='ac000000-0000-4000-8000-000000000101'$$,
  'el encargado puede editar datos de su materia');
select throws_ok($$update public.asignaturas set nombre='Edición ajena'
  where id='ac000000-0000-4000-8000-000000000105'$$,
  '42501','Solo el encargado del bloque correspondiente puede editar esta materia',
  'el encargado no puede editar materias de otro bloque');
select throws_ok($$update public.asignaturas set numero_ciclo=2
  where id='ac000000-0000-4000-8000-000000000101'$$,
  '42501','Solo el encargado del bloque correspondiente puede editar esta materia',
  'el encargado no puede cambiar distribución o ubicación');

insert into public.planes_estudio(
  id,carrera_id,estructura_id,fecha_inicio_imparticion,nombre_display,tipo_ciclo,
  numero_ciclos,estado_actual_id
)
values(
  'a2000000-0000-4000-8000-000000000001',
  (select id from public.carreras limit 1),
  'ac000000-0000-4000-8000-000000000001','2026-09-01','Plan nueve ciclos',
  'Semestre',9,(select id from public.estados_plan where clave='BORRADOR' limit 1)
);

select is(
  private.area_comun_distribucion(
    '[{"tipo_ciclo":"Semestre","numero_ciclos":8,"version":"ocho"}]'::jsonb,
    'a2000000-0000-4000-8000-000000000001'
  )->>'version',
  'ocho','una distribución semestral de ocho ciclos aplica a un plan de nueve'
);
select is(
  private.area_comun_distribucion(
    '[{"tipo_ciclo":"Semestre","numero_ciclos":8,"version":"ocho"},
      {"tipo_ciclo":"Semestre","numero_ciclos":9,"version":"nueve"}]'::jsonb,
    'a2000000-0000-4000-8000-000000000001'
  )->>'version',
  'nueve','la distribución exacta de nueve ciclos tiene prioridad'
);
select is(
  private.area_comun_distribucion(
    '[{"tipo_ciclo":"Cuatrimestre","numero_ciclos":8,"version":"ocho"}]'::jsonb,
    'a2000000-0000-4000-8000-000000000001'
  ),
  null::jsonb,'la compatibilidad no cruza tipos de ciclo'
);

select * from finish();
rollback;
