-- custom_access_token_hook corre como supabase_auth_admin y necesita leer
-- la relación de bloques para construir las asignaciones del JWT.
grant select on public.area_comun_encargados_bloque to supabase_auth_admin;
