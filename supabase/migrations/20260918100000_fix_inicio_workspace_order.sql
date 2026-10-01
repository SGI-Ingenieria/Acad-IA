-- Corrige el ordenamiento de la subconsulta de planes.
-- La migración original ya puede estar aplicada en entornos remotos, por eso
-- esta corrección se publica como una migración nueva.
CREATE OR REPLACE FUNCTION public.inicio_workspace(
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
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Autenticación requerida';
  END IF;

  IF p_rol_clave IS NOT NULL AND NOT public.authz_has_role(p_rol_clave) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'El rol solicitado no pertenece al usuario';
  END IF;

  v_base := public.inicio_mesa_trabajo(p_rol_clave, p_facultad_id, p_carrera_id);

  RETURN jsonb_build_object(
    'base', v_base,
    'capacidades', jsonb_build_object(
      'puedeCrearPlan', public.authz_has_permission('planes.crear'),
      'puedeEditarPlan', public.authz_has_permission('planes.editar'),
      'puedeEditarAsignatura', public.authz_has_permission('asignaturas.editar'),
      'puedeRevisar', public.authz_has_permission('planes.aprobar')
        OR public.authz_has_permission('evaluaciones.comentar')
        OR public.authz_has_role('PLANEACION_CURRICULAR')
        OR public.authz_has_role('SECRETARIO_ACADEMICO'),
      'puedeAprobar', public.authz_has_permission('planes.aprobar'),
      'puedeAsignarResponsables', public.authz_has_permission('asignaturas.responsables.gestionar'),
      'puedeUsarIA', public.authz_has_permission('ia.usar')
    ),
    'planes', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x."actualizadoEn" DESC)
      FROM (
        SELECT
          p.id,
          p.nombre_display AS nombre,
          p.carrera_id AS "carreraId",
          c.nombre AS "carreraNombre",
          c.facultad_id AS "facultadId",
          f.nombre AS "facultadNombre",
          ep.clave AS "estadoClave",
          ep.etiqueta AS "estadoEtiqueta",
          p.fase_diseno AS "faseDiseno",
          p.actualizado_en AS "actualizadoEn",
          COUNT(a.id)::integer AS "asignaturasTotal",
          COUNT(a.id) FILTER (WHERE
            a.estado <> 'borrador'::public.estado_asignatura
            AND CASE WHEN jsonb_typeof(a.contenido_tematico) = 'array'
              THEN jsonb_array_length(a.contenido_tematico) ELSE 0 END > 0
            AND CASE WHEN jsonb_typeof(a.criterios_de_evaluacion) = 'array'
              THEN jsonb_array_length(a.criterios_de_evaluacion) ELSE 0 END > 0
            AND a.numero_ciclo IS NOT NULL
            AND a.linea_plan_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.responsables_asignatura ra
              WHERE ra.asignatura_id = a.id
            )
          )::integer AS "asignaturasCompletas",
          COUNT(a.id) FILTER (WHERE
            a.estado = 'borrador'::public.estado_asignatura
            OR CASE WHEN jsonb_typeof(a.contenido_tematico) = 'array'
              THEN jsonb_array_length(a.contenido_tematico) ELSE 0 END = 0
            OR CASE WHEN jsonb_typeof(a.criterios_de_evaluacion) = 'array'
              THEN jsonb_array_length(a.criterios_de_evaluacion) ELSE 0 END = 0
            OR a.numero_ciclo IS NULL
            OR a.linea_plan_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM public.responsables_asignatura ra
              WHERE ra.asignatura_id = a.id
            )
          )::integer AS "asignaturasPendientes",
          COUNT(a.id) FILTER (WHERE NOT EXISTS (
            SELECT 1 FROM public.responsables_asignatura ra
            WHERE ra.asignatura_id = a.id
          ))::integer AS "asignaturasSinResponsable",
          COUNT(DISTINCT cp.id) FILTER (WHERE NOT cp.resuelto)::integer AS "comentariosPendientes",
          CASE WHEN p.fase_diseno = 'MAPA' AND COUNT(a.id) = 0 THEN 1 ELSE 0 END::integer AS bloqueos
        FROM public.planes_estudio p
        JOIN public.carreras c ON c.id = p.carrera_id
        JOIN public.facultades f ON f.id = c.facultad_id
        LEFT JOIN public.estados_plan ep ON ep.id = p.estado_actual_id
        LEFT JOIN public.asignaturas a ON a.plan_estudio_id = p.id
        LEFT JOIN public.comentarios_plan cp ON cp.plan_estudio_id = p.id
        WHERE p.activo
          AND public.authz_can_access_plan(p.id)
          AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
          AND (p_carrera_id IS NULL OR c.id = p_carrera_id)
        GROUP BY p.id, c.id, f.id, ep.id
      ) x
    ), '[]'::jsonb),
    'asignaturas', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x."actualizadoEn" DESC)
      FROM (
        SELECT
          a.id,
          a.plan_estudio_id AS "planId",
          p.nombre_display AS "planNombre",
          c.nombre AS "carreraNombre",
          a.nombre,
          a.estado,
          a.actualizado_en AS "actualizadoEn",
          CASE WHEN a.estado <> 'borrador'::public.estado_asignatura
            AND CASE WHEN jsonb_typeof(a.contenido_tematico) = 'array'
              THEN jsonb_array_length(a.contenido_tematico) ELSE 0 END > 0
            AND CASE WHEN jsonb_typeof(a.criterios_de_evaluacion) = 'array'
              THEN jsonb_array_length(a.criterios_de_evaluacion) ELSE 0 END > 0
          THEN 100 ELSE 50 END AS progreso,
          '[]'::jsonb AS pendientes
        FROM public.asignaturas a
        JOIN public.planes_estudio p ON p.id = a.plan_estudio_id
        JOIN public.carreras c ON c.id = p.carrera_id
        JOIN public.responsables_asignatura ra ON ra.asignatura_id = a.id
        WHERE ra.usuario_id = v_usuario
          AND ra.rol IN ('PROFESOR_RESPONSABLE'::public.rol_responsable_asignatura, 'COAUTOR'::public.rol_responsable_asignatura)
          AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
          AND (p_carrera_id IS NULL OR c.id = p_carrera_id)
      ) x
    ), '[]'::jsonb),
    'accionesPendientes', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.prioridad, x."fechaLimite" NULLS LAST)
      FROM (
        SELECT
          'tarea-' || tr.id::text AS id,
          'plan' AS entidad,
          tr.plan_estudio_id AS "entidadId",
          COALESCE(p.nombre_display, 'Revisión de plan') AS titulo,
          'Tienes una revisión asignada para este plan.' AS detalle,
          CASE WHEN tr.fecha_limite < current_date THEN 'CRITICA' ELSE 'ALTA' END AS severidad,
          tr.estatus::text AS estado,
          'planes.aprobar' AS permiso,
          '/planes/' || tr.plan_estudio_id::text AS ruta,
          3 AS "nivelDrilldown",
          'REVISION' AS tipo,
          tr.plan_estudio_id AS "planId",
          NULL::uuid AS "asignaturaId",
          tr.fecha_limite AS "fechaLimite",
          0 AS prioridad
        FROM public.tareas_revision tr
        JOIN public.planes_estudio p ON p.id = tr.plan_estudio_id
        WHERE tr.asignado_a = v_usuario AND tr.estatus = 'PENDIENTE'
        UNION ALL
        SELECT
          'sin-responsable-' || a.id::text,
          'asignatura',
          a.id,
          a.nombre,
          'La asignatura no tiene responsable asignado.',
          'ALTA',
          a.estado::text,
          'asignaturas.responsables.gestionar',
          '/planes/' || a.plan_estudio_id::text || '/asignaturas/' || a.id::text || '/responsables',
          4,
          'BLOQUEO',
          a.plan_estudio_id,
          a.id,
          NULL::date,
          1
        FROM public.asignaturas a
        JOIN public.planes_estudio p ON p.id = a.plan_estudio_id
        JOIN public.carreras c ON c.id = p.carrera_id
        WHERE public.authz_can_access_plan(a.plan_estudio_id)
          AND NOT EXISTS (SELECT 1 FROM public.responsables_asignatura ra WHERE ra.asignatura_id = a.id)
          AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
          AND (p_carrera_id IS NULL OR c.id = p_carrera_id)
        LIMIT 50
      ) x
    ), '[]'::jsonb),
    'indicadores', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)
      FROM (
        SELECT 'planes-pendientes' AS id, 'Planes con asignaturas pendientes' AS titulo,
          COUNT(*) FILTER (WHERE "asignaturasPendientes" > 0)::integer AS valor,
          'Planes que requieren trabajo académico.' AS detalle,
          'plan' AS entidad, 2 AS "nivelDrilldown", '/planes' AS ruta,
          CASE WHEN COUNT(*) FILTER (WHERE "asignaturasPendientes" > 0) > 0 THEN 'MEDIA' ELSE 'BAJA' END AS severidad
        FROM jsonb_to_recordset(COALESCE((
          SELECT jsonb_agg(to_jsonb(y)) FROM (
            SELECT p.id, COUNT(a.id) FILTER (WHERE a.estado = 'borrador'::public.estado_asignatura) AS "asignaturasPendientes"
            FROM public.planes_estudio p
            LEFT JOIN public.asignaturas a ON a.plan_estudio_id = p.id
            WHERE p.activo AND public.authz_can_access_plan(p.id)
            GROUP BY p.id
          ) y
        ), '[]'::jsonb)) AS r("id" uuid, "asignaturasPendientes" integer)
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

ALTER FUNCTION public.inicio_workspace(text, uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.inicio_workspace(text, uuid, uuid) TO authenticated;
