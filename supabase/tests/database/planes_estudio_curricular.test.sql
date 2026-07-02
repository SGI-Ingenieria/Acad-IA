BEGIN;

SELECT plan(8);

SELECT has_column(
  'public',
  'planes_estudio',
  'fecha_inicio_imparticion',
  'planes_estudio tiene columna fecha_inicio_imparticion'
);

SELECT has_column(
  'public',
  'planes_estudio',
  'nombre_display',
  'planes_estudio tiene columna nombre_display'
);

SELECT has_column(
  'public',
  'planes_estudio',
  'nombre_propuesto',
  'planes_estudio tiene columna nombre_propuesto'
);

SELECT has_function(
  'public',
  'fn_generar_nombre_plan_curricular',
  ARRAY['uuid', 'date'],
  'existe fn_generar_nombre_plan_curricular(uuid, date)'
);

SELECT has_trigger(
  'public',
  'planes_estudio',
  'trg_planes_set_nombre_display',
  'existe trigger trg_planes_set_nombre_display'
);

DO $$
declare
  v_estructura_curricular_id uuid;
  v_estructura_no_curricular_id uuid;
  v_carrera_id uuid;
  v_estado_id uuid;
  v_plan_curricular public.planes_estudio%rowtype;
  v_plan_no_curricular public.planes_estudio%rowtype;
begin
  select id into v_estructura_curricular_id
  from public.estructuras_plan
  where tipo = 'CURRICULAR'
  limit 1;

  select id into v_estructura_no_curricular_id
  from public.estructuras_plan
  where tipo <> 'CURRICULAR'
  limit 1;

  select id into v_carrera_id
  from public.carreras
  limit 1;

  select id into v_estado_id
  from public.estados_plan
  where clave = 'BORRADOR'
  limit 1;

  begin
    insert into public.planes_estudio (
      carrera_id, estructura_id, nombre, tipo_ciclo, numero_ciclos,
      estado_actual_id, activo, tipo_origen
    ) values (
      v_carrera_id, v_estructura_curricular_id, 'Nombre ignorado',
      'Semestre', 8, v_estado_id, true, 'MANUAL'
    );

    raise exception 'TEST_FAIL: se permitió insert curricular sin fecha';
  exception when sqlstate 'P0001' then
    null;
  end;

  insert into public.planes_estudio (
    carrera_id, estructura_id, nombre, nombre_propuesto,
    fecha_inicio_imparticion, tipo_ciclo, numero_ciclos,
    estado_actual_id, activo, tipo_origen
  ) values (
    v_carrera_id, v_estructura_curricular_id, 'Nombre ignorado',
    'Propuesta ignorada', '2026-08-18',
    'Semestre', 8, v_estado_id, true, 'MANUAL'
  )
  returning * into v_plan_curricular;

  if v_plan_curricular.nombre is not null then
    raise exception 'TEST_FAIL: plan curricular conservó nombre=%', v_plan_curricular.nombre;
  end if;

  if v_plan_curricular.nombre_propuesto is not null then
    raise exception 'TEST_FAIL: plan curricular conservó nombre_propuesto=%', v_plan_curricular.nombre_propuesto;
  end if;

  if v_plan_curricular.fecha_inicio_imparticion <> '2026-08-01'::date then
    raise exception 'TEST_FAIL: fecha no fue normalizada al primer día del mes: %', v_plan_curricular.fecha_inicio_imparticion;
  end if;

  if v_plan_curricular.nombre_display not like '% - Plan Agosto 2026' then
    raise exception 'TEST_FAIL: nombre_display curricular inválido: %', v_plan_curricular.nombre_display;
  end if;

  if v_plan_curricular.nombre_search is distinct from lower(public.unaccent_immutable(v_plan_curricular.nombre_display)) then
    raise exception 'TEST_FAIL: nombre_search no deriva de nombre_display';
  end if;

  if v_estructura_no_curricular_id is not null then
    insert into public.planes_estudio (
      carrera_id, estructura_id, nombre_propuesto, tipo_ciclo, numero_ciclos,
      estado_actual_id, activo, tipo_origen
    ) values (
      v_carrera_id, v_estructura_no_curricular_id, 'Programa ejecutivo',
      'Semestre', 2, v_estado_id, true, 'MANUAL'
    )
    returning * into v_plan_no_curricular;

    if v_plan_no_curricular.nombre_display <> 'Programa ejecutivo' then
      raise exception 'TEST_FAIL: nombre_display no curricular inválido: %', v_plan_no_curricular.nombre_display;
    end if;
  end if;
end;
$$;

SELECT pass('insert curricular sin fecha es bloqueado');
SELECT pass('insert curricular con fecha genera nombre_display');
SELECT pass('insert no curricular usa nombre_propuesto como display');

ROLLBACK;
