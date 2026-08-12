-- La estructura detectada o seleccionada durante la revisión no es una
-- elección manual divergente; evita exigir un motivo que no existe.
create or replace function public.aplicar_importacion_expediente(p_importacion_id uuid)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  v_import public.importaciones_academicas;
  v_result jsonb;
  v_plan jsonb;
  v_structure public.estructuras_plan;
  v_subject_structure public.estructuras_asignatura;
  v_antecedente public.planes_estudio;
  v_trabajo public.planes_estudio;
  v_actor uuid := auth.uid();
  v_estado_id uuid;
  v_line jsonb;
  v_subject jsonb;
  v_biblio jsonb;
  v_line_map jsonb := '{}'::jsonb;
  v_subject_map jsonb := '{}'::jsonb;
  v_id uuid;
begin
  select * into v_import from public.importaciones_academicas
  where id = p_importacion_id for update;
  if v_import.id is null or v_import.creado_por <> v_actor then
    raise exception using errcode = '42501', message = 'Importación no disponible';
  end if;
  if v_import.tipo <> 'EXPEDIENTE_PLAN' or v_import.estado <> 'REVISION' then
    raise exception using errcode = '55000', message = 'La importación no está lista para aplicar';
  end if;
  if not public.authz_has_permission('planes.crear')
     or v_import.carrera_id is null
     or not public.authz_can_access_carrera(v_import.carrera_id) then
    raise exception using errcode = '42501', message = 'No puedes aplicar esta importación';
  end if;

  update public.importaciones_academicas
  set estado = 'APLICANDO', actualizado_en = now() where id = v_import.id;
  v_result := v_import.resultado_normalizado;
  v_plan := coalesce(v_result->'plan', '{}'::jsonb);
  select * into v_structure from public.estructuras_plan
  where id = coalesce(v_import.estructura_detectada_id, v_import.estructura_destino_id);
  select * into v_subject_structure from public.estructuras_asignatura
  where estructura_plan_id = v_structure.id;
  if v_structure.id is null or v_subject_structure.id is null then
    raise exception using errcode = '23514', message = 'No se pudo resolver el paquete de origen';
  end if;
  select id into v_estado_id from public.estados_plan where clave = 'BORRADOR' order by orden limit 1;

  insert into public.planes_estudio (
    carrera_id, estructura_id, nombre, tipo_ciclo, numero_ciclos, datos,
    estado_actual_id, activo, tipo_origen, meta_origen, creado_por, actualizado_por,
    nombre_display, fecha_inicio_imparticion, seleccion_estructura,
    semanas_por_ciclo, rol_version_plan, etiqueta_version
  ) values (
    v_import.carrera_id, v_structure.id, null,
    coalesce(nullif(v_plan->>'tipo_ciclo', '')::public.tipo_ciclo, 'Semestre'),
    greatest(coalesce(nullif(v_plan->>'numero_ciclos', '')::integer, 1), 1),
    public.normalizar_datos_por_definicion(coalesce(v_plan->'datos', '{}'::jsonb), v_structure.definicion, true),
    v_estado_id, false, 'IMPORTADO_DOCUMENTAL',
    jsonb_build_object('tipo', 'IMPORTADO_DOCUMENTAL', 'importacion_id', v_import.id),
    v_actor, v_actor, coalesce(nullif(v_plan->>'nombre_display', ''), 'Plan importado'),
    coalesce(nullif(v_plan->>'fecha_inicio_imparticion', '')::date, date_trunc('month', current_date)::date),
    'AUTOMATICA', nullif(v_plan->>'semanas_por_ciclo', '')::integer,
    'VERSION_TRABAJO', nullif(v_plan->>'etiqueta_version', '')
  ) returning * into v_antecedente;

  for v_line in select value from jsonb_array_elements(coalesce(v_result->'lineas', '[]'::jsonb)) loop
    v_id := gen_random_uuid();
    v_line_map := v_line_map || jsonb_build_object(coalesce(v_line->>'id_externo', v_id::text), v_id::text);
    insert into public.lineas_plan (
      id, plan_estudio_id, nombre, orden, area, color, proposito,
      aporte_perfil_egreso, alcance_formativo, creado_por, actualizado_por
    ) values (
      v_id, v_antecedente.id, coalesce(nullif(v_line->>'nombre', ''), 'Área curricular'),
      coalesce((v_line->>'orden')::integer, 0), nullif(v_line->>'area', ''),
      nullif(v_line->>'color', ''), nullif(v_line->>'proposito', ''),
      nullif(v_line->>'aporte_perfil_egreso', ''), nullif(v_line->>'alcance_formativo', ''),
      v_actor, v_actor
    );
  end loop;

  for v_subject in select value from jsonb_array_elements(coalesce(v_result->'asignaturas', '[]'::jsonb)) loop
    v_id := gen_random_uuid();
    v_subject_map := v_subject_map || jsonb_build_object(coalesce(v_subject->>'id_externo', v_id::text), v_id::text);
    insert into public.asignaturas (
      id, plan_estudio_id, estructura_id, codigo, nombre, tipo, numero_ciclo,
      linea_plan_id, orden_celda, datos, contenido_tematico, tipo_origen,
      meta_origen, creado_por, actualizado_por, horas_academicas,
      horas_independientes, criterios_de_evaluacion, instalacion
    ) values (
      v_id, v_antecedente.id, v_subject_structure.id, nullif(v_subject->>'codigo', ''),
      coalesce(nullif(v_subject->>'nombre', ''), 'Asignatura importada'),
      coalesce(nullif(v_subject->>'tipo', '')::public.tipo_asignatura, 'OBLIGATORIA'),
      nullif(v_subject->>'numero_ciclo', '')::integer,
      nullif(v_line_map->>coalesce(v_subject->>'linea_id_externo', ''), '')::uuid,
      nullif(v_subject->>'orden_celda', '')::integer,
      public.normalizar_datos_por_definicion(coalesce(v_subject->'datos', '{}'::jsonb), v_subject_structure.definicion, true),
      coalesce(v_subject->'contenido_tematico', '[]'::jsonb), 'IMPORTADO_DOCUMENTAL',
      jsonb_build_object('tipo', 'IMPORTADO_DOCUMENTAL', 'importacion_id', v_import.id),
      v_actor, v_actor, nullif(v_subject->>'horas_academicas', '')::integer,
      nullif(v_subject->>'horas_independientes', '')::integer,
      coalesce(v_subject->'criterios_de_evaluacion', '[]'::jsonb),
      coalesce(nullif(v_subject->>'instalacion', '')::public.tipo_instalacion_asignatura, 'AULA')
    );
  end loop;

  for v_subject in select value from jsonb_array_elements(coalesce(v_result->'asignaturas', '[]'::jsonb)) loop
    if nullif(v_subject->>'prerrequisito_id_externo', '') is not null then
      update public.asignaturas set prerrequisito_asignatura_id =
        nullif(v_subject_map->>(v_subject->>'prerrequisito_id_externo'), '')::uuid
      where id = nullif(v_subject_map->>(v_subject->>'id_externo'), '')::uuid;
    end if;
    for v_biblio in select value from jsonb_array_elements(coalesce(v_subject->'bibliografia', '[]'::jsonb)) loop
      insert into public.bibliografia_asignatura (
        asignatura_id, tipo, cita, creado_por, titulo, autores, editorial, anio,
        isbn, referencia_biblioteca, referencia_en_linea, formato
      ) values (
        nullif(v_subject_map->>(v_subject->>'id_externo'), '')::uuid,
        coalesce(nullif(v_biblio->>'tipo', '')::public.tipo_bibliografia, 'BASICA'),
        coalesce(nullif(v_biblio->>'cita', ''), nullif(v_biblio->>'titulo', ''), 'Referencia importada'),
        v_actor, nullif(v_biblio->>'titulo', ''), coalesce(v_biblio->'autores', '[]'::jsonb),
        nullif(v_biblio->>'editorial', ''), nullif(v_biblio->>'anio', '')::integer,
        nullif(v_biblio->>'isbn', ''), nullif(v_biblio->>'referencia_biblioteca', ''),
        nullif(v_biblio->>'referencia_en_linea', ''), nullif(v_biblio->>'formato', '')
      );
    end loop;
  end loop;

  update public.planes_estudio
  set rol_version_plan = 'ANTECEDENTE', actualizado_por = v_actor
  where id = v_antecedente.id;

  v_trabajo := public.crear_version_redisenio(
    v_antecedente.id,
    coalesce(v_import.estructura_destino_id, v_structure.id),
    jsonb_build_object(
      'fecha_inicio_imparticion', coalesce(v_result #>> '{redisenio,fecha_inicio_imparticion}', v_plan->>'fecha_inicio_imparticion'),
      'etiqueta_version', v_result #>> '{redisenio,etiqueta_version}'
    )
  );

  update public.importaciones_academicas
  set estado = 'COMPLETADA', antecedente_plan_id = v_antecedente.id,
      version_trabajo_plan_id = v_trabajo.id, actualizado_en = now(), completado_en = now()
  where id = v_import.id;

  return jsonb_build_object('antecedente_plan_id', v_antecedente.id, 'version_trabajo_plan_id', v_trabajo.id);
exception when others then
  raise;
end;
$$;

grant execute on function public.aplicar_importacion_expediente(uuid) to authenticated;
revoke all on function public.aplicar_importacion_expediente(uuid) from public;
