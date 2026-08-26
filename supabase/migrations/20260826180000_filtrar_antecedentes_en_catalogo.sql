CREATE OR REPLACE FUNCTION public.planes_catalogo_buscar_versiones(
  p_search text DEFAULT NULL,
  p_facultad_id uuid DEFAULT NULL,
  p_carrera_id uuid DEFAULT NULL,
  p_estado_id uuid DEFAULT NULL,
  p_nivel text DEFAULT NULL,
  p_activo boolean DEFAULT NULL,
  p_sort text DEFAULT 'creado_desc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_tipo_estructura public.tipo_estructura_plan DEFAULT NULL,
  p_modo_version text DEFAULT 'actuales'
)
RETURNS TABLE(
  plan jsonb,
  carrera jsonb,
  facultad jsonb,
  estructura_plan jsonb,
  estado_plan jsonb,
  puede_abrir_detalle boolean,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, private, auth, extensions, pg_temp
AS $$
  WITH normalized AS (
    SELECT
      lower(public.unaccent_immutable(btrim(coalesce(p_search, '')))) AS search_term,
      nullif(btrim(coalesce(p_nivel, '')), '') AS nivel_term,
      CASE
        WHEN p_sort IN ('creado_desc', 'actualizado_desc', 'nombre_asc', 'nombre_desc')
          THEN p_sort
        ELSE 'creado_desc'
      END AS sort_term,
      greatest(0, least(coalesce(p_limit, 50), 100)) AS safe_limit,
      greatest(0, coalesce(p_offset, 0)) AS safe_offset,
      CASE
        WHEN p_modo_version IN ('actuales', 'antecedentes', 'todos')
          THEN p_modo_version
        ELSE 'actuales'
      END AS version_term
  ),
  filtered AS (
    SELECT
      pe,
      c,
      f,
      eplan,
      ep,
      (
        CASE
          WHEN public.authz_simulacion_activa()
            THEN private.authz_claim_has_permission('planes.ver')
          ELSE public.authz_has_permission('planes.ver'::text)
        END
        AND public.authz_can_access_plan(pe.id)
      ) AS puede_abrir_detalle
    FROM public.planes_estudio pe
    JOIN public.carreras c ON c.id = pe.carrera_id
    JOIN public.facultades f ON f.id = c.facultad_id
    LEFT JOIN public.estructuras_plan eplan ON eplan.id = pe.estructura_id
    LEFT JOIN public.estados_plan ep ON ep.id = pe.estado_actual_id
    CROSS JOIN normalized n
    WHERE public.authz_can_list_plan_catalog_for_facultad(c.facultad_id)
      AND (n.search_term = '' OR pe.nombre_search ILIKE '%' || n.search_term || '%')
      AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
      AND (p_carrera_id IS NULL OR pe.carrera_id = p_carrera_id)
      AND (p_estado_id IS NULL OR pe.estado_actual_id = p_estado_id)
      AND (p_activo IS NULL OR pe.activo = p_activo)
      AND (p_tipo_estructura IS NULL OR eplan.tipo = p_tipo_estructura)
      AND (
        n.nivel_term IS NULL
        OR lower(public.unaccent_immutable(c.nivel::text)) =
          lower(public.unaccent_immutable(n.nivel_term))
      )
      AND (
        n.version_term = 'todos'
        OR (n.version_term = 'antecedentes' AND pe.rol_version_plan = 'ANTECEDENTE')
        OR (n.version_term = 'actuales' AND pe.rol_version_plan <> 'ANTECEDENTE')
      )
  )
  SELECT
    to_jsonb(filtered.pe),
    to_jsonb(filtered.c),
    to_jsonb(filtered.f),
    to_jsonb(filtered.eplan),
    to_jsonb(filtered.ep),
    filtered.puede_abrir_detalle,
    count(*) OVER ()
  FROM filtered
  CROSS JOIN normalized n
  ORDER BY
    CASE WHEN n.sort_term = 'creado_desc' THEN (filtered.pe).creado_en END DESC NULLS LAST,
    CASE WHEN n.sort_term = 'actualizado_desc' THEN (filtered.pe).actualizado_en END DESC NULLS LAST,
    CASE WHEN n.sort_term = 'nombre_asc' THEN (filtered.pe).nombre_search END ASC NULLS LAST,
    CASE WHEN n.sort_term = 'nombre_desc' THEN (filtered.pe).nombre_search END DESC NULLS LAST,
    (filtered.pe).id ASC
  LIMIT (SELECT safe_limit FROM normalized)
  OFFSET (SELECT safe_offset FROM normalized);
$$;

ALTER FUNCTION public.planes_catalogo_buscar_versiones(
  text, uuid, uuid, uuid, text, boolean, text, integer, integer,
  public.tipo_estructura_plan, text
) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.planes_catalogo_estados_disponibles_versiones(
  p_facultad_id uuid DEFAULT NULL,
  p_carrera_id uuid DEFAULT NULL,
  p_nivel text DEFAULT NULL,
  p_activo boolean DEFAULT NULL,
  p_tipo_estructura public.tipo_estructura_plan DEFAULT NULL,
  p_modo_version text DEFAULT 'actuales'
)
RETURNS TABLE(estado_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, private, auth, extensions, pg_temp
AS $$
  SELECT DISTINCT pe.estado_actual_id
  FROM public.planes_estudio pe
  JOIN public.carreras c ON c.id = pe.carrera_id
  LEFT JOIN public.estructuras_plan eplan ON eplan.id = pe.estructura_id
  WHERE pe.estado_actual_id IS NOT NULL
    AND public.authz_can_list_plan_catalog_for_facultad(c.facultad_id)
    AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
    AND (p_carrera_id IS NULL OR pe.carrera_id = p_carrera_id)
    AND (p_activo IS NULL OR pe.activo = p_activo)
    AND (p_tipo_estructura IS NULL OR eplan.tipo = p_tipo_estructura)
    AND (
      CASE
        WHEN p_modo_version IN ('actuales', 'antecedentes', 'todos')
          THEN p_modo_version
        ELSE 'actuales'
      END = 'todos'
      OR (
        CASE
          WHEN p_modo_version IN ('actuales', 'antecedentes', 'todos')
            THEN p_modo_version
          ELSE 'actuales'
        END = 'antecedentes'
        AND pe.rol_version_plan = 'ANTECEDENTE'
      )
      OR (
        CASE
          WHEN p_modo_version IN ('actuales', 'antecedentes', 'todos')
            THEN p_modo_version
          ELSE 'actuales'
        END = 'actuales'
        AND pe.rol_version_plan <> 'ANTECEDENTE'
      )
    )
    AND (
      nullif(btrim(coalesce(p_nivel, '')), '') IS NULL
      OR lower(public.unaccent_immutable(c.nivel::text)) =
        lower(public.unaccent_immutable(btrim(p_nivel)))
    )
  ORDER BY pe.estado_actual_id;
$$;

ALTER FUNCTION public.planes_catalogo_estados_disponibles_versiones(
  uuid, uuid, text, boolean, public.tipo_estructura_plan, text
) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.planes_catalogo_buscar_versiones(
  text, uuid, uuid, uuid, text, boolean, text, integer, integer,
  public.tipo_estructura_plan, text
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.planes_catalogo_estados_disponibles_versiones(
  uuid, uuid, text, boolean, public.tipo_estructura_plan, text
) TO authenticated, service_role;
