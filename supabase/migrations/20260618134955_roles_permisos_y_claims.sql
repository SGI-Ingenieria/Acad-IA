-- Roles, permisos y claims de autorización para la jerarquía institucional.
-- Las tablas están en español; las claves de permisos son estables para frontend/RLS.

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS nivel_jerarquico integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS alcance_default text NOT NULL DEFAULT 'carrera';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_alcance_default_chk'
      AND conrelid = 'public.roles'::regclass
  ) THEN
    ALTER TABLE public.roles
      ADD CONSTRAINT roles_alcance_default_chk
      CHECK (alcance_default IN ('global', 'facultad', 'carrera', 'asignatura', 'externo'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.permisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text NOT NULL UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  grupo text NOT NULL DEFAULT 'general',
  orden integer NOT NULL DEFAULT 100,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles_permisos (
  rol_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permiso_id uuid NOT NULL REFERENCES public.permisos(id) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rol_id, permiso_id)
);

ALTER TABLE public.usuarios_roles
  DROP CONSTRAINT IF EXISTS usuarios_roles_alcance_chk;

ALTER TABLE public.usuarios_roles
  ADD CONSTRAINT usuarios_roles_alcance_chk
  CHECK (NOT (facultad_id IS NOT NULL AND carrera_id IS NOT NULL));

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_roles_unicos_idx
  ON public.usuarios_roles (
    usuario_id,
    rol_id,
    COALESCE(facultad_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(carrera_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

INSERT INTO public.roles (clave, nombre, descripcion, nivel_jerarquico, alcance_default)
VALUES
  ('ADMIN', 'Administrador', 'Acceso total al sistema', 0, 'global'),
  ('VICERRECTOR_ACADEMICO', 'Vicerrector Académico', 'Supervisa todas las facultades y direcciones académicas', 10, 'global'),
  ('DIRECTOR_FACULTAD', 'Director de Facultad', 'Gestiona planes y usuarios de una facultad', 20, 'facultad'),
  ('SECRETARIO_ACADEMICO', 'Secretario Académico', 'Revisa, valida y da seguimiento académico a planes', 30, 'facultad'),
  ('JEFE_CARRERA', 'Jefe de Carrera', 'Gestiona planes de estudio de una carrera', 40, 'carrera'),
  ('PROFESOR', 'Profesor', 'Responsable o coautor de asignaturas', 50, 'carrera'),
  ('EVALUADOR_EXTERNO', 'Evaluador Externo', 'Consulta planes asignados y registra retroalimentación externa', 60, 'externo')
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  nivel_jerarquico = EXCLUDED.nivel_jerarquico,
  alcance_default = EXCLUDED.alcance_default;

INSERT INTO public.permisos (clave, nombre, descripcion, grupo, orden)
VALUES
  ('usuarios.ver', 'Ver usuarios', 'Consultar perfiles, estados y alcances de usuarios', 'usuarios', 10),
  ('usuarios.gestionar', 'Gestionar usuarios', 'Crear, reactivar, dar de baja e invitar usuarios', 'usuarios', 20),
  ('usuarios.roles.gestionar', 'Gestionar roles', 'Asignar y retirar roles y alcances institucionales', 'usuarios', 30),
  ('planes.ver', 'Ver planes', 'Consultar planes de estudio dentro del alcance', 'planes', 10),
  ('planes.crear', 'Crear planes', 'Crear planes de estudio dentro del alcance', 'planes', 20),
  ('planes.editar', 'Editar planes', 'Modificar datos generales, mapas y estructura del plan', 'planes', 30),
  ('planes.enviar_revision', 'Enviar a revisión', 'Enviar planes a revisión académica', 'planes', 40),
  ('planes.aprobar', 'Aprobar planes', 'Aprobar, rechazar o transicionar estados de revisión', 'planes', 50),
  ('asignaturas.ver', 'Ver asignaturas', 'Consultar asignaturas dentro del alcance', 'asignaturas', 10),
  ('asignaturas.editar', 'Editar asignaturas', 'Crear o modificar asignaturas y contenido académico', 'asignaturas', 20),
  ('asignaturas.responsables.gestionar', 'Gestionar responsables de asignatura', 'Asignar profesores responsables, coautores y revisores', 'asignaturas', 30),
  ('comentarios.externos.crear', 'Comentar como externo', 'Registrar observaciones y retroalimentación externa', 'revision', 10),
  ('auditoria.ver', 'Ver trazabilidad', 'Consultar historial de cambios y autoría', 'auditoria', 10),
  ('catalogos.gestionar', 'Gestionar catálogos', 'Administrar facultades, carreras, estructuras y estados', 'catalogos', 10)
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  grupo = EXCLUDED.grupo,
  orden = EXCLUDED.orden;

WITH matriz(rol_clave, permiso_clave) AS (
  VALUES
    ('ADMIN', 'usuarios.ver'),
    ('ADMIN', 'usuarios.gestionar'),
    ('ADMIN', 'usuarios.roles.gestionar'),
    ('ADMIN', 'planes.ver'),
    ('ADMIN', 'planes.crear'),
    ('ADMIN', 'planes.editar'),
    ('ADMIN', 'planes.enviar_revision'),
    ('ADMIN', 'planes.aprobar'),
    ('ADMIN', 'asignaturas.ver'),
    ('ADMIN', 'asignaturas.editar'),
    ('ADMIN', 'asignaturas.responsables.gestionar'),
    ('ADMIN', 'comentarios.externos.crear'),
    ('ADMIN', 'auditoria.ver'),
    ('ADMIN', 'catalogos.gestionar'),

    ('VICERRECTOR_ACADEMICO', 'usuarios.ver'),
    ('VICERRECTOR_ACADEMICO', 'planes.ver'),
    ('VICERRECTOR_ACADEMICO', 'planes.aprobar'),
    ('VICERRECTOR_ACADEMICO', 'asignaturas.ver'),
    ('VICERRECTOR_ACADEMICO', 'auditoria.ver'),

    ('DIRECTOR_FACULTAD', 'usuarios.ver'),
    ('DIRECTOR_FACULTAD', 'planes.ver'),
    ('DIRECTOR_FACULTAD', 'planes.crear'),
    ('DIRECTOR_FACULTAD', 'planes.editar'),
    ('DIRECTOR_FACULTAD', 'planes.enviar_revision'),
    ('DIRECTOR_FACULTAD', 'planes.aprobar'),
    ('DIRECTOR_FACULTAD', 'asignaturas.ver'),
    ('DIRECTOR_FACULTAD', 'asignaturas.editar'),
    ('DIRECTOR_FACULTAD', 'auditoria.ver'),

    ('SECRETARIO_ACADEMICO', 'usuarios.ver'),
    ('SECRETARIO_ACADEMICO', 'planes.ver'),
    ('SECRETARIO_ACADEMICO', 'planes.editar'),
    ('SECRETARIO_ACADEMICO', 'planes.enviar_revision'),
    ('SECRETARIO_ACADEMICO', 'planes.aprobar'),
    ('SECRETARIO_ACADEMICO', 'asignaturas.ver'),
    ('SECRETARIO_ACADEMICO', 'asignaturas.editar'),
    ('SECRETARIO_ACADEMICO', 'auditoria.ver'),

    ('JEFE_CARRERA', 'usuarios.ver'),
    ('JEFE_CARRERA', 'planes.ver'),
    ('JEFE_CARRERA', 'planes.crear'),
    ('JEFE_CARRERA', 'planes.editar'),
    ('JEFE_CARRERA', 'planes.enviar_revision'),
    ('JEFE_CARRERA', 'asignaturas.ver'),
    ('JEFE_CARRERA', 'asignaturas.editar'),
    ('JEFE_CARRERA', 'asignaturas.responsables.gestionar'),
    ('JEFE_CARRERA', 'auditoria.ver'),

    ('PROFESOR', 'planes.ver'),
    ('PROFESOR', 'asignaturas.ver'),
    ('PROFESOR', 'asignaturas.editar'),
    ('PROFESOR', 'auditoria.ver'),

    ('EVALUADOR_EXTERNO', 'planes.ver'),
    ('EVALUADOR_EXTERNO', 'asignaturas.ver'),
    ('EVALUADOR_EXTERNO', 'comentarios.externos.crear')
)
INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM matriz m
JOIN public.roles r ON r.clave = m.rol_clave
JOIN public.permisos p ON p.clave = m.permiso_clave
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.authz_has_role(p_rol text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' -> 'roles_claves') ? p_rol, false);
$$;

CREATE OR REPLACE FUNCTION public.authz_has_permission(p_permiso text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' -> 'permisos') ? p_permiso, false);
$$;

CREATE OR REPLACE FUNCTION public.authz_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.authz_has_role('ADMIN');
$$;

CREATE OR REPLACE FUNCTION public.usuario_tiene_permiso(
  p_usuario_id uuid,
  p_permiso text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_roles ur
    JOIN public.roles_permisos rp ON rp.rol_id = ur.rol_id
    JOIN public.permisos p ON p.id = rp.permiso_id
    WHERE ur.usuario_id = p_usuario_id
      AND p.clave = p_permiso
  );
$$;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  original_claims jsonb;
  new_claims jsonb;
  app_meta jsonb;
  claim text;
  user_id uuid;
  roles_json jsonb := '[]'::jsonb;
  roles_claves_json jsonb := '[]'::jsonb;
  permisos_json jsonb := '[]'::jsonb;
  alcances_json jsonb := '{"global": [], "facultades": [], "carreras": []}'::jsonb;
BEGIN
  original_claims = event->'claims';
  new_claims = '{}'::jsonb;
  app_meta = COALESCE(original_claims->'app_metadata', '{}'::jsonb);

  IF original_claims ? 'sub' THEN
    user_id = (original_claims->>'sub')::uuid;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ur.id,
          'rol_id', r.id,
          'clave', r.clave,
          'nombre', r.nombre,
          'nivel_jerarquico', r.nivel_jerarquico,
          'alcance_default', r.alcance_default,
          'facultad_id', ur.facultad_id,
          'carrera_id', ur.carrera_id
        )
        ORDER BY r.nivel_jerarquico, r.clave
      ),
      '[]'::jsonb
    )
    INTO roles_json
    FROM public.usuarios_roles ur
    JOIN public.roles r ON r.id = ur.rol_id
    JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
    WHERE ur.usuario_id = user_id
      AND ua.dado_de_baja_en IS NULL;

    SELECT COALESCE(jsonb_agg(clave ORDER BY clave), '[]'::jsonb)
    INTO roles_claves_json
    FROM (
      SELECT DISTINCT r.clave
      FROM public.usuarios_roles ur
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE ur.usuario_id = user_id
        AND ua.dado_de_baja_en IS NULL
    ) s;

    SELECT COALESCE(jsonb_agg(clave ORDER BY clave), '[]'::jsonb)
    INTO permisos_json
    FROM (
      SELECT DISTINCT p.clave
      FROM public.usuarios_roles ur
      JOIN public.roles_permisos rp ON rp.rol_id = ur.rol_id
      JOIN public.permisos p ON p.id = rp.permiso_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE ur.usuario_id = user_id
        AND ua.dado_de_baja_en IS NULL
    ) s;

    SELECT jsonb_build_object(
      'global', COALESCE(jsonb_agg(DISTINCT r.clave) FILTER (WHERE ur.facultad_id IS NULL AND ur.carrera_id IS NULL), '[]'::jsonb),
      'facultades', COALESCE(jsonb_agg(DISTINCT ur.facultad_id) FILTER (WHERE ur.facultad_id IS NOT NULL), '[]'::jsonb),
      'carreras', COALESCE(jsonb_agg(DISTINCT ur.carrera_id) FILTER (WHERE ur.carrera_id IS NOT NULL), '[]'::jsonb)
    )
    INTO alcances_json
    FROM public.usuarios_roles ur
    JOIN public.roles r ON r.id = ur.rol_id
    JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
    WHERE ur.usuario_id = user_id
      AND ua.dado_de_baja_en IS NULL;
  END IF;

  app_meta = app_meta || jsonb_build_object(
    'roles', roles_json,
    'roles_claves', roles_claves_json,
    'permisos', permisos_json,
    'alcances', COALESCE(alcances_json, '{"global": [], "facultades": [], "carreras": []}'::jsonb)
  );

  FOREACH claim IN ARRAY ARRAY[
    'iss',
    'aud',
    'exp',
    'iat',
    'sub',
    'role',
    'aal',
    'session_id',
    'email',
    'phone',
    'is_anonymous'
  ] LOOP
    IF original_claims ? claim THEN
      new_claims = jsonb_set(new_claims, ARRAY[claim], original_claims->claim);
    END IF;
  END LOOP;

  new_claims = jsonb_set(new_claims, ARRAY['app_metadata'], app_meta);

  RETURN jsonb_build_object('claims', new_claims);
END
$function$;

ALTER TABLE public.permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles_permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_name" ON public.roles;
DROP POLICY IF EXISTS "policy_name" ON public.usuarios_roles;
DROP POLICY IF EXISTS "policy_name" ON public.usuarios_app;

CREATE POLICY roles_select_authenticated
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY roles_manage_by_permission
  ON public.roles
  FOR ALL
  TO authenticated
  USING (public.authz_has_permission('usuarios.roles.gestionar'))
  WITH CHECK (public.authz_has_permission('usuarios.roles.gestionar'));

CREATE POLICY permisos_select_authenticated
  ON public.permisos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY roles_permisos_select_authenticated
  ON public.roles_permisos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY usuarios_app_select_own_or_manage
  ON public.usuarios_app
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.authz_has_permission('usuarios.ver')
    OR public.authz_has_permission('usuarios.gestionar')
  );

CREATE POLICY usuarios_app_update_own_or_manage
  ON public.usuarios_app
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR public.authz_has_permission('usuarios.gestionar')
  )
  WITH CHECK (
    id = auth.uid()
    OR public.authz_has_permission('usuarios.gestionar')
  );

CREATE POLICY usuarios_roles_select_own_or_manage
  ON public.usuarios_roles
  FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.authz_has_permission('usuarios.ver')
    OR public.authz_has_permission('usuarios.roles.gestionar')
  );

