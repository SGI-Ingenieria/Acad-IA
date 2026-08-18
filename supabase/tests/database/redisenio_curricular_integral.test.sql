begin;

\ir _fixtures_usuarios.inc

select plan(33);

select has_table(
  'public', 'importaciones_academicas',
  'existe la bitácora durable de importaciones académicas'
);
select has_table(
  'public', 'importacion_archivos',
  'existen los archivos clasificados de una importación'
);
select has_column(
  'public', 'planes_estudio', 'rol_version_plan',
  'los planes distinguen antecedentes y versiones de trabajo'
);
select has_column(
  'public', 'planes_estudio', 'plan_origen_id',
  'los planes conservan su predecesor inmediato'
);
select has_column(
  'public', 'planes_estudio', 'etiqueta_version',
  'los planes tienen una etiqueta de versión explícita'
);
select has_column(
  'public', 'asignaturas', 'instalacion',
  'las asignaturas tienen instalación canónica'
);
select has_column(
  'public', 'registros_oficiales_plan', 'anio_solicitud_rvoe',
  'el registro oficial conserva el año solicitado por el Anexo 1'
);
select ok(
  (select is_generated = 'ALWAYS'
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'asignaturas'
     and column_name = 'creditos'),
  'los créditos siguen siendo calculados desde las horas'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.importaciones_academicas'::regclass),
  'las importaciones tienen RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.importacion_archivos'::regclass),
  'los archivos importados tienen RLS'
);
select is(
  (select count(*)::integer from public.estructuras_plan
   where tipo = 'CURRICULAR' and estado_publicacion = 'PUBLICADA'),
  1,
  'la semilla publica un único paquete SEP vigente'
);
select is(
  (public.validar_paquete_curricular(
    (select id from public.estructuras_plan
     where tipo = 'CURRICULAR' and estado_publicacion = 'PUBLICADA'
     limit 1)
  )->>'valido')::boolean,
  true,
  'el paquete SEP vigente cumple el contrato de publicación'
);

select throws_ok(
  $$ update public.estructuras_plan
     set nombre = nombre
     where tipo = 'CURRICULAR' and estado_publicacion = 'PUBLICADA' $$,
  '55000',
  'El paquete publicado es inmutable',
  'un paquete publicado no puede editarse'
);

create temp table _redisenio_ids (
  source_plan_id uuid,
  first_plan_id uuid,
  second_plan_id uuid,
  source_subject_id uuid,
  importacion_id uuid,
  imported_antecedent_id uuid,
  imported_work_id uuid
);

do $$
declare
  v_admin constant uuid := '90000000-0000-4000-8000-000000000001';
  v_structure public.estructuras_plan;
  v_subject_structure public.estructuras_asignatura;
  v_plan public.planes_estudio;
  v_first public.planes_estudio;
  v_second public.planes_estudio;
  v_line public.lineas_plan;
  v_subject public.asignaturas;
  v_import public.importaciones_academicas;
  v_apply jsonb;
  v_plan_data jsonb;
  v_subject_data jsonb;
