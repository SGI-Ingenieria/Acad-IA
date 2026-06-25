-- Congelamiento por etapa y permisos contextuales para planes/asignaturas.
-- La autorización de escritura deja de depender solo de permisos amplios
-- (`planes.editar`, `asignaturas.editar`) y toma en cuenta el estado del plan.

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Catálogo de estados/permisos base
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO public.permisos (clave, nombre, descripcion, grupo, orden)
VALUES
  ('ia.usar', 'Usar IA', 'Generar o mejorar contenido académico con IA', 'ia', 10)
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  grupo = EXCLUDED.grupo,
  orden = EXCLUDED.orden;

WITH matriz(rol_clave, permiso_clave) AS (
  VALUES
    ('ADMIN', 'ia.usar'),
    ('SECRETARIO_ACADEMICO', 'ia.usar'),
    ('JEFE_CARRERA', 'ia.usar'),
    ('JEFE_CARRERA', 'planes.aprobar')
)
INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM matriz m
JOIN public.roles r ON r.clave = m.rol_clave
JOIN public.permisos p ON p.clave = m.permiso_clave
ON CONFLICT DO NOTHING;

-- Retira permisos de edición heredados que chocan con el flujo nuevo. La matriz
-- contextual de abajo sigue siendo la defensa principal, pero esto evita UI
-- basada en permisos amplios.
DELETE FROM public.roles_permisos rp
USING public.roles r, public.permisos p
WHERE rp.rol_id = r.id
  AND rp.permiso_id = p.id
  AND (r.clave, p.clave) IN (
    ('DIRECTOR_FACULTAD', 'planes.editar'),
    ('DIRECTOR_FACULTAD', 'asignaturas.editar'),
    ('PROFESOR', 'asignaturas.editar'),
    ('PLANEACION_CURRICULAR', 'planes.editar'),
    ('COORD_DHP', 'planes.editar'),
    ('COORD_DHP', 'asignaturas.editar')
  );

UPDATE public.estados_plan
SET etiqueta = 'En dialogo por ACERT',
    color = '#0ea5e9'
WHERE clave = 'ENVIADO_SEP';

UPDATE public.estados_plan
SET etiqueta = 'Aprobado por ACERT'
WHERE clave = 'APROBADO';

-- Reemplaza por completo el state machine para evitar transiciones heredadas.
DELETE FROM public.transiciones_estado_plan;

