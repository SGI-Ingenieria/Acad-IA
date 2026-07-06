BEGIN;

SELECT plan(36);

SELECT ok(
  EXISTS (SELECT 1 FROM public.permisos WHERE clave = 'ia.usar'),
  'ia.usar permission exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE r.clave = 'JEFE_CARRERA'
      AND p.clave = 'planes.aprobar'
  ),
  'JEFE_CARRERA can submit plan transitions from BORRADOR'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE r.clave = 'DIRECTOR_FACULTAD'
      AND p.clave IN ('planes.editar', 'asignaturas.editar')
  ),
  'DIRECTOR_FACULTAD does not keep broad content edit permissions'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE r.clave = 'PLANEACION_CURRICULAR'
      AND p.clave = 'planes.editar'
  ),
  'PLANEACION_CURRICULAR does not keep broad plan edit permission'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE r.clave = 'PROFESOR'
      AND p.clave = 'asignaturas.editar'
  ),
  'PROFESOR does not keep broad subject edit permission'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM unnest(ARRAY[
      'authz_admin_override_audit',
      'authz_admin_override_reason',
      'authz_asignatura_ia_allowed',
      'authz_asignatura_write_allowed',
      'authz_plan_ia_allowed',
      'authz_plan_write_allowed',
      'plan_estado_clave',
      'usuario_puede_comentar_asignatura',
      'usuario_puede_comentar_plan',
      'usuario_puede_editar_asignatura',
      'usuario_puede_editar_plan',
      'usuario_puede_usar_ia_asignatura',
      'usuario_puede_usar_ia_plan'
    ]) AS fn(proname)
    WHERE EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn.proname
    )
  ),
  13,
  'plan stage authorization helper functions exist'
);

SELECT has_column('public', 'cambios_plan', 'admin_override', 'cambios_plan tracks admin_override');
SELECT has_column('public', 'cambios_plan', 'admin_override_motivo', 'cambios_plan tracks admin_override_motivo');
SELECT has_column('public', 'cambios_plan', 'admin_override_estado_clave', 'cambios_plan tracks admin_override_estado_clave');
SELECT has_column('public', 'cambios_asignatura', 'admin_override', 'cambios_asignatura tracks admin_override');
SELECT has_column('public', 'cambios_asignatura', 'admin_override_motivo', 'cambios_asignatura tracks admin_override_motivo');
SELECT has_column('public', 'cambios_asignatura', 'admin_override_estado_clave', 'cambios_asignatura tracks admin_override_estado_clave');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'planes_estudio'
      AND policyname = 'planes_estudio_update_by_scope'
      AND coalesce(with_check, '') LIKE '%authz_plan_write_allowed%'
  ),
  'planes_estudio updates use contextual write authorization'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'asignaturas'
      AND policyname = 'asignaturas_update_by_scope'
      AND coalesce(with_check, '') LIKE '%authz_asignatura_content_write_allowed%'
  ),
  'asignaturas writes use contextual content authorization'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lineas_plan'
      AND policyname = 'lineas_plan_update_by_scope'
      AND coalesce(with_check, '') LIKE '%authz_plan_write_allowed%'
  ),
  'lineas_plan writes use plan write authorization'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bibliografia_asignatura'
      AND policyname = 'bibliografia_asignatura_update_by_scope'
      AND coalesce(with_check, '') LIKE '%authz_asignatura_content_write_allowed%'
  ),
  'bibliografia_asignatura writes use subject content authorization'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'responsables_asignatura'
      AND policyname = 'responsables_asignatura_update_by_scope'
      AND coalesce(with_check, '') LIKE '%authz_asignatura_write_allowed%'
  ),
  'responsables_asignatura writes use subject write authorization'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (tablename = 'plan_mensajes_ia' AND policyname = 'plan_mensajes_ia_update_by_scope'
          AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%authz_plan_ia_allowed%')
        OR
        (tablename = 'asignatura_mensajes_ia' AND policyname = 'asignatura_mensajes_ia_update_by_scope'
          AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%authz_asignatura_ia_allowed%')
      )
  ),
  2,
  'IA message policies use IA-stage authorization'
);

