REVOKE EXECUTE ON FUNCTION public.authz_has_role(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_has_permission(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authz_is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuario_tiene_permiso(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.authz_has_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_has_permission(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.authz_is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuario_tiene_permiso(uuid, text) TO authenticated, service_role;