WITH flujo(desde, hacia, rol) AS (
  VALUES
    ('BORRADOR', 'REVISION', 'JEFE_CARRERA'),
    ('REVISION', 'REV_PLANEACION', 'SECRETARIO_ACADEMICO'),
    ('REV_PLANEACION', 'CONSULTA_EXPERTOS', 'PLANEACION_CURRICULAR'),
    ('CONSULTA_EXPERTOS', 'REV_SEDES', 'DIRECTOR_FACULTAD'),
    ('CONSULTA_EXPERTOS', 'REV_SEDES', 'SECRETARIO_ACADEMICO'),
    ('REV_SEDES', 'CONSEJO_FACULTAD', 'DIRECTOR_FACULTAD'),
    ('REV_SEDES', 'CONSEJO_FACULTAD', 'SECRETARIO_ACADEMICO'),
    ('CONSEJO_FACULTAD', 'CONSEJO_UNIVERSITARIO', 'DIRECTOR_FACULTAD'),
    ('CONSEJO_UNIVERSITARIO', 'JUNTA_GOBIERNO', 'VICERRECTOR_ACADEMICO'),
    ('JUNTA_GOBIERNO', 'ENVIADO_SEP', 'VICERRECTOR_ACADEMICO'),
    ('ENVIADO_SEP', 'APROBADO', 'PLANEACION_CURRICULAR'),

    ('REVISION', 'BORRADOR', 'SECRETARIO_ACADEMICO'),
    ('REV_PLANEACION', 'BORRADOR', 'PLANEACION_CURRICULAR'),
    ('CONSULTA_EXPERTOS', 'BORRADOR', 'DIRECTOR_FACULTAD'),
    ('CONSULTA_EXPERTOS', 'BORRADOR', 'SECRETARIO_ACADEMICO'),
    ('REV_SEDES', 'BORRADOR', 'DIRECTOR_FACULTAD'),
    ('REV_SEDES', 'BORRADOR', 'SECRETARIO_ACADEMICO'),
    ('CONSEJO_FACULTAD', 'BORRADOR', 'DIRECTOR_FACULTAD'),
    ('CONSEJO_UNIVERSITARIO', 'BORRADOR', 'VICERRECTOR_ACADEMICO'),
    ('JUNTA_GOBIERNO', 'BORRADOR', 'VICERRECTOR_ACADEMICO'),
    ('ENVIADO_SEP', 'BORRADOR', 'PLANEACION_CURRICULAR'),

    ('CONSEJO_FACULTAD', 'RECHAZADO', 'DIRECTOR_FACULTAD'),
    ('CONSEJO_UNIVERSITARIO', 'RECHAZADO', 'VICERRECTOR_ACADEMICO'),
    ('JUNTA_GOBIERNO', 'RECHAZADO', 'VICERRECTOR_ACADEMICO'),
    ('ENVIADO_SEP', 'RECHAZADO', 'PLANEACION_CURRICULAR')
)
INSERT INTO public.transiciones_estado_plan (desde_estado_id, hacia_estado_id, rol_permitido_id)
SELECT d.id, h.id, r.id
FROM flujo f
JOIN public.estados_plan d ON d.clave = f.desde
JOIN public.estados_plan h ON h.clave = f.hacia
JOIN public.roles r ON r.clave = f.rol
ON CONFLICT (desde_estado_id, hacia_estado_id, rol_permitido_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Helpers contextuales
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.authz_is_service_role()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_claims jsonb;
BEGIN
  BEGIN
    v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_claims := '{}'::jsonb;
  END;

  RETURN COALESCE(v_claims ->> 'role', '') = 'service_role';
END;
$$;

CREATE OR REPLACE FUNCTION public.authz_admin_override_reason()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_headers jsonb;
  v_reason text;
BEGIN
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_headers := '{}'::jsonb;
  END;

  v_reason := COALESCE(
    v_headers ->> 'x-admin-override-reason',
    v_headers ->> 'X-Admin-Override-Reason',
    v_headers ->> 'x_admin_override_reason'
  );

  RETURN NULLIF(btrim(COALESCE(v_reason, '')), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.plan_estado_clave(p_plan_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ep.clave
  FROM public.planes_estudio pe
  LEFT JOIN public.estados_plan ep ON ep.id = pe.estado_actual_id
  WHERE pe.id = p_plan_id;
$$;

CREATE OR REPLACE FUNCTION public.usuario_tiene_rol_en_plan(
  p_usuario_id uuid,
  p_plan_id uuid,
  p_rol text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_usuario_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.planes_estudio pe
      JOIN public.carreras c ON c.id = pe.carrera_id
      JOIN public.usuarios_roles ur ON ur.usuario_id = p_usuario_id
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE pe.id = p_plan_id
        AND ua.dado_de_baja_en IS NULL
        AND r.clave = p_rol
        AND (
          r.clave = 'ADMIN'
          OR (ur.facultad_id IS NULL AND ur.carrera_id IS NULL AND r.alcance_default = 'global')
          OR ur.carrera_id = pe.carrera_id
          OR ur.facultad_id = c.facultad_id
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.usuario_es_jefe_encargado_plan(
  p_usuario_id uuid,
  p_plan_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_usuario_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.planes_estudio pe
      JOIN public.usuarios_roles ur ON ur.carrera_id = pe.carrera_id
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE pe.id = p_plan_id
        AND ur.usuario_id = p_usuario_id
        AND ua.dado_de_baja_en IS NULL
        AND r.clave = 'JEFE_CARRERA'
    );
$$;

CREATE OR REPLACE FUNCTION public.usuario_es_externo_asignado_plan(
  p_usuario_id uuid,
  p_plan_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_usuario_id IS NOT NULL
    AND public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'EVALUADOR_EXTERNO')
    AND EXISTS (
      SELECT 1
      FROM public.plan_expertos px
      JOIN public.expertos e ON e.id = px.experto_id
      WHERE px.plan_estudio_id = p_plan_id
        AND e.usuario_id = p_usuario_id
    );
$$;

CREATE OR REPLACE FUNCTION public.usuario_tiene_rol_contextual_plan(
  p_usuario_id uuid,
  p_plan_id uuid,
  p_rol text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_rol = 'JEFE_CARRERA' THEN public.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id)
    ELSE public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, p_rol)
  END;
$$;

CREATE OR REPLACE FUNCTION public.usuario_puede_acceder_plan(
  p_usuario_id uuid,
  p_plan_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_usuario_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.planes_estudio pe
        JOIN public.carreras c ON c.id = pe.carrera_id
        JOIN public.usuarios_roles ur ON ur.usuario_id = p_usuario_id
        JOIN public.roles r ON r.id = ur.rol_id
        JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
        WHERE pe.id = p_plan_id
          AND ua.dado_de_baja_en IS NULL
          AND (
            r.clave = 'ADMIN'
            OR (ur.facultad_id IS NULL AND ur.carrera_id IS NULL AND r.alcance_default = 'global')
            OR ur.carrera_id = pe.carrera_id
            OR ur.facultad_id = c.facultad_id
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.plan_expertos px
        JOIN public.expertos e ON e.id = px.experto_id
        WHERE px.plan_estudio_id = p_plan_id
          AND e.usuario_id = p_usuario_id
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.authz_can_access_plan(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.usuario_puede_acceder_plan(auth.uid(), p_plan_id);
$$;

CREATE OR REPLACE FUNCTION public.authz_can_access_asignatura(p_asignatura_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND (
        public.authz_can_access_plan(a.plan_estudio_id)
        OR EXISTS (
          SELECT 1
          FROM public.responsables_asignatura ra
          WHERE ra.asignatura_id = p_asignatura_id
            AND ra.usuario_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.usuario_puede_editar_plan(
  p_usuario_id uuid,
  p_plan_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH estado AS (
    SELECT public.plan_estado_clave(p_plan_id) AS clave
  )
  SELECT public.usuario_puede_acceder_plan(p_usuario_id, p_plan_id)
    AND (
      ((SELECT clave FROM estado) IN ('BORRADOR', 'REVISION')
        AND public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'ADMIN'))
      OR ((SELECT clave FROM estado) = 'BORRADOR'
        AND public.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id))
      OR ((SELECT clave FROM estado) IN ('BORRADOR', 'REVISION')
        AND public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO'))
    );
$$;

CREATE OR REPLACE FUNCTION public.usuario_puede_editar_asignatura(
  p_usuario_id uuid,
  p_asignatura_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.usuario_puede_editar_plan(p_usuario_id, a.plan_estudio_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.authz_plan_write_allowed(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.usuario_puede_editar_plan(auth.uid(), p_plan_id)
    OR (
      public.authz_is_admin()
      AND public.authz_admin_override_reason() IS NOT NULL
      AND public.authz_can_access_plan(p_plan_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.authz_asignatura_write_allowed(p_asignatura_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.usuario_puede_editar_asignatura(auth.uid(), p_asignatura_id)
    OR (
      public.authz_is_admin()
      AND public.authz_admin_override_reason() IS NOT NULL
      AND public.authz_can_access_asignatura(p_asignatura_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.authz_plan_ia_allowed(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.usuario_puede_editar_plan(auth.uid(), p_plan_id)
    AND public.authz_has_permission('ia.usar')
    AND public.plan_estado_clave(p_plan_id) IN ('BORRADOR', 'REVISION');
$$;

CREATE OR REPLACE FUNCTION public.usuario_puede_usar_ia_plan(
  p_usuario_id uuid,
  p_plan_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.usuario_puede_editar_plan(p_usuario_id, p_plan_id)
    AND public.usuario_tiene_permiso(p_usuario_id, 'ia.usar')
    AND public.plan_estado_clave(p_plan_id) IN ('BORRADOR', 'REVISION');
$$;

CREATE OR REPLACE FUNCTION public.usuario_puede_usar_ia_asignatura(
  p_usuario_id uuid,
  p_asignatura_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.usuario_puede_usar_ia_plan(p_usuario_id, a.plan_estudio_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.authz_asignatura_ia_allowed(p_asignatura_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.usuario_puede_usar_ia_asignatura(auth.uid(), p_asignatura_id);
$$;

CREATE OR REPLACE FUNCTION public.usuario_puede_comentar_plan(
  p_usuario_id uuid,
  p_plan_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH estado AS (
    SELECT public.plan_estado_clave(p_plan_id) AS clave
  )
  SELECT public.usuario_puede_acceder_plan(p_usuario_id, p_plan_id)
    AND (
      public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'ADMIN')
      OR ((SELECT clave FROM estado) = 'BORRADOR'
        AND (
          public.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id)
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
        ))
      OR ((SELECT clave FROM estado) = 'REVISION'
        AND (
          public.usuario_es_jefe_encargado_plan(p_usuario_id, p_plan_id)
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
        ))
      OR ((SELECT clave FROM estado) = 'REV_PLANEACION'
        AND public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'PLANEACION_CURRICULAR'))
      OR ((SELECT clave FROM estado) IN ('CONSULTA_EXPERTOS', 'REV_SEDES')
        AND (
          public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
          OR public.usuario_es_externo_asignado_plan(p_usuario_id, p_plan_id)
        ))
      OR ((SELECT clave FROM estado) = 'CONSEJO_FACULTAD'
        AND (
          public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'VICERRECTOR_ACADEMICO')
        ))
      OR ((SELECT clave FROM estado) IN ('CONSEJO_UNIVERSITARIO', 'JUNTA_GOBIERNO')
        AND (
          public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'VICERRECTOR_ACADEMICO')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
        ))
      OR ((SELECT clave FROM estado) IN ('ENVIADO_SEP', 'APROBADO', 'RECHAZADO')
        AND (
          public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'PLANEACION_CURRICULAR')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'VICERRECTOR_ACADEMICO')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'DIRECTOR_FACULTAD')
          OR public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'SECRETARIO_ACADEMICO')
        ))
    );
$$;

CREATE OR REPLACE FUNCTION public.usuario_puede_comentar_asignatura(
  p_usuario_id uuid,
  p_asignatura_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asignaturas a
    WHERE a.id = p_asignatura_id
      AND public.usuario_puede_comentar_plan(p_usuario_id, a.plan_estudio_id)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.authz_is_service_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_admin_override_reason() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.plan_estado_clave(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_tiene_rol_en_plan(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_es_jefe_encargado_plan(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_es_externo_asignado_plan(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_tiene_rol_contextual_plan(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_puede_acceder_plan(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_puede_editar_plan(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_puede_editar_asignatura(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_plan_write_allowed(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_asignatura_write_allowed(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_plan_ia_allowed(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_puede_usar_ia_plan(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_puede_usar_ia_asignatura(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_asignatura_ia_allowed(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_puede_comentar_plan(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_puede_comentar_asignatura(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.authz_is_service_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_admin_override_reason() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_estado_clave(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_tiene_rol_en_plan(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_es_jefe_encargado_plan(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_es_externo_asignado_plan(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_tiene_rol_contextual_plan(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_puede_acceder_plan(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_puede_editar_plan(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_puede_editar_asignatura(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_plan_write_allowed(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_asignatura_write_allowed(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_plan_ia_allowed(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_puede_usar_ia_plan(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_puede_usar_ia_asignatura(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_asignatura_ia_allowed(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_puede_comentar_plan(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_puede_comentar_asignatura(uuid, uuid) TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Transiciones contextuales
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.usuario_puede_transicionar_plan(
  p_usuario_id uuid,
  p_plan_id uuid,
  p_hacia_estado_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.usuario_puede_acceder_plan(p_usuario_id, p_plan_id)
    AND (
      public.usuario_tiene_rol_en_plan(p_usuario_id, p_plan_id, 'ADMIN')
      OR EXISTS (
        SELECT 1
        FROM public.transiciones_estado_plan t
        JOIN public.planes_estudio pe ON pe.id = p_plan_id
        JOIN public.roles r ON r.id = t.rol_permitido_id
        WHERE t.desde_estado_id = pe.estado_actual_id
          AND t.hacia_estado_id = p_hacia_estado_id
          AND public.usuario_tiene_rol_contextual_plan(p_usuario_id, p_plan_id, r.clave)
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.transiciones_permitidas_plan(p_plan_id uuid)
RETURNS SETOF public.estados_plan
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT e.*
  FROM public.planes_estudio pe
  JOIN public.transiciones_estado_plan t ON t.desde_estado_id = pe.estado_actual_id
  JOIN public.estados_plan e ON e.id = t.hacia_estado_id
  JOIN public.roles r ON r.id = t.rol_permitido_id
  WHERE pe.id = p_plan_id
    AND public.usuario_puede_acceder_plan(auth.uid(), p_plan_id)
    AND (
      public.authz_is_admin()
      OR public.usuario_tiene_rol_contextual_plan(auth.uid(), p_plan_id, r.clave)
    )
  ORDER BY e.orden;
$$;

CREATE OR REPLACE FUNCTION public.usuario_puede_transicionar_asignatura(
  p_usuario_id uuid,
  p_asignatura_id uuid,
  p_nuevo_estado public.estado_asignatura
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH a AS (
    SELECT estado FROM public.asignaturas WHERE id = p_asignatura_id
  )
  SELECT public.usuario_puede_editar_asignatura(p_usuario_id, p_asignatura_id)
    AND CASE
      WHEN p_nuevo_estado = 'revisada' THEN (SELECT estado FROM a) = 'borrador'
      WHEN p_nuevo_estado = 'aprobada' THEN (SELECT estado FROM a) = 'revisada'
      WHEN p_nuevo_estado = 'borrador' THEN (SELECT estado FROM a) IN ('revisada', 'aprobada')
      ELSE false
    END;
$$;

REVOKE ALL ON FUNCTION public.usuario_puede_transicionar_plan(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transiciones_permitidas_plan(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.usuario_puede_transicionar_asignatura(uuid, uuid, public.estado_asignatura) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuario_puede_transicionar_plan(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transiciones_permitidas_plan(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_puede_transicionar_asignatura(uuid, uuid, public.estado_asignatura) TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Auditoría de overrides y cambios relacionados
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cambios_plan
  ADD COLUMN IF NOT EXISTS admin_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_override_motivo text,
  ADD COLUMN IF NOT EXISTS admin_override_estado_clave text;

ALTER TABLE public.cambios_asignatura
  ADD COLUMN IF NOT EXISTS admin_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_override_motivo text,
  ADD COLUMN IF NOT EXISTS admin_override_estado_clave text;

CREATE OR REPLACE FUNCTION public.authz_admin_override_audit(p_plan_id uuid)
RETURNS TABLE(admin_override boolean, motivo text, estado_clave text)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (public.authz_is_admin()
      AND public.authz_admin_override_reason() IS NOT NULL
      AND public.plan_estado_clave(p_plan_id) NOT IN ('BORRADOR', 'REVISION')) AS admin_override,
    public.authz_admin_override_reason() AS motivo,
    public.plan_estado_clave(p_plan_id) AS estado_clave;
$$;

REVOKE EXECUTE ON FUNCTION public.authz_admin_override_audit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authz_admin_override_audit(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_log_cambios_planes_estudio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
  old_val jsonb;
  new_val jsonb;
  v_response_id text := NULL;
  v_actor uuid;
  v_override boolean := false;
  v_motivo text := NULL;
  v_estado text := NULL;
BEGIN
  IF tg_op <> 'DELETE' THEN
    v_response_id := NULLIF(new.meta_origen->>'response_id', '');
  END IF;

  v_actor := CASE
    WHEN tg_op = 'INSERT' THEN new.creado_por
    WHEN tg_op = 'DELETE' THEN old.actualizado_por
    ELSE new.actualizado_por
  END;

  SELECT a.admin_override, a.motivo, a.estado_clave
  INTO v_override, v_motivo, v_estado
  FROM public.authz_admin_override_audit(CASE WHEN tg_op = 'DELETE' THEN old.id ELSE new.id END) a;

  IF tg_op = 'INSERT' THEN
    INSERT INTO public.cambios_plan (
      plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
      response_id, admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      new.id, v_actor, 'CREACION'::public.tipo_cambio, NULL, NULL, to_jsonb(new),
      NULL, v_override, v_motivo, v_estado
    );
    RETURN new;
  END IF;

  IF tg_op = 'DELETE' THEN
    INSERT INTO public.cambios_plan (
      plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
      response_id, admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      old.id, v_actor, 'OTRO'::public.tipo_cambio, 'DELETE', to_jsonb(old), NULL,
      NULL, v_override, v_motivo, v_estado
    );
    RETURN old;
  END IF;

  IF (new.estado_actual_id IS DISTINCT FROM old.estado_actual_id) THEN
    INSERT INTO public.cambios_plan (
      plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
      response_id, admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      new.id, v_actor, 'TRANSICION_ESTADO'::public.tipo_cambio, 'estado_actual_id',
      to_jsonb(old.estado_actual_id), to_jsonb(new.estado_actual_id),
      NULL, v_override, v_motivo, v_estado
    );
  END IF;

  IF (new.datos IS DISTINCT FROM old.datos) THEN
    FOR k IN
      SELECT DISTINCT key
      FROM (
        SELECT jsonb_object_keys(coalesce(old.datos, '{}'::jsonb)) AS key
        UNION ALL
        SELECT jsonb_object_keys(coalesce(new.datos, '{}'::jsonb)) AS key
      ) t
    LOOP
      old_val := coalesce(old.datos, '{}'::jsonb) -> k;
      new_val := coalesce(new.datos, '{}'::jsonb) -> k;

      IF (old_val IS DISTINCT FROM new_val) THEN
        INSERT INTO public.cambios_plan (
          plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
          response_id, admin_override, admin_override_motivo, admin_override_estado_clave
        )
        VALUES (
          new.id, v_actor, 'ACTUALIZACION_CAMPO'::public.tipo_cambio, k,
          old_val, new_val, v_response_id, v_override, v_motivo, v_estado
        );
      END IF;
    END LOOP;
  END IF;

  IF (new.nombre IS DISTINCT FROM old.nombre) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'nombre', to_jsonb(old.nombre), to_jsonb(new.nombre), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.tipo_ciclo IS DISTINCT FROM old.tipo_ciclo) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'tipo_ciclo', to_jsonb(old.tipo_ciclo), to_jsonb(new.tipo_ciclo), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.numero_ciclos IS DISTINCT FROM old.numero_ciclos) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'numero_ciclos', to_jsonb(old.numero_ciclos), to_jsonb(new.numero_ciclos), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.activo IS DISTINCT FROM old.activo) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'activo', to_jsonb(old.activo), to_jsonb(new.activo), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.carrera_id IS DISTINCT FROM old.carrera_id) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'carrera_id', to_jsonb(old.carrera_id), to_jsonb(new.carrera_id), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.estructura_id IS DISTINCT FROM old.estructura_id) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'estructura_id', to_jsonb(old.estructura_id), to_jsonb(new.estructura_id), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF (new.tipo_origen IS DISTINCT FROM old.tipo_origen) THEN
    INSERT INTO public.cambios_plan (plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, response_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_actor, 'ACTUALIZACION'::public.tipo_cambio, 'tipo_origen', to_jsonb(old.tipo_origen), to_jsonb(new.tipo_origen), NULL, v_override, v_motivo, v_estado);
  END IF;

  IF v_response_id IS NOT NULL THEN
    new.meta_origen := new.meta_origen - 'response_id';
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_track_cambios_asignatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
  old_val jsonb;
  new_val jsonb;
  v_interaccion_id uuid := NULL;
  v_usuario uuid;
  v_fuente public.fuente_cambio := 'HUMANO'::public.fuente_cambio;
  v_plan_id uuid;
  v_override boolean := false;
  v_motivo text := NULL;
  v_estado text := NULL;
BEGIN
  IF tg_op = 'DELETE' THEN
    v_usuario := old.actualizado_por;
    v_plan_id := old.plan_estudio_id;
  ELSE
    v_interaccion_id := nullif(new.meta_origen->>'interaccion_ia_id', '')::uuid;
    v_usuario := CASE WHEN tg_op = 'INSERT' THEN new.creado_por ELSE new.actualizado_por END;
    v_fuente := CASE WHEN v_interaccion_id IS NULL THEN 'HUMANO'::public.fuente_cambio ELSE 'IA'::public.fuente_cambio END;
    v_plan_id := new.plan_estudio_id;
  END IF;

  SELECT a.admin_override, a.motivo, a.estado_clave
  INTO v_override, v_motivo, v_estado
  FROM public.authz_admin_override_audit(v_plan_id) a;

  IF tg_op = 'INSERT' THEN
    INSERT INTO public.cambios_asignatura (
      asignatura_id, cambiado_por, tipo, valor_nuevo, fuente, interaccion_ia_id,
      admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      new.id, v_usuario, 'CREACION'::public.tipo_cambio, to_jsonb(new), v_fuente, v_interaccion_id,
      v_override, v_motivo, v_estado
    );

    IF v_interaccion_id IS NOT NULL THEN
      new.meta_origen := new.meta_origen - 'interaccion_ia_id';
    END IF;

    RETURN new;
  END IF;

  IF tg_op = 'DELETE' THEN
    INSERT INTO public.cambios_asignatura (
      asignatura_id, cambiado_por, tipo, campo, valor_anterior, fuente,
      admin_override, admin_override_motivo, admin_override_estado_clave
    )
    VALUES (
      old.id, v_usuario, 'OTRO'::public.tipo_cambio, 'DELETE', to_jsonb(old), 'HUMANO'::public.fuente_cambio,
      v_override, v_motivo, v_estado
    );

    RETURN old;
  END IF;

  IF (new.plan_estudio_id IS DISTINCT FROM old.plan_estudio_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'plan_estudio_id', to_jsonb(old.plan_estudio_id), to_jsonb(new.plan_estudio_id), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.numero_ciclo IS DISTINCT FROM old.numero_ciclo) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'numero_ciclo', to_jsonb(old.numero_ciclo), to_jsonb(new.numero_ciclo), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.linea_plan_id IS DISTINCT FROM old.linea_plan_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'linea_plan_id', to_jsonb(old.linea_plan_id), to_jsonb(new.linea_plan_id), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.orden_celda IS DISTINCT FROM old.orden_celda) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'orden_celda', to_jsonb(old.orden_celda), to_jsonb(new.orden_celda), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.prerrequisito_asignatura_id IS DISTINCT FROM old.prerrequisito_asignatura_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION_MAPA', 'prerrequisito_asignatura_id', to_jsonb(old.prerrequisito_asignatura_id), to_jsonb(new.prerrequisito_asignatura_id), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.nombre IS DISTINCT FROM old.nombre) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'nombre', to_jsonb(old.nombre), to_jsonb(new.nombre), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.codigo IS DISTINCT FROM old.codigo) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'codigo', to_jsonb(old.codigo), to_jsonb(new.codigo), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.tipo IS DISTINCT FROM old.tipo) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'tipo', to_jsonb(old.tipo), to_jsonb(new.tipo), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.estructura_id IS DISTINCT FROM old.estructura_id) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'estructura_id', to_jsonb(old.estructura_id), to_jsonb(new.estructura_id), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.creditos IS DISTINCT FROM old.creditos) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'creditos', to_jsonb(old.creditos), to_jsonb(new.creditos), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.horas_academicas IS DISTINCT FROM old.horas_academicas) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'horas_academicas', to_jsonb(old.horas_academicas), to_jsonb(new.horas_academicas), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.horas_independientes IS DISTINCT FROM old.horas_independientes) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'horas_independientes', to_jsonb(old.horas_independientes), to_jsonb(new.horas_independientes), v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.datos IS DISTINCT FROM old.datos) THEN
    FOR k IN
      SELECT DISTINCT key FROM (
        SELECT jsonb_object_keys(coalesce(old.datos, '{}'::jsonb)) AS key
        UNION ALL
        SELECT jsonb_object_keys(coalesce(new.datos, '{}'::jsonb)) AS key
      ) t
    LOOP
      old_val := coalesce(old.datos, '{}'::jsonb) -> k;
      new_val := coalesce(new.datos, '{}'::jsonb) -> k;

      IF (old_val IS DISTINCT FROM new_val) THEN
        INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
        VALUES (new.id, v_usuario, 'ACTUALIZACION_CAMPO', k, old_val, new_val, v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
      END IF;
    END LOOP;
  END IF;

  IF (new.criterios_de_evaluacion IS DISTINCT FROM old.criterios_de_evaluacion) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'criterios_de_evaluacion', old.criterios_de_evaluacion, new.criterios_de_evaluacion, v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF (new.contenido_tematico IS DISTINCT FROM old.contenido_tematico) THEN
    INSERT INTO public.cambios_asignatura (asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente, interaccion_ia_id, admin_override, admin_override_motivo, admin_override_estado_clave)
    VALUES (new.id, v_usuario, 'ACTUALIZACION', 'contenido_tematico', old.contenido_tematico, new.contenido_tematico, v_fuente, v_interaccion_id, v_override, v_motivo, v_estado);
  END IF;

  IF v_interaccion_id IS NOT NULL THEN
    new.meta_origen := new.meta_origen - 'interaccion_ia_id';
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_log_lineas_plan_cambios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_actor uuid;
  v_override boolean := false;
  v_motivo text := NULL;
  v_estado text := NULL;
BEGIN
  v_plan_id := CASE WHEN tg_op = 'DELETE' THEN old.plan_estudio_id ELSE new.plan_estudio_id END;
  v_actor := CASE
    WHEN tg_op = 'INSERT' THEN new.creado_por
    WHEN tg_op = 'DELETE' THEN old.actualizado_por
    ELSE new.actualizado_por
  END;

  SELECT a.admin_override, a.motivo, a.estado_clave
  INTO v_override, v_motivo, v_estado
  FROM public.authz_admin_override_audit(v_plan_id) a;

  INSERT INTO public.cambios_plan (
    plan_estudio_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo,
    admin_override, admin_override_motivo, admin_override_estado_clave
  )
  VALUES (
    v_plan_id,
    v_actor,
    CASE WHEN tg_op = 'INSERT' THEN 'CREACION'::public.tipo_cambio
         WHEN tg_op = 'DELETE' THEN 'OTRO'::public.tipo_cambio
         ELSE 'ACTUALIZACION_MAPA'::public.tipo_cambio END,
    'lineas_plan',
    CASE WHEN tg_op = 'INSERT' THEN NULL ELSE to_jsonb(old) END,
    CASE WHEN tg_op = 'DELETE' THEN NULL ELSE to_jsonb(new) END,
    v_override,
    v_motivo,
    v_estado
  );

  RETURN CASE WHEN tg_op = 'DELETE' THEN old ELSE new END;
END;
$$;

DROP TRIGGER IF EXISTS trg_lineas_plan_log_cambios ON public.lineas_plan;
CREATE TRIGGER trg_lineas_plan_log_cambios
  AFTER INSERT OR UPDATE OR DELETE ON public.lineas_plan
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_lineas_plan_cambios();

CREATE OR REPLACE FUNCTION public.fn_log_bibliografia_asignatura_cambios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asignatura_id uuid;
  v_plan_id uuid;
  v_actor uuid;
  v_override boolean := false;
  v_motivo text := NULL;
  v_estado text := NULL;
BEGIN
  v_asignatura_id := CASE WHEN tg_op = 'DELETE' THEN old.asignatura_id ELSE new.asignatura_id END;
  SELECT plan_estudio_id INTO v_plan_id FROM public.asignaturas WHERE id = v_asignatura_id;
  v_actor := CASE
    WHEN tg_op = 'INSERT' THEN new.creado_por
    WHEN tg_op = 'DELETE' THEN old.creado_por
    ELSE auth.uid()
  END;

  SELECT a.admin_override, a.motivo, a.estado_clave
  INTO v_override, v_motivo, v_estado
  FROM public.authz_admin_override_audit(v_plan_id) a;

  INSERT INTO public.cambios_asignatura (
    asignatura_id, cambiado_por, tipo, campo, valor_anterior, valor_nuevo, fuente,
    admin_override, admin_override_motivo, admin_override_estado_clave
  )
  VALUES (
    v_asignatura_id,
    v_actor,
    CASE WHEN tg_op = 'INSERT' THEN 'CREACION'::public.tipo_cambio
         WHEN tg_op = 'DELETE' THEN 'OTRO'::public.tipo_cambio
         ELSE 'ACTUALIZACION'::public.tipo_cambio END,
    'bibliografia_asignatura',
    CASE WHEN tg_op = 'INSERT' THEN NULL ELSE to_jsonb(old) END,
    CASE WHEN tg_op = 'DELETE' THEN NULL ELSE to_jsonb(new) END,
    'HUMANO'::public.fuente_cambio,
    v_override,
    v_motivo,
    v_estado
  );

  RETURN CASE WHEN tg_op = 'DELETE' THEN old ELSE new END;
END;
$$;

DROP TRIGGER IF EXISTS trg_bibliografia_asignatura_log_cambios ON public.bibliografia_asignatura;
CREATE TRIGGER trg_bibliografia_asignatura_log_cambios
  AFTER INSERT OR UPDATE OR DELETE ON public.bibliografia_asignatura
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_bibliografia_asignatura_cambios();

-- ────────────────────────────────────────────────────────────────────────────
-- 5) RLS contextual
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS planes_estudio_update_by_scope ON public.planes_estudio;
DROP POLICY IF EXISTS planes_estudio_delete_by_scope ON public.planes_estudio;
DROP POLICY IF EXISTS lineas_plan_manage_by_scope ON public.lineas_plan;
DROP POLICY IF EXISTS asignaturas_manage_by_scope ON public.asignaturas;
DROP POLICY IF EXISTS bibliografia_asignatura_manage_by_scope ON public.bibliografia_asignatura;
DROP POLICY IF EXISTS responsables_asignatura_manage_by_scope ON public.responsables_asignatura;
DROP POLICY IF EXISTS conversaciones_plan_manage_by_scope ON public.conversaciones_plan;
DROP POLICY IF EXISTS conversaciones_asignatura_manage_by_scope ON public.conversaciones_asignatura;
DROP POLICY IF EXISTS plan_mensajes_ia_manage_by_scope ON public.plan_mensajes_ia;
DROP POLICY IF EXISTS asignatura_mensajes_ia_manage_by_scope ON public.asignatura_mensajes_ia;
DROP POLICY IF EXISTS interacciones_ia_manage_own ON public.interacciones_ia;
DROP POLICY IF EXISTS comentarios_plan_insert_by_scope ON public.comentarios_plan;
DROP POLICY IF EXISTS comentarios_asignatura_insert_by_scope ON public.comentarios_asignatura;
DROP POLICY IF EXISTS plan_expertos_manage_by_scope ON public.plan_expertos;
DROP POLICY IF EXISTS expertos_manage_by_permission ON public.expertos;

CREATE POLICY planes_estudio_update_by_scope ON public.planes_estudio
  FOR UPDATE TO authenticated
  USING (public.authz_plan_write_allowed(id))
  WITH CHECK (public.authz_plan_write_allowed(id));

CREATE POLICY planes_estudio_delete_by_scope ON public.planes_estudio
  FOR DELETE TO authenticated
  USING (public.authz_plan_write_allowed(id));

CREATE POLICY lineas_plan_manage_by_scope ON public.lineas_plan
  FOR ALL TO authenticated
  USING (public.authz_plan_write_allowed(plan_estudio_id))
  WITH CHECK (public.authz_plan_write_allowed(plan_estudio_id));

CREATE POLICY asignaturas_manage_by_scope ON public.asignaturas
  FOR ALL TO authenticated
  USING (
    public.authz_plan_write_allowed(plan_estudio_id)
    OR public.authz_asignatura_write_allowed(id)
  )
  WITH CHECK (
    public.authz_plan_write_allowed(plan_estudio_id)
    OR public.authz_asignatura_write_allowed(id)
  );

CREATE POLICY bibliografia_asignatura_manage_by_scope ON public.bibliografia_asignatura
  FOR ALL TO authenticated
  USING (public.authz_asignatura_write_allowed(asignatura_id))
  WITH CHECK (public.authz_asignatura_write_allowed(asignatura_id));

CREATE POLICY responsables_asignatura_manage_by_scope ON public.responsables_asignatura
  FOR ALL TO authenticated
  USING (public.authz_asignatura_write_allowed(asignatura_id))
  WITH CHECK (public.authz_asignatura_write_allowed(asignatura_id));

CREATE POLICY conversaciones_plan_manage_by_scope ON public.conversaciones_plan
  FOR ALL TO authenticated
  USING (public.authz_plan_ia_allowed(plan_estudio_id))
  WITH CHECK (public.authz_plan_ia_allowed(plan_estudio_id));

CREATE POLICY conversaciones_asignatura_manage_by_scope ON public.conversaciones_asignatura
  FOR ALL TO authenticated
  USING (public.authz_asignatura_ia_allowed(asignatura_id))
  WITH CHECK (public.authz_asignatura_ia_allowed(asignatura_id));

CREATE POLICY plan_mensajes_ia_manage_by_scope ON public.plan_mensajes_ia
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversaciones_plan c
      WHERE c.id = conversacion_plan_id
        AND public.authz_plan_ia_allowed(c.plan_estudio_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversaciones_plan c
      WHERE c.id = conversacion_plan_id
        AND public.authz_plan_ia_allowed(c.plan_estudio_id)
    )
  );

CREATE POLICY asignatura_mensajes_ia_manage_by_scope ON public.asignatura_mensajes_ia
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversaciones_asignatura c
      WHERE c.id = conversacion_asignatura_id
        AND public.authz_asignatura_ia_allowed(c.asignatura_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversaciones_asignatura c
      WHERE c.id = conversacion_asignatura_id
        AND public.authz_asignatura_ia_allowed(c.asignatura_id)
    )
  );

CREATE POLICY interacciones_ia_manage_own ON public.interacciones_ia
  FOR ALL TO authenticated
  USING (
    usuario_id = auth.uid()
    AND (plan_estudio_id IS NULL OR public.authz_plan_ia_allowed(plan_estudio_id))
    AND (asignatura_id IS NULL OR public.authz_asignatura_ia_allowed(asignatura_id))
  )
  WITH CHECK (
    usuario_id = auth.uid()
    AND (plan_estudio_id IS NULL OR public.authz_plan_ia_allowed(plan_estudio_id))
    AND (asignatura_id IS NULL OR public.authz_asignatura_ia_allowed(asignatura_id))
  );

CREATE POLICY comentarios_plan_insert_by_scope ON public.comentarios_plan
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND public.usuario_puede_comentar_plan(auth.uid(), plan_estudio_id)
  );

CREATE POLICY comentarios_asignatura_insert_by_scope ON public.comentarios_asignatura
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND public.usuario_puede_comentar_asignatura(auth.uid(), asignatura_id)
  );

CREATE POLICY expertos_manage_by_permission ON public.expertos
  FOR ALL TO authenticated
  USING (public.authz_has_permission('expertos.gestionar'))
  WITH CHECK (public.authz_has_permission('expertos.gestionar'));

CREATE POLICY plan_expertos_manage_by_scope ON public.plan_expertos
  FOR ALL TO authenticated
  USING (
    public.authz_has_permission('expertos.gestionar')
    AND public.authz_can_access_plan(plan_estudio_id)
    AND public.plan_estado_clave(plan_estudio_id) IN ('CONSULTA_EXPERTOS', 'REV_SEDES')
  )
  WITH CHECK (
    public.authz_has_permission('expertos.gestionar')
    AND public.authz_can_access_plan(plan_estudio_id)
    AND public.plan_estado_clave(plan_estudio_id) IN ('CONSULTA_EXPERTOS', 'REV_SEDES')
  );
