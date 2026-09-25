-- Conserva el nombre del plan en cada pendiente para que los grupos del
-- dashboard siempre tengan un encabezado reconocible, incluso si el plan no
-- está incluido en el resumen visible del rol.
ALTER FUNCTION public.inicio_workspace(text, uuid, uuid)
  RENAME TO inicio_workspace_dashboard_base;

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
BEGIN
  v_base := public.inicio_workspace_dashboard_base(
    p_rol_clave,
    p_facultad_id,
    p_carrera_id
  );

  SELECT COALESCE(
    jsonb_agg(
      item || jsonb_build_object(
        'planNombre', COALESCE(p.nombre_display, item->>'planNombre'),
        'carreraNombre', COALESCE(c.nombre, item->>'carreraNombre')
      )
      ORDER BY item->>'titulo'
    ),
    '[]'::jsonb
  )
  INTO v_acciones
  FROM jsonb_array_elements(
    COALESCE(v_base->'accionesPendientes', '[]'::jsonb)
  ) item
  LEFT JOIN public.planes_estudio p
    ON p.id = NULLIF(item->>'planId', '')::uuid
  LEFT JOIN public.carreras c ON c.id = p.carrera_id;

  RETURN jsonb_set(v_base, '{accionesPendientes}', v_acciones);
END;
$$;

ALTER FUNCTION public.inicio_workspace(text, uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.inicio_workspace(text, uuid, uuid) TO authenticated;
