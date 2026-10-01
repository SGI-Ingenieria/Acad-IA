-- Se conserva la agregación existente como base y se expone un resumen
-- accionable por permiso para la portada compacta.
ALTER FUNCTION public.inicio_workspace(text, uuid, uuid)
  RENAME TO inicio_workspace_base;

CREATE FUNCTION public.inicio_workspace(
  p_rol_clave text DEFAULT NULL,
  p_facultad_id uuid DEFAULT NULL,
  p_carrera_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_base jsonb;
  v_acciones jsonb;
  v_progreso jsonb;
  v_puede_editar_asignatura boolean := public.authz_has_permission('asignaturas.editar');
  v_puede_editar_plan boolean := public.authz_has_permission('planes.editar');
  v_puede_asignar_responsables boolean := public.authz_has_permission('asignaturas.responsables.gestionar');
  v_puede_comentar boolean := public.authz_has_permission('evaluaciones.comentar');
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Autenticación requerida';
  END IF;

  v_base := public.inicio_workspace_base(
    p_rol_clave,
    p_facultad_id,
    p_carrera_id
  );

  SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.prioridad, f.titulo), '[]'::jsonb)
  INTO v_acciones
  FROM (
    SELECT
      item->>'id' AS id,
      item->>'entidad' AS entidad,
      item->>'entidadId' AS "entidadId",
      item->>'titulo' AS titulo,
      item->>'detalle' AS detalle,
      item->>'severidad' AS severidad,
      item->>'estado' AS estado,
      item->>'permiso' AS permiso,
      item->>'ruta' AS ruta,
      (item->>'nivelDrilldown')::integer AS "nivelDrilldown",
      item->>'tipo' AS tipo,
      item->>'planId' AS "planId",
      item->>'asignaturaId' AS "asignaturaId",
      item->>'fechaLimite' AS "fechaLimite",
      0 AS prioridad
    FROM jsonb_array_elements(COALESCE(v_base->'accionesPendientes', '[]'::jsonb)) item
    WHERE CASE item->>'permiso'
      WHEN 'planes.aprobar' THEN public.authz_has_permission('planes.aprobar')
      WHEN 'asignaturas.responsables.gestionar' THEN v_puede_asignar_responsables
      ELSE true
    END

    UNION ALL

    SELECT
      'contenido-' || a.id::text,
      'asignatura', a.id::text, a.nombre,
      'La asignatura no tiene contenido temático.', 'ALTA', a.estado::text,
      'asignaturas.editar',
      '/planes/' || a.plan_estudio_id::text || '/asignaturas/' || a.id::text || '/contenido',
      4, 'PENDIENTE', a.plan_estudio_id::text, a.id::text, NULL::text, 1
    FROM public.asignaturas a
    JOIN public.planes_estudio p ON p.id = a.plan_estudio_id
    JOIN public.carreras c ON c.id = p.carrera_id
    WHERE v_puede_editar_asignatura
      AND public.authz_can_access_plan(p.id)
      AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
      AND (p_carrera_id IS NULL OR c.id = p_carrera_id)
      AND (jsonb_typeof(a.contenido_tematico) <> 'array' OR jsonb_array_length(a.contenido_tematico) = 0)
      AND (v_puede_editar_plan OR EXISTS (
        SELECT 1 FROM public.responsables_asignatura ra
        WHERE ra.asignatura_id = a.id AND ra.usuario_id = v_usuario
      ))

    UNION ALL

    SELECT
      'borrador-' || a.id::text,
      'asignatura', a.id::text, a.nombre,
      'La asignatura sigue en borrador.', 'MEDIA', a.estado::text,
      'asignaturas.editar',
      '/planes/' || a.plan_estudio_id::text || '/asignaturas/' || a.id::text,
      4, 'PENDIENTE', a.plan_estudio_id::text, a.id::text, NULL::text, 2
    FROM public.asignaturas a
    JOIN public.planes_estudio p ON p.id = a.plan_estudio_id
    JOIN public.carreras c ON c.id = p.carrera_id
    WHERE v_puede_editar_asignatura
      AND a.estado = 'borrador'::public.estado_asignatura
      AND public.authz_can_access_plan(p.id)
      AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
      AND (p_carrera_id IS NULL OR c.id = p_carrera_id)
      AND (v_puede_editar_plan OR EXISTS (
        SELECT 1 FROM public.responsables_asignatura ra
        WHERE ra.asignatura_id = a.id AND ra.usuario_id = v_usuario
      ))

    UNION ALL

    SELECT
      'evaluacion-' || a.id::text,
      'asignatura', a.id::text, a.nombre,
      'La asignatura no tiene criterios de evaluación.', 'ALTA', a.estado::text,
      'asignaturas.editar',
      '/planes/' || a.plan_estudio_id::text || '/asignaturas/' || a.id::text || '/evaluacion',
      4, 'PENDIENTE', a.plan_estudio_id::text, a.id::text, NULL::text, 3
    FROM public.asignaturas a
    JOIN public.planes_estudio p ON p.id = a.plan_estudio_id
    JOIN public.carreras c ON c.id = p.carrera_id
    WHERE v_puede_editar_asignatura
      AND public.authz_can_access_plan(p.id)
      AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
      AND (p_carrera_id IS NULL OR c.id = p_carrera_id)
      AND (jsonb_typeof(a.criterios_de_evaluacion) <> 'array' OR jsonb_array_length(a.criterios_de_evaluacion) = 0)
      AND (v_puede_editar_plan OR EXISTS (
        SELECT 1 FROM public.responsables_asignatura ra
        WHERE ra.asignatura_id = a.id AND ra.usuario_id = v_usuario
      ))

    UNION ALL

    SELECT
      'mapa-' || a.id::text,
      'asignatura', a.id::text, a.nombre,
      'La asignatura no está ubicada en el mapa curricular.', 'MEDIA', a.estado::text,
      'planes.editar', '/planes/' || a.plan_estudio_id::text || '/mapa',
      3, 'PENDIENTE', a.plan_estudio_id::text, a.id::text, NULL::text, 4
    FROM public.asignaturas a
    JOIN public.planes_estudio p ON p.id = a.plan_estudio_id
    JOIN public.carreras c ON c.id = p.carrera_id
    WHERE v_puede_editar_plan
      AND public.authz_can_access_plan(p.id)
      AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
      AND (p_carrera_id IS NULL OR c.id = p_carrera_id)
      AND (a.numero_ciclo IS NULL OR a.linea_plan_id IS NULL)

    UNION ALL

    SELECT
      'comentario-' || cp.id::text,
      'plan', p.id::text, p.nombre_display,
      'Hay un comentario por resolver en este plan.', 'MEDIA', 'ABIERTO',
      'evaluaciones.comentar', '/planes/' || p.id::text,
      2, 'PENDIENTE', p.id::text, NULL::text, NULL::text, 5
    FROM public.comentarios_plan cp
    JOIN public.planes_estudio p ON p.id = cp.plan_estudio_id
    JOIN public.carreras c ON c.id = p.carrera_id
    WHERE v_puede_comentar
      AND NOT cp.resuelto
      AND public.authz_can_access_plan(p.id)
      AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
      AND (p_carrera_id IS NULL OR c.id = p_carrera_id)
  ) f;

  SELECT jsonb_build_object(
    'completadas', COALESCE(SUM(CASE WHEN x.completo THEN 1 ELSE 0 END), 0)::integer,
    'pendientes', COALESCE(SUM(CASE WHEN x.completo THEN 0 ELSE 1 END), 0)::integer,
    'total', COUNT(*)::integer,
    'porcentaje', CASE WHEN COUNT(*) = 0 THEN 100 ELSE ROUND(100.0 * SUM(CASE WHEN x.completo THEN 1 ELSE 0 END) / COUNT(*))::integer END
  )
  INTO v_progreso
  FROM (
    SELECT
      a.id,
      (
        (NOT v_puede_editar_asignatura OR (
          a.estado <> 'borrador'::public.estado_asignatura
          AND jsonb_typeof(a.contenido_tematico) = 'array'
          AND jsonb_array_length(a.contenido_tematico) > 0
          AND jsonb_typeof(a.criterios_de_evaluacion) = 'array'
          AND jsonb_array_length(a.criterios_de_evaluacion) > 0
        ))
        AND (NOT v_puede_editar_plan OR (a.numero_ciclo IS NOT NULL AND a.linea_plan_id IS NOT NULL))
        AND (NOT v_puede_asignar_responsables OR EXISTS (
          SELECT 1 FROM public.responsables_asignatura ra WHERE ra.asignatura_id = a.id
        ))
      ) AS completo
    FROM public.asignaturas a
    JOIN public.planes_estudio p ON p.id = a.plan_estudio_id
    JOIN public.carreras c ON c.id = p.carrera_id
    WHERE public.authz_can_access_plan(p.id)
      AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
      AND (p_carrera_id IS NULL OR c.id = p_carrera_id)
      AND (
        v_puede_editar_plan OR v_puede_asignar_responsables
        OR (v_puede_editar_asignatura AND EXISTS (
          SELECT 1 FROM public.responsables_asignatura ra
          WHERE ra.asignatura_id = a.id AND ra.usuario_id = v_usuario
        ))
      )
  ) x;

  RETURN jsonb_set(
    jsonb_set(v_base, '{accionesPendientes}', v_acciones),
    '{progreso}', v_progreso
  );
END;
$$;

ALTER FUNCTION public.inicio_workspace(text, uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.inicio_workspace(text, uuid, uuid) TO authenticated;