WITH expected(desde, hacia, rol) AS (
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
),
actual AS (
  SELECT d.clave AS desde, h.clave AS hacia, r.clave AS rol
  FROM public.transiciones_estado_plan t
  JOIN public.estados_plan d ON d.id = t.desde_estado_id
  JOIN public.estados_plan h ON h.id = t.hacia_estado_id
  JOIN public.roles r ON r.id = t.rol_permitido_id
  WHERE t.tipo_estructura = 'CURRICULAR'
)
SELECT is(
  (
    SELECT count(*)::integer
    FROM expected e
    LEFT JOIN actual a USING (desde, hacia, rol)
    WHERE a.desde IS NULL
  ),
  0,
  'all expected curricular transitions exist'
);

WITH expected(desde, hacia, rol) AS (
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
),
actual AS (
  SELECT d.clave AS desde, h.clave AS hacia, r.clave AS rol
  FROM public.transiciones_estado_plan t
  JOIN public.estados_plan d ON d.id = t.desde_estado_id
  JOIN public.estados_plan h ON h.id = t.hacia_estado_id
  JOIN public.roles r ON r.id = t.rol_permitido_id
  WHERE t.tipo_estructura = 'CURRICULAR'
)
SELECT is(
  (
    SELECT count(*)::integer
    FROM actual a
    LEFT JOIN expected e USING (desde, hacia, rol)
    WHERE e.desde IS NULL
  ),
  0,
  'no unexpected curricular transitions remain'
);

WITH expected(desde, hacia, rol) AS (
  VALUES
    ('BORRADOR', 'REV_PLANEACION', 'JEFE_CARRERA'),
    ('REV_PLANEACION', 'REV_VICERRECTORIA', 'PLANEACION_CURRICULAR'),
    ('REV_PLANEACION', 'BORRADOR', 'PLANEACION_CURRICULAR'),
    ('REV_PLANEACION', 'RECHAZADO', 'PLANEACION_CURRICULAR'),
    ('REV_VICERRECTORIA', 'APROBADO', 'VICERRECTOR_ACADEMICO'),
    ('REV_VICERRECTORIA', 'BORRADOR', 'VICERRECTOR_ACADEMICO'),
    ('REV_VICERRECTORIA', 'RECHAZADO', 'VICERRECTOR_ACADEMICO')
),
actual AS (
  SELECT d.clave AS desde, h.clave AS hacia, r.clave AS rol
  FROM public.transiciones_estado_plan t
  JOIN public.estados_plan d ON d.id = t.desde_estado_id
  JOIN public.estados_plan h ON h.id = t.hacia_estado_id
  JOIN public.roles r ON r.id = t.rol_permitido_id
  WHERE t.tipo_estructura = 'NO_CURRICULAR'
)
SELECT is(
  (
    SELECT count(*)::integer
    FROM expected e
    LEFT JOIN actual a USING (desde, hacia, rol)
    WHERE a.desde IS NULL
  ),
  0,
  'all expected non-curricular transitions exist'
);

WITH actual AS (
  SELECT d.clave AS desde, h.clave AS hacia, r.clave AS rol
  FROM public.transiciones_estado_plan t
  JOIN public.estados_plan d ON d.id = t.desde_estado_id
  JOIN public.estados_plan h ON h.id = t.hacia_estado_id
  JOIN public.roles r ON r.id = t.rol_permitido_id
  WHERE t.tipo_estructura = 'NO_CURRICULAR'
)
SELECT is(
  (
    SELECT count(*)::integer
    FROM actual a
  ),
  7,
  'no unexpected non-curricular transitions remain'
);