CREATE POLICY usuarios_roles_insert_by_permission
  ON public.usuarios_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.authz_has_permission('usuarios.roles.gestionar'));

CREATE POLICY usuarios_roles_update_by_permission
  ON public.usuarios_roles
  FOR UPDATE
  TO authenticated
  USING (public.authz_has_permission('usuarios.roles.gestionar'))
  WITH CHECK (public.authz_has_permission('usuarios.roles.gestionar'));

CREATE POLICY usuarios_roles_delete_by_permission
  ON public.usuarios_roles
  FOR DELETE
  TO authenticated
  USING (public.authz_has_permission('usuarios.roles.gestionar'));

REVOKE ALL ON TABLE public.roles FROM anon;
REVOKE ALL ON TABLE public.usuarios_roles FROM anon;
REVOKE ALL ON TABLE public.usuarios_app FROM anon;
REVOKE ALL ON TABLE public.permisos FROM anon;
REVOKE ALL ON TABLE public.roles_permisos FROM anon;

GRANT SELECT ON TABLE public.roles TO authenticated;
GRANT SELECT ON TABLE public.permisos TO authenticated;
GRANT SELECT ON TABLE public.roles_permisos TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.usuarios_app TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usuarios_roles TO authenticated;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON TABLE public.usuarios_app TO supabase_auth_admin;
GRANT SELECT ON TABLE public.usuarios_roles TO supabase_auth_admin;
GRANT SELECT ON TABLE public.roles TO supabase_auth_admin;
GRANT SELECT ON TABLE public.permisos TO supabase_auth_admin;
GRANT SELECT ON TABLE public.roles_permisos TO supabase_auth_admin;

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

GRANT EXECUTE ON FUNCTION public.authz_has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.authz_has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.authz_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_tiene_permiso(uuid, text) TO authenticated, service_role;
