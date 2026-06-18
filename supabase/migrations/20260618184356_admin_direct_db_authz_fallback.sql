-- Fallback de autorización desde tablas para producción:
-- si el JWT no trae claims frescos (o el Auth Hook no está activo), las
-- políticas pueden reconocer ADMIN/permisos directamente desde usuarios_roles.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.authz_user_has_role(
  p_usuario_id uuid,
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
      FROM public.usuarios_roles ur
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE ur.usuario_id = p_usuario_id
        AND ua.dado_de_baja_en IS NULL
        AND r.clave = p_rol
    );
$$;

CREATE OR REPLACE FUNCTION private.authz_user_has_permission(
  p_usuario_id uuid,
  p_permiso text
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
      FROM public.usuarios_roles ur
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      LEFT JOIN public.roles_permisos rp ON rp.rol_id = ur.rol_id
      LEFT JOIN public.permisos p ON p.id = rp.permiso_id
      WHERE ur.usuario_id = p_usuario_id
        AND ua.dado_de_baja_en IS NULL
        AND (
          r.clave = 'ADMIN'
          OR p.clave = p_permiso
        )
    );
$$;

CREATE OR REPLACE FUNCTION private.authz_user_has_global_scope(p_usuario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_usuario_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.usuarios_roles ur
      JOIN public.roles r ON r.id = ur.rol_id
      JOIN public.usuarios_app ua ON ua.id = ur.usuario_id
      WHERE ur.usuario_id = p_usuario_id
        AND ua.dado_de_baja_en IS NULL
        AND (
          r.clave = 'ADMIN'
          OR (
            r.alcance_default = 'global'
            AND ur.facultad_id IS NULL
            AND ur.carrera_id IS NULL
          )
        )
    );
$$;

REVOKE EXECUTE ON FUNCTION private.authz_user_has_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.authz_user_has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.authz_user_has_global_scope(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.authz_user_has_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.authz_user_has_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.authz_user_has_global_scope(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.authz_has_role(p_rol text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' -> 'roles_claves') ? p_rol, false)
    OR private.authz_user_has_role(auth.uid(), p_rol);
$$;

CREATE OR REPLACE FUNCTION public.authz_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.authz_has_role('ADMIN');
$$;

CREATE OR REPLACE FUNCTION public.authz_has_permission(p_permiso text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.authz_is_admin()
    OR COALESCE((auth.jwt() -> 'app_metadata' -> 'permisos') ? p_permiso, false)
    OR private.authz_user_has_permission(auth.uid(), p_permiso);
$$;

CREATE OR REPLACE FUNCTION public.authz_has_global_scope()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT private.authz_user_has_global_scope(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(auth.jwt() #> '{app_metadata,roles}', '[]'::jsonb)) AS rol(value)
      WHERE rol.value ->> 'facultad_id' IS NULL
        AND rol.value ->> 'carrera_id' IS NULL
        AND rol.value ->> 'alcance_default' = 'global'
    );
$$;

CREATE OR REPLACE FUNCTION public.usuario_tiene_permiso(
  p_usuario_id uuid,
  p_permiso text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT private.authz_user_has_permission(p_usuario_id, p_permiso);
$$;

REVOKE EXECUTE ON FUNCTION public.authz_has_role(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_has_permission(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_has_global_scope() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_tiene_permiso(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.authz_has_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_has_permission(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_has_global_scope() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_tiene_permiso(uuid, text) TO authenticated, service_role;
