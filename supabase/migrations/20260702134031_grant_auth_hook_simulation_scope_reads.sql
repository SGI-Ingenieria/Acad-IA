-- The custom access token hook enriches simulated role claims with academic
-- scope context. Supabase runs the hook as supabase_auth_admin, so it needs
-- read access to the referenced catalog tables.
grant select on table public.facultades to supabase_auth_admin;
grant select on table public.carreras to supabase_auth_admin;
grant select on table public.planes_estudio to supabase_auth_admin;
grant select on table public.asignaturas to supabase_auth_admin;
