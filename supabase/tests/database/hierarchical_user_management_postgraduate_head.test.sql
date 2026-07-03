BEGIN;

SELECT plan(16);

SELECT is(
  (
    SELECT nivel_jerarquico
    FROM public.roles
    WHERE clave = 'JEFE_POSGRADO'
  ),
  40,
  'JEFE_POSGRADO has jefe-level hierarchy'
);

SELECT is(
  (
    SELECT alcance_default
    FROM public.roles
    WHERE clave = 'JEFE_POSGRADO'
  ),
  'facultad',
  'JEFE_POSGRADO is scoped by facultad'
);

SELECT ok(
  public.nivel_es_posgrado('Maestría')
    AND public.nivel_es_posgrado('Maestria')
    AND public.nivel_es_posgrado('Doctorado')
    AND public.nivel_es_posgrado('Especialidad')
    AND NOT public.nivel_es_posgrado('Licenciatura')
    AND NOT public.nivel_es_posgrado('Diplomado')
    AND NOT public.nivel_es_posgrado('Otro'),
  'postgraduate level helper matches only maestria/doctorado/especialidad'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE p.clave = 'usuarios.gestionar'
      AND r.clave IN (
        'VICERRECTOR_ACADEMICO',
        'DIRECTOR_FACULTAD',
        'SECRETARIO_ACADEMICO',
        'JEFE_CARRERA',
        'JEFE_POSGRADO'
      )
  ),
  5,
  'hierarchical roles can manage users'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE p.clave = 'usuarios.roles.gestionar'
      AND r.clave IN (
        'VICERRECTOR_ACADEMICO',
        'DIRECTOR_FACULTAD',
        'SECRETARIO_ACADEMICO'
      )
  ),
  3,
  'only vicerrectoria/director/secretaria manage formal role assignments'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.roles_permisos rp
    JOIN public.roles r ON r.id = rp.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE p.clave = 'usuarios.roles.gestionar'
      AND r.clave IN ('JEFE_CARRERA', 'JEFE_POSGRADO')
  ),
  'jefaturas do not manage formal role assignments'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM (
      SELECT p.clave
      FROM public.roles_permisos rp
      JOIN public.roles r ON r.id = rp.rol_id
      JOIN public.permisos p ON p.id = rp.permiso_id
      WHERE r.clave = 'JEFE_CARRERA'
        AND p.clave <> 'usuarios.roles.gestionar'
      EXCEPT
      SELECT p.clave
      FROM public.roles_permisos rp
      JOIN public.roles r ON r.id = rp.rol_id
      JOIN public.permisos p ON p.id = rp.permiso_id
      WHERE r.clave = 'JEFE_POSGRADO'
    ) missing
  ),
  0,
  'JEFE_POSGRADO has JEFE_CARRERA academic permissions'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'usuario_puede_gestionar_usuario'
  ),
  'public usuario_puede_gestionar_usuario helper exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'usuario_puede_gestionar_rol'
  ),
  'public usuario_puede_gestionar_rol helper exists'
);

SELECT ok(
  pg_get_functiondef(
    'private.usuario_es_jefe_encargado_plan(uuid, uuid)'::regprocedure
  ) LIKE '%usuario_es_jefe_posgrado_encargado_plan%',
  'contextual jefe helper includes JEFE_POSGRADO'
);

SELECT ok(
  pg_get_functiondef(
    'private.usuario_puede_acceder_plan(uuid, uuid)'::regprocedure
  ) LIKE '%nivel_es_posgrado%',
  'plan access helper restricts JEFE_POSGRADO by postgraduate level'
);

SELECT ok(
  pg_get_functiondef(
    'public.usuario_tiene_rol_contextual_plan(uuid, uuid, text)'::regprocedure
  ) LIKE '%JEFE_POSGRADO%',
  'contextual role wrapper recognizes JEFE_POSGRADO'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'usuarios_roles'
      AND policyname = 'usuarios_roles_insert_by_hierarchy'
      AND coalesce(with_check, '') LIKE '%usuario_puede_gestionar_rol%'
  ),
  'usuarios_roles inserts use hierarchical role management'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'usuarios_app'
      AND policyname = 'usuarios_app_update_own_or_manage'
      AND coalesce(qual, '') LIKE '%usuario_puede_gestionar_usuario%'
  ),
  'usuarios_app updates use hierarchical user management'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'roles'
      AND policyname = 'roles_insert_by_catalogos'
  ),
  'role catalog writes are guarded by catalog management'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'roles_permisos'
      AND policyname = 'roles_permisos_insert_by_catalogos'
  ),
  'role-permission catalog writes are guarded by catalog management'
);

SELECT * FROM finish();

ROLLBACK;
