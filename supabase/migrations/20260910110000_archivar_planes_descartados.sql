-- Un plan descartado se conserva para trazabilidad, pero queda fuera del
-- catálogo operativo y no vuelve a aceptar modificaciones.
ALTER TABLE public.planes_estudio
  ADD COLUMN descartado_en timestamptz,
  ADD COLUMN descartado_por uuid REFERENCES public.usuarios_app(id);

CREATE INDEX planes_estudio_descartado_en_idx
  ON public.planes_estudio (descartado_en)
  WHERE descartado_en IS NOT NULL;

COMMENT ON COLUMN public.planes_estudio.descartado_en IS
  'Fecha en que la versión de trabajo fue descartada y archivada de forma irreversible.';
COMMENT ON COLUMN public.planes_estudio.descartado_por IS
  'Usuario que descartó y archivó el plan.';

-- Este helper es la frontera de escritura compartida por las políticas RLS y
-- RPCs. Al centralizar aquí la condición, un plan archivado no puede editarse
-- aunque siga siendo visible desde el filtro de descartados.
CREATE OR REPLACE FUNCTION public.authz_plan_write_allowed(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.planes_estudio p
    WHERE p.id = p_plan_id
      AND p.rol_version_plan = 'VERSION_TRABAJO'
      AND p.descartado_en IS NULL
      AND (
        public.usuario_puede_editar_plan(auth.uid(), p_plan_id)
        OR (
          public.authz_is_admin()
          AND public.authz_admin_override_reason() IS NOT NULL
          AND public.authz_can_access_plan(p_plan_id)
        )
      )
  );
$$;