SELECT is(
  (SELECT count(*)::integer FROM public.transiciones_estado_plan),
  32,
  'state machine has exactly 32 contextual transitions'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.transiciones_estado_plan t
    JOIN public.estados_plan d ON d.id = t.desde_estado_id
    WHERE d.clave = 'REV_PLANEACION'
  ),
  5,
  'REV_PLANEACION has curricular and non-curricular outgoing transitions'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.transiciones_estado_plan t
    JOIN public.estados_plan d ON d.id = t.desde_estado_id
    JOIN public.estados_plan h ON h.id = t.hacia_estado_id
    JOIN public.roles r ON r.id = t.rol_permitido_id
    WHERE d.clave = 'BORRADOR'
      AND h.clave = 'REVISION'
      AND r.clave = 'JEFE_CARRERA'
  ),
  1,
  'BORRADOR can be advanced only by JEFE_CARRERA'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.transiciones_estado_plan t
    JOIN public.estados_plan d ON d.id = t.desde_estado_id
    JOIN public.estados_plan h ON h.id = t.hacia_estado_id
    JOIN public.roles r ON r.id = t.rol_permitido_id
    WHERE d.clave = 'REVISION'
      AND h.clave = 'REV_PLANEACION'
      AND r.clave = 'SECRETARIO_ACADEMICO'
  ),
  1,
  'REVISION advances to REV_PLANEACION by SECRETARIO_ACADEMICO'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.transiciones_estado_plan t
    JOIN public.estados_plan d ON d.id = t.desde_estado_id
    JOIN public.estados_plan h ON h.id = t.hacia_estado_id
    JOIN public.roles r ON r.id = t.rol_permitido_id
    WHERE d.clave = 'REV_PLANEACION'
      AND h.clave = 'CONSULTA_EXPERTOS'
      AND r.clave = 'PLANEACION_CURRICULAR'
  ),
  1,
  'REV_PLANEACION advances by PLANEACION_CURRICULAR'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.transiciones_estado_plan t
    JOIN public.estados_plan d ON d.id = t.desde_estado_id
    JOIN public.estados_plan h ON h.id = t.hacia_estado_id
    JOIN public.roles r ON r.id = t.rol_permitido_id
    WHERE d.clave = 'CONSULTA_EXPERTOS'
      AND h.clave = 'REV_SEDES'
      AND r.clave IN ('DIRECTOR_FACULTAD', 'SECRETARIO_ACADEMICO')
  ),
  2,
  'CONSULTA_EXPERTOS can advance by director or secretary'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.transiciones_estado_plan t
    JOIN public.estados_plan d ON d.id = t.desde_estado_id
    JOIN public.estados_plan h ON h.id = t.hacia_estado_id
    JOIN public.roles r ON r.id = t.rol_permitido_id
    WHERE d.clave = 'CONSEJO_FACULTAD'
      AND h.clave = 'CONSEJO_UNIVERSITARIO'
      AND r.clave = 'DIRECTOR_FACULTAD'
  ),
  1,
  'CONSEJO_FACULTAD advances by DIRECTOR_FACULTAD'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.transiciones_estado_plan t
    JOIN public.estados_plan d ON d.id = t.desde_estado_id
    JOIN public.estados_plan h ON h.id = t.hacia_estado_id
    JOIN public.roles r ON r.id = t.rol_permitido_id
    WHERE (d.clave, h.clave) IN (
      ('CONSEJO_UNIVERSITARIO', 'JUNTA_GOBIERNO'),
      ('JUNTA_GOBIERNO', 'ENVIADO_SEP')
    )
      AND r.clave = 'VICERRECTOR_ACADEMICO'
  ),
  2,
  'institutional final stages advance by VICERRECTOR_ACADEMICO'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.transiciones_estado_plan t
    JOIN public.estados_plan d ON d.id = t.desde_estado_id
    JOIN public.estados_plan h ON h.id = t.hacia_estado_id
    JOIN public.roles r ON r.id = t.rol_permitido_id
    WHERE d.clave = 'ENVIADO_SEP'
      AND h.clave = 'APROBADO'
      AND r.clave = 'PLANEACION_CURRICULAR'
  ),
  1,
  'ACERT approval is completed by PLANEACION_CURRICULAR'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE r.clave IN ('DIRECTOR_FACULTAD', 'PLANEACION_CURRICULAR', 'PROFESOR', 'COORD_DHP')
      AND p.clave IN ('planes.editar', 'asignaturas.editar')
  ),
  0,
  'non-editor review roles do not have broad content edit grants'
);

SELECT ok(
  pg_get_functiondef('public.usuario_puede_usar_ia_plan(uuid,uuid)'::regprocedure)
    LIKE '%plan_estado_clave(p_plan_id) IN (''BORRADOR'', ''REVISION'')%',
  'IA is restricted to BORRADOR and REVISION'
);

SELECT ok(
  pg_get_functiondef('public.authz_admin_override_audit(uuid)'::regprocedure)
    LIKE '%authz_admin_override_reason()%',
  'admin override audit requires an override reason'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.lineas_plan'::regclass
      AND tgname = 'trg_lineas_plan_log_cambios'
  ),
  'lineas_plan changes are audited'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.bibliografia_asignatura'::regclass
      AND tgname = 'trg_bibliografia_asignatura_log_cambios'
  ),
  'bibliografia_asignatura changes are audited'
);

SELECT * FROM finish();

ROLLBACK;