begin
  select * into v_structure
  from public.estructuras_plan
  where tipo = 'CURRICULAR' and estado_publicacion = 'PUBLICADA'
  limit 1;
  select * into v_subject_structure
  from public.estructuras_asignatura
  where estructura_plan_id = v_structure.id;

  select coalesce(
    jsonb_object_agg(
      required.key,
      case
        when jsonb_typeof(property.value->'enum') = 'array'
          then property.value->'enum'->0
        when property.value->>'type' = 'number'
          or coalesce(property.value->'type', '[]'::jsonb) ? 'number'
          then to_jsonb(40)
        else to_jsonb('Dato de prueba'::text)
      end
    ),
    '{}'::jsonb
  )
  into v_plan_data
  from jsonb_array_elements_text(
    coalesce(v_structure.definicion->'required', '[]'::jsonb)
  ) required(key)
  join jsonb_each(v_structure.definicion->'properties') property
    on property.key = required.key;
  select coalesce(jsonb_object_agg(key, to_jsonb('Dato de prueba'::text)), '{}'::jsonb)
  into v_subject_data
  from jsonb_array_elements_text(coalesce(v_subject_structure.definicion->'required', '[]'::jsonb)) required(key);

  insert into public.planes_estudio (
    carrera_id, estructura_id, fecha_inicio_imparticion, tipo_ciclo,
    numero_ciclos, semanas_por_ciclo, estado_actual_id, activo, tipo_origen,
    datos, nombre_display, etiqueta_version, creado_por, actualizado_por
  ) values (
    (select id from public.carreras limit 1), v_structure.id, '2020-08-01',
    'Semestre', 8, 16,
    (select id from public.estados_plan where clave = 'BORRADOR' limit 1),
    false, 'IMPORTADO_DOCUMENTAL', v_plan_data, 'Plan antecedente 2020', '2020',
    v_admin, v_admin
  ) returning * into v_plan;

  insert into public.lineas_plan (
    plan_estudio_id, nombre, orden, creado_por, actualizado_por
  ) values (v_plan.id, 'Formación disciplinar', 1, v_admin, v_admin)
  returning * into v_line;

  insert into public.asignaturas (
    plan_estudio_id, estructura_id, codigo, nombre, tipo, numero_ciclo,
    linea_plan_id, orden_celda, datos, contenido_tematico, tipo_origen,
    meta_origen, creado_por, actualizado_por, horas_academicas,
    horas_independientes, criterios_de_evaluacion, instalacion
  ) values (
    v_plan.id, v_subject_structure.id, 'PGT-101', 'Asignatura antecedente',
    'OBLIGATORIA', 1, v_line.id, 0, v_subject_data, '[]'::jsonb,
    'IMPORTADO_DOCUMENTAL', '{"tipo":"IMPORTADO_DOCUMENTAL"}'::jsonb,
    v_admin, v_admin, 48, 32, '[]'::jsonb, 'LABORATORIO'
  ) returning * into v_subject;

  insert into public.bibliografia_asignatura (
    asignatura_id, tipo, cita, titulo, autores, creado_por
  ) values (
    v_subject.id, 'BASICA', 'Referencia pgTAP', 'Referencia pgTAP',
    '["Autor"]'::jsonb, v_admin
  );

  update public.planes_estudio
  set rol_version_plan = 'ANTECEDENTE'
  where id = v_plan.id;

  insert into public.importaciones_academicas (
    tenant_id, tipo, estado, creado_por, carrera_id,
    estructura_detectada_id, estructura_destino_id,
    confianza_estructura, fecha_inicio_redisenio, resultado_normalizado
  ) values (
    (select tenant_id from public.tenant_memberships
     where user_id = v_admin and is_default),
    'EXPEDIENTE_PLAN', 'REVISION', v_admin, v_plan.carrera_id,
    v_structure.id, v_structure.id, 0.98, '2026-01-01'::date,
    jsonb_build_object(
      'plan', jsonb_build_object(
        'nombre_display', 'Plan importado pgTAP',
        'etiqueta_version', '2018',
        'tipo_ciclo', 'Semestre',
        'numero_ciclos', 8,
        'semanas_por_ciclo', 16,
        'fecha_inicio_imparticion', '2018-08-01',
        'datos', v_plan_data
      ),
      'lineas', jsonb_build_array(
        jsonb_build_object(
          'id_externo', 'linea-1', 'nombre', 'Formación disciplinar',
          'orden', 1, 'area', 'Disciplinar'
        )
      ),
      'asignaturas', jsonb_build_array(
        jsonb_build_object(
          'id_externo', 'asignatura-1', 'codigo', 'IMP-101',
          'nombre', 'Asignatura importada', 'tipo', 'OBLIGATORIA',
          'numero_ciclo', 1, 'linea_id_externo', 'linea-1',
          'orden_celda', 0, 'datos', v_subject_data,
          'contenido_tematico', '[]'::jsonb,
          'criterios_de_evaluacion', '[]'::jsonb,
          'bibliografia', jsonb_build_array(
            jsonb_build_object(
              'tipo', 'BASICA', 'cita', 'Bibliografía importada'
            )
          ),
          'horas_academicas', 48, 'horas_independientes', 32,
          'instalacion', 'AULA'
        )
      ),
      'redisenio', jsonb_build_object(
        'etiqueta_version', '2026',
        'fecha_inicio_imparticion', '2026-08-01'
      )
    )
  ) returning * into v_import;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_admin,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('roles_claves', jsonb_build_array('ADMIN'))
    )::text,
    true
  );
  set local role authenticated;

  v_first := public.crear_version_redisenio(
    v_plan.id,
    v_structure.id,
    '{"etiqueta_version":"2024","fecha_inicio_imparticion":"2024-08-01"}'::jsonb
  );
  v_second := public.crear_version_redisenio(
    v_first.id,
    v_structure.id,
    '{"etiqueta_version":"2026","fecha_inicio_imparticion":"2026-08-01"}'::jsonb
  );
  v_apply := public.aplicar_importacion_expediente(v_import.id);

  reset role;
  insert into _redisenio_ids values (
    v_plan.id, v_first.id, v_second.id, v_subject.id, v_import.id,
    (v_apply->>'antecedente_plan_id')::uuid,
    (v_apply->>'version_trabajo_plan_id')::uuid
  );