ALTER FUNCTION public.authz_plan_write_allowed(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.authz_plan_write_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authz_plan_write_allowed(uuid)
  TO authenticated, service_role;

-- El catálogo normal excluye los descartados; la opción "descartados" los
-- recupera. "todos" conserva su semántica literal para auditoría.
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $$
  WITH normalized AS (
    SELECT
      public.construir_tsquery_prefijos(p_search) AS search_query,
      nullif(btrim(coalesce(p_nivel, '')), '') AS nivel_term,
      CASE WHEN p_sort IN ('creado_desc', 'actualizado_desc', 'nombre_asc', 'nombre_desc')
        THEN p_sort ELSE 'creado_desc' END AS sort_term,
      greatest(0, least(coalesce(p_limit, 50), 100)) AS safe_limit,
      greatest(0, coalesce(p_offset, 0)) AS safe_offset,
      CASE WHEN p_modo_version IN ('actuales', 'antecedentes', 'descartados', 'todos')
        THEN p_modo_version ELSE 'actuales' END AS version_term
  ), filtered AS (
    SELECT pe, c, f, eplan, ep,
      ((CASE WHEN public.authz_simulacion_activa()
        THEN private.authz_claim_has_permission('planes.ver')
        ELSE public.authz_has_permission('planes.ver'::text) END)
        AND public.authz_can_access_plan(pe.id)) AS puede_abrir_detalle
    FROM public.planes_estudio pe
    JOIN public.carreras c ON c.id = pe.carrera_id
    JOIN public.facultades f ON f.id = c.facultad_id
    LEFT JOIN public.estructuras_plan eplan ON eplan.id = pe.estructura_id
    LEFT JOIN public.estados_plan ep ON ep.id = pe.estado_actual_id
    CROSS JOIN normalized n
    WHERE public.authz_can_list_plan_catalog_for_facultad(c.facultad_id)
      AND (n.search_query IS NULL OR pe.search_vector @@ n.search_query)
      AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
      AND (p_carrera_id IS NULL OR pe.carrera_id = p_carrera_id)
      AND (p_estado_id IS NULL OR pe.estado_actual_id = p_estado_id)
      AND (p_activo IS NULL OR pe.activo = p_activo)
      AND (p_tipo_estructura IS NULL OR eplan.tipo = p_tipo_estructura)
      AND (n.nivel_term IS NULL OR lower(public.unaccent_immutable(c.nivel::text)) = lower(public.unaccent_immutable(n.nivel_term)))
      AND (
        n.version_term = 'todos'
        OR (n.version_term = 'descartados' AND pe.descartado_en IS NOT NULL)
        OR (n.version_term = 'antecedentes' AND pe.descartado_en IS NULL AND pe.rol_version_plan = 'ANTECEDENTE')
        OR (n.version_term = 'actuales' AND pe.descartado_en IS NULL AND pe.rol_version_plan <> 'ANTECEDENTE')
      )
  )
  SELECT to_jsonb(filtered.pe), to_jsonb(filtered.c), to_jsonb(filtered.f),
    to_jsonb(filtered.eplan), to_jsonb(filtered.ep), filtered.puede_abrir_detalle,
    count(*) OVER ()
  FROM filtered CROSS JOIN normalized n
  ORDER BY
    CASE WHEN n.sort_term = 'creado_desc' THEN (filtered.pe).creado_en END DESC NULLS LAST,
    CASE WHEN n.sort_term = 'actualizado_desc' THEN (filtered.pe).actualizado_en END DESC NULLS LAST,
    CASE WHEN n.sort_term = 'nombre_asc' THEN (filtered.pe).nombre_search END ASC NULLS LAST,
    CASE WHEN n.sort_term = 'nombre_desc' THEN (filtered.pe).nombre_search END DESC NULLS LAST,
    (filtered.pe).id ASC
  LIMIT (SELECT safe_limit FROM normalized)
  OFFSET (SELECT safe_offset FROM normalized);
$$;

CREATE OR REPLACE FUNCTION public.planes_catalogo_estados_disponibles_versiones(
  p_facultad_id uuid DEFAULT NULL,
  p_carrera_id uuid DEFAULT NULL,
  p_nivel text DEFAULT NULL,
  p_activo boolean DEFAULT NULL,
  p_tipo_estructura public.tipo_estructura_plan DEFAULT NULL,
  p_modo_version text DEFAULT 'actuales'
)
RETURNS TABLE(estado_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $$
  WITH normalized AS (
    SELECT CASE WHEN p_modo_version IN ('actuales', 'antecedentes', 'descartados', 'todos')
      THEN p_modo_version ELSE 'actuales' END AS version_term
  )
  SELECT DISTINCT pe.estado_actual_id
  FROM public.planes_estudio pe
  JOIN public.carreras c ON c.id = pe.carrera_id
  LEFT JOIN public.estructuras_plan eplan ON eplan.id = pe.estructura_id
  CROSS JOIN normalized n
  WHERE pe.estado_actual_id IS NOT NULL
    AND public.authz_can_list_plan_catalog_for_facultad(c.facultad_id)
    AND (p_facultad_id IS NULL OR c.facultad_id = p_facultad_id)
    AND (p_carrera_id IS NULL OR pe.carrera_id = p_carrera_id)
    AND (p_activo IS NULL OR pe.activo = p_activo)
    AND (p_tipo_estructura IS NULL OR eplan.tipo = p_tipo_estructura)
    AND (nullif(btrim(coalesce(p_nivel, '')), '') IS NULL
      OR lower(public.unaccent_immutable(c.nivel::text)) = lower(public.unaccent_immutable(btrim(p_nivel))))
    AND (
      n.version_term = 'todos'
      OR (n.version_term = 'descartados' AND pe.descartado_en IS NOT NULL)
      OR (n.version_term = 'antecedentes' AND pe.descartado_en IS NULL AND pe.rol_version_plan = 'ANTECEDENTE')
      OR (n.version_term = 'actuales' AND pe.descartado_en IS NULL AND pe.rol_version_plan <> 'ANTECEDENTE')
    )
  ORDER BY pe.estado_actual_id;
$$;

GRANT EXECUTE ON FUNCTION public.planes_catalogo_buscar_versiones(
  text, uuid, uuid, uuid, text, boolean, text, integer, integer,
  public.tipo_estructura_plan, text
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.planes_catalogo_estados_disponibles_versiones(
  uuid, uuid, text, boolean, public.tipo_estructura_plan, text
) TO authenticated, service_role;

-- Un descarte congela también las acciones colaborativas que cambian el plan:
-- no aparecen transiciones disponibles ni se pueden añadir comentarios nuevos.
CREATE OR REPLACE FUNCTION private.transiciones_permitidas_plan(p_plan_id uuid)
RETURNS SETOF public.estados_plan
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $$
  SELECT DISTINCT e.*
  FROM public.planes_estudio pe
  JOIN public.estructuras_plan ep ON ep.id = pe.estructura_id
  JOIN public.transiciones_estado_plan t
    ON t.desde_estado_id = pe.estado_actual_id
    AND (t.tipo_estructura IS NULL OR t.tipo_estructura = ep.tipo)
  JOIN public.estados_plan e ON e.id = t.hacia_estado_id
  JOIN public.roles r ON r.id = t.rol_permitido_id
  WHERE pe.id = p_plan_id
    AND pe.descartado_en IS NULL
    AND public.usuario_puede_acceder_plan(auth.uid(), p_plan_id)
    AND (public.authz_is_admin()
      OR public.usuario_tiene_rol_contextual_plan(auth.uid(), p_plan_id, r.clave))
  ORDER BY e.orden;
$$;

CREATE OR REPLACE FUNCTION private.usuario_puede_comentar_plan(
  p_usuario_id uuid,
  p_plan_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth', 'extensions', 'pg_temp'
AS $$
  WITH estado AS (
    SELECT public.plan_estado_clave(p_plan_id) AS clave
  )
  SELECT EXISTS (
    SELECT 1 FROM public.planes_estudio pe
    WHERE pe.id = p_plan_id AND pe.descartado_en IS NULL
  )
  AND public.usuario_puede_acceder_plan(p_usuario_id, p_plan_id)
  AND (
    public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'ADMIN')
    OR ((SELECT clave FROM estado) = 'BORRADOR' AND (
      public.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id)
      OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
    ))
    OR ((SELECT clave FROM estado) = 'REVISION' AND (
      public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
      OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
    ))
    OR ((SELECT clave FROM estado) IN ('REV_PLANEACION', 'REV_VICERRECTORIA') AND (
      public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'PLANEACION_CURRICULAR')
      OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'VICERRECTOR_ACADEMICO')
    ))
    OR ((SELECT clave FROM estado) IN ('CONSULTA_EXPERTOS', 'REV_SEDES', 'CONSEJO_FACULTAD', 'CONSEJO_UNIVERSITARIO', 'JUNTA_GOBIERNO') AND (
      public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'VICERRECTOR_ACADEMICO')
      OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
      OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
    ))
    OR ((SELECT clave FROM estado) IN ('ENVIADO_SEP', 'APROBADO', 'RECHAZADO') AND (
      public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'PLANEACION_CURRICULAR')
      OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'VICERRECTOR_ACADEMICO')
      OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
      OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
    ))
  );
$$;
