BEGIN;

SELECT plan(31);

SELECT has_table('public', 'roles', 'roles table exists');
SELECT has_table('public', 'permisos', 'permisos table exists');
SELECT has_table('public', 'roles_permisos', 'roles_permisos table exists');
SELECT has_table('public', 'estados_plan', 'estados_plan table exists');

SELECT has_column('public', 'roles', 'clave', 'roles.clave exists');
SELECT has_column('public', 'permisos', 'clave', 'permisos.clave exists');
SELECT has_column('public', 'roles_permisos', 'rol_id', 'roles_permisos.rol_id exists');
SELECT has_column('public', 'roles_permisos', 'permiso_id', 'roles_permisos.permiso_id exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.roles'::regclass),
  'roles has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.permisos'::regclass),
  'permisos has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.roles_permisos'::regclass),
  'roles_permisos has RLS enabled'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM (
      SELECT clave
      FROM public.roles
      GROUP BY clave
      HAVING count(*) > 1
    ) duplicates
  ),
  0,
  'roles.clave has no duplicates'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM (
      SELECT clave
      FROM public.permisos
      GROUP BY clave
      HAVING count(*) > 1
    ) duplicates
  ),
  0,
  'permisos.clave has no duplicates'
);
SELECT is(
  (SELECT count(*)::integer FROM public.roles WHERE clave = 'ADMIN'),
  1,
  'ADMIN role exists exactly once'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.permisos WHERE clave = 'planes.ver'),
  'planes.ver permission exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.permisos WHERE clave = 'usuarios.gestionar'),
  'usuarios.gestionar permission exists'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE r.clave = 'ADMIN'
      AND p.clave = 'usuarios.gestionar'
  ),
  'ADMIN can manage users'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE r.clave = 'PROFESOR'
      AND p.clave = 'asignaturas.ver'
  ),
  'PROFESOR can view assigned subjects'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE r.clave = 'SECRETARIO_ACADEMICO'
      AND p.clave = 'planes.crear'
  ),
  'SECRETARIO_ACADEMICO can create plans in its assigned faculty scope'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE r.clave = 'JEFE_CARRERA'
      AND p.clave = 'catalogos.gestionar'
  ),
  'JEFE_CARRERA cannot manage the global faculty catalog'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE r.clave = 'SECRETARIO_ACADEMICO'
      AND p.clave = 'catalogos.gestionar'
  ),
  'SECRETARIO_ACADEMICO cannot manage the global faculty catalog'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'custom_access_token_hook'
  ),
  'custom_access_token_hook exists'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'authz_has_permission'
  ),
  'authz_has_permission exists'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'usuario_tiene_permiso'
  ),
  'usuario_tiene_permiso exists'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.estados_plan WHERE clave = 'BORRADOR'),
  'BORRADOR state exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.estados_plan WHERE clave = 'REVISION'),
  'REVISION state exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.estados_plan WHERE clave = 'APROBADO'),
  'APROBADO state exists'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM (
      VALUES
        ('ADMIN'),
        ('VICERRECTOR_ACADEMICO'),
        ('DIRECTOR_FACULTAD'),
        ('SECRETARIO_ACADEMICO'),
        ('PLANEACION_CURRICULAR'),
        ('JEFE_CARRERA'),
        ('JEFE_POSGRADO'),
        ('COORD_DHP'),
        ('PROFESOR'),
        ('EVALUADOR_EXTERNO')
    ) expected(clave)
    LEFT JOIN public.roles actual USING (clave)
    WHERE actual.id IS NULL
  ),
  0,
  'canonical role catalog is complete'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM (
      VALUES
        ('archivos.ver'),
        ('archivos.gestionar'),
        ('asignaturas.ver'),
        ('asignaturas.editar'),
        ('asignaturas.recursos.generar'),
        ('asignaturas.recursos.gestionar'),
        ('asignaturas.responsables.gestionar'),
        ('asignaturas.aprobar'),
        ('auditoria.ver'),
        ('catalogos.gestionar'),
        ('ia.usar'),
        ('planes.ver'),
        ('planes.crear'),
        ('planes.editar'),
        ('planes.enviar_revision'),
        ('planes.aprobar'),
        ('planes.campos_restringidos.editar'),
        ('comentarios.externos.crear'),
        ('comentarios.crear'),
        ('expertos.gestionar'),
        ('usuarios.ver'),
        ('usuarios.gestionar'),
        ('usuarios.roles.gestionar')
    ) expected(clave)
    LEFT JOIN public.permisos actual USING (clave)
    WHERE actual.id IS NULL
  ),
  0,
  'canonical permission catalog is complete'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM (
      VALUES
        ('FALLIDO'),
        ('GENERANDO'),
        ('BORRADOR'),
        ('REVISION'),
        ('REV_PLANEACION'),
        ('REV_VICERRECTORIA'),
        ('CONSULTA_EXPERTOS'),
        ('REV_SEDES'),
        ('CONSEJO_FACULTAD'),
        ('CONSEJO_UNIVERSITARIO'),
        ('JUNTA_GOBIERNO'),
        ('ENVIADO_SEP'),
        ('APROBADO'),
        ('RECHAZADO')
    ) expected(clave)
    LEFT JOIN public.estados_plan actual USING (clave)
    WHERE actual.id IS NULL
  ),
  0,
  'canonical academic workflow states are complete'
);

SELECT cmp_ok(
  (
    SELECT count(*)::integer
    FROM public.transiciones_estado_plan
    WHERE tipo_estructura IS NOT NULL
  ),
  '>=',
  32,
  'typed academic workflow transitions are restored'
);

SELECT * FROM finish();

ROLLBACK;