end;
$$;

select throws_ok(
  $$ update public.planes_estudio
     set etiqueta_version = 'alterada'
     where id = (select source_plan_id from _redisenio_ids) $$,
  '55000',
  'El antecedente es inmutable',
  'el antecedente no puede editarse'
);
select throws_ok(
  $$ insert into public.lineas_plan (plan_estudio_id, nombre)
     values ((select source_plan_id from _redisenio_ids), 'Línea tardía') $$,
  '55000',
  'El antecedente es inmutable',
  'las líneas del antecedente tampoco pueden cambiar'
);
select is(
  (select rol_version_plan::text from public.planes_estudio
   where id = (select first_plan_id from _redisenio_ids)),
  'VERSION_TRABAJO',
  'el rediseño crea una versión editable'
);
select is(
  (select plan_origen_id from public.planes_estudio
   where id = (select first_plan_id from _redisenio_ids)),
  (select source_plan_id from _redisenio_ids),
  'el rediseño enlaza el predecesor inmediato'
);
select is(
  (select count(*)::integer from public.lineas_plan
   where plan_estudio_id = (select first_plan_id from _redisenio_ids)),
  1,
  'el rediseño copia las líneas curriculares'
);
select is(
  (select count(*)::integer from public.asignaturas
   where plan_estudio_id = (select first_plan_id from _redisenio_ids)),
  1,
  'el rediseño copia las asignaturas'
);
select is(
  (select count(*)::integer
   from public.bibliografia_asignatura b
   join public.asignaturas a on a.id = b.asignatura_id
   where a.plan_estudio_id = (select first_plan_id from _redisenio_ids)),
  1,
  'el rediseño copia la bibliografía'
);
select is(
  (select creditos from public.asignaturas
   where plan_estudio_id = (select first_plan_id from _redisenio_ids)),
  5::numeric,
  'los créditos copiados se recalculan desde las horas'
);
select is(
  public.obtener_plan_antecedente_raiz(
    (select second_plan_id from _redisenio_ids)
  ),
  (select source_plan_id from _redisenio_ids),
  'Ver original resuelve el antecedente raíz en un linaje 2020-2024-2026'
);
select is(
  (select count(*)::integer
   from public.obtener_linaje_plan((select second_plan_id from _redisenio_ids))),
  3,
  'el linaje recursivo conserva las tres versiones'
);
select is(
  (select estado::text from public.importaciones_academicas
   where id = (select importacion_id from _redisenio_ids)),
  'COMPLETADA',
  'la importación termina únicamente después de aplicar el expediente completo'
);
select is(
  (select rol_version_plan::text from public.planes_estudio
   where id = (select imported_antecedent_id from _redisenio_ids)),
  'ANTECEDENTE',
  'la importación crea un antecedente inmutable'
);
select is(
  (select plan_origen_id from public.planes_estudio
   where id = (select imported_work_id from _redisenio_ids)),
  (select imported_antecedent_id from _redisenio_ids),
  'la importación enlaza la versión editable con el antecedente'
);
select is(
  (select fecha_inicio_imparticion::text from public.planes_estudio
   where id = (select imported_antecedent_id from _redisenio_ids)),
  '2018-08-01',
  'el antecedente conserva la fecha encontrada en el documento'
);
select is(
  (select fecha_inicio_imparticion::text from public.planes_estudio
   where id = (select imported_work_id from _redisenio_ids)),
  '2026-01-01',
  'el rediseño conserva la fecha elegida al iniciar la importación'
);
select is(
  (select count(*)::integer
   from public.asignaturas
   where plan_estudio_id in (
     (select imported_antecedent_id from _redisenio_ids),
     (select imported_work_id from _redisenio_ids)
   )),
  2,
  'la transacción conserva la asignatura en ambas versiones'
);

