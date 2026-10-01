-- El workspace sólo presenta pendientes asociados con versiones de trabajo
-- activas y con capacidad real de edición o una revisión asignada al usuario.
ALTER FUNCTION public.inicio_workspace(text, uuid, uuid)
  RENAME TO inicio_workspace_editable_base;

CREATE FUNCTION public.inicio_workspace(
  p_rol_clave text DEFAULT NULL,
  p_facultad_id uuid DEFAULT NULL,
  p_carrera_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_base jsonb;
  v_acciones jsonb;
  v_planes jsonb;
  v_asignaturas jsonb;
BEGIN
  v_base := public.inicio_workspace_editable_base(
    p_rol_clave,
    p_facultad_id,
    p_carrera_id
  );

  SELECT COALESCE(
    jsonb_agg(item ORDER BY item->>'titulo'),
    '[]'::jsonb
  )
  INTO v_acciones
  FROM jsonb_array_elements(
    COALESCE(v_base->'accionesPendientes', '[]'::jsonb)
  ) item
  LEFT JOIN public.planes_estudio p
    ON p.id = NULLIF(item->>'planId', '')::uuid
  WHERE p.id IS NULL
    OR (
      p.activo
      AND p.descartado_en IS NULL
      AND p.rol_version_plan = 'VERSION_TRABAJO'
      AND (
        public.authz_plan_write_allowed(p.id)
        OR (
          NULLIF(item->>'asignaturaId', '') IS NOT NULL
          AND public.authz_asignatura_write_allowed(
            NULLIF(item->>'asignaturaId', '')::uuid
          )
        )
        OR (
          item->>'tipo' = 'REVISION'
          AND item->>'permiso' = 'planes.aprobar'
          AND public.authz_has_permission('planes.aprobar')
        )
        OR (
          item->>'permiso' = 'evaluaciones.comentar'
          AND public.usuario_puede_comentar_plan(auth.uid(), p.id)
        )
      )
    );

  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'nombre'), '[]'::jsonb)
  INTO v_planes
  FROM jsonb_array_elements(
    COALESCE(v_base->'planes', '[]'::jsonb)
  ) item
  JOIN public.planes_estudio p
    ON p.id = NULLIF(item->>'id', '')::uuid
  WHERE p.activo
    AND p.descartado_en IS NULL
    AND p.rol_version_plan = 'VERSION_TRABAJO'
    AND public.authz_plan_write_allowed(p.id);

  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'actualizadoEn' DESC), '[]'::jsonb)
  INTO v_asignaturas
  FROM jsonb_array_elements(
    COALESCE(v_base->'asignaturas', '[]'::jsonb)
  ) item
  JOIN public.planes_estudio p
    ON p.id = NULLIF(item->>'planId', '')::uuid
  JOIN public.asignaturas a
    ON a.id = NULLIF(item->>'id', '')::uuid
  WHERE p.activo
    AND p.descartado_en IS NULL
    AND p.rol_version_plan = 'VERSION_TRABAJO'
    AND public.authz_asignatura_content_write_allowed(a.id);

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(v_base, '{accionesPendientes}', v_acciones),
      '{planes}',
      v_planes
    ),
    '{asignaturas}',
    v_asignaturas
  );
END;
$$;

ALTER FUNCTION public.inicio_workspace(text, uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.inicio_workspace(text, uuid, uuid) TO authenticated;
