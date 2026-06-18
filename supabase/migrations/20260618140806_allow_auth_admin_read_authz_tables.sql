-- Supabase Auth executes the custom access token hook as supabase_auth_admin.
-- In the local CLI stack this role does not bypass RLS, so the hook needs
-- explicit read policies for the authorization tables it consults.

DROP POLICY IF EXISTS usuarios_app_select_auth_admin ON public.usuarios_app;
CREATE POLICY usuarios_app_select_auth_admin
  ON public.usuarios_app
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS usuarios_roles_select_auth_admin ON public.usuarios_roles;
CREATE POLICY usuarios_roles_select_auth_admin
  ON public.usuarios_roles
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS roles_select_auth_admin ON public.roles;
CREATE POLICY roles_select_auth_admin
  ON public.roles
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS permisos_select_auth_admin ON public.permisos;
CREATE POLICY permisos_select_auth_admin
  ON public.permisos
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS roles_permisos_select_auth_admin ON public.roles_permisos;
CREATE POLICY roles_permisos_select_auth_admin
  ON public.roles_permisos
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

GRANT SELECT ON TABLE public.usuarios_app TO supabase_auth_admin;
GRANT SELECT ON TABLE public.usuarios_roles TO supabase_auth_admin;
GRANT SELECT ON TABLE public.roles TO supabase_auth_admin;
GRANT SELECT ON TABLE public.permisos TO supabase_auth_admin;
GRANT SELECT ON TABLE public.roles_permisos TO supabase_auth_admin;