create temp table _importacion_invalida as
with source as (
  select
    p.carrera_id,
    p.estructura_id,
    p.datos as plan_data,
    a.datos as subject_data,
    p.creado_por,
    membership.tenant_id
  from public.planes_estudio p
  join public.asignaturas a on a.plan_estudio_id = p.id
  join public.tenant_memberships membership
    on membership.user_id = p.creado_por and membership.is_default
  where p.id = (select source_plan_id from _redisenio_ids)
  limit 1
), inserted as (
  insert into public.importaciones_academicas (
    tenant_id, tipo, estado, creado_por, carrera_id,
    estructura_detectada_id, estructura_destino_id, resultado_normalizado
  )
  select
    tenant_id, 'EXPEDIENTE_PLAN', 'REVISION', creado_por, carrera_id,
    estructura_id, estructura_id,
    jsonb_build_object(
      'plan', jsonb_build_object(
        'nombre_display', 'Importación inválida', 'tipo_ciclo', 'Semestre',
        'numero_ciclos', 8, 'fecha_inicio_imparticion', '2020-08-01',
        'datos', plan_data
      ),
      'lineas', '[]'::jsonb,
      'asignaturas', jsonb_build_array(
        jsonb_build_object(
          'id_externo', 'fallida-1', 'nombre', 'Asignatura fallida',
          'tipo', 'TIPO_INVALIDO', 'datos', subject_data,
          'contenido_tematico', '[]'::jsonb,
          'criterios_de_evaluacion', '[]'::jsonb,
          'bibliografia', '[]'::jsonb
        )
      ),
      'redisenio', '{}'::jsonb
    )
  from source
  returning id
)
select id from inserted;

select throws_ok(
  $$ select public.aplicar_importacion_expediente(
       (select id from _importacion_invalida)
     ) $$,
  '22P02',
  null,
  'un expediente inválido revierte la operación completa'
);
select is(
  (select count(*)::integer
   from public.planes_estudio
   where meta_origen->>'importacion_id' = (select id::text from _importacion_invalida)),
  0,
  'una importación fallida no deja planes parciales'
);

create temp table _program_import as
with source as (
  select
    target.id as plan_id,
    target.carrera_id,
    target.estructura_id,
    source_subject.datos as subject_data,
    target.creado_por,
    membership.tenant_id
  from public.planes_estudio target
  join public.tenant_memberships membership
    on membership.user_id = target.creado_por and membership.is_default
  join public.asignaturas source_subject
    on source_subject.id = (select source_subject_id from _redisenio_ids)
  where target.id = (select first_plan_id from _redisenio_ids)
), inserted as (
  insert into public.importaciones_academicas (
    tenant_id, tipo, estado, creado_por, carrera_id,
    estructura_destino_id, plan_destino_id, resultado_normalizado
  )
  select
    tenant_id, 'PROGRAMAS_ASIGNATURA', 'REVISION', creado_por, carrera_id,
    estructura_id, plan_id,
    jsonb_build_object(
      'plan', '{}'::jsonb,
      'lineas', '[]'::jsonb,
      'asignaturas', jsonb_build_array(
        jsonb_build_object(
          'id_externo', 'programa-seleccionado',
          'codigo', 'PRG-202',
          'nombre', 'Programa importado',
          'tipo', 'OBLIGATORIA',
          'numero_ciclo', 2,
          'datos', subject_data,
          'contenido_tematico', '[]'::jsonb,
          'criterios_de_evaluacion', '[]'::jsonb,
          'bibliografia', '[]'::jsonb,
          'horas_academicas', 32,
          'horas_independientes', 32,
          'instalacion', 'AULA'
        ),
        jsonb_build_object(
          'id_externo', 'programa-omitido',
          'nombre', 'Programa omitido',
          'tipo', 'OPTATIVA',
          'datos', subject_data,
          'contenido_tematico', '[]'::jsonb,
          'criterios_de_evaluacion', '[]'::jsonb,
          'bibliografia', '[]'::jsonb
        )
      )
    )
  from source
  returning id, plan_destino_id
)
select * from inserted;

create temp table _program_result as
select public.aplicar_importacion_programas(
  (select id from _program_import),
  array['programa-seleccionado']
) as result;

select is(
  (select estado::text from public.importaciones_academicas
   where id = (select id from _program_import)),
  'COMPLETADA',
  'la importación independiente de programas termina atómicamente'
);
select is(
  (select count(*)::integer from public.asignaturas
   where plan_estudio_id = (select plan_destino_id from _program_import)
     and codigo = 'PRG-202'),
  1,
  'la selección aplica el programa elegido'
);
select is(
  (select count(*)::integer from public.asignaturas
   where plan_estudio_id = (select plan_destino_id from _program_import)
     and nombre = 'Programa omitido'),
  0,
  'la selección no aplica programas descartados en la vista previa'
);
select is(
  (select tipo_origen::text from public.asignaturas
   where plan_estudio_id = (select plan_destino_id from _program_import)
     and codigo = 'PRG-202'),
  'IMPORTADO_DOCUMENTAL',
  'el programa conserva su procedencia documental'
);

rollback;
