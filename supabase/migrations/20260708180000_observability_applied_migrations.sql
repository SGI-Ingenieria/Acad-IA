-- Expone las migraciones aplicadas al panel de observabilidad sin abrir el
-- esquema interno supabase_migrations a la API REST. La funcion corre como su
-- dueno (postgres), que si puede leer supabase_migrations.schema_migrations.

create or replace function public.observability_applied_migrations()
returns table (version text, name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.version::text, m.name::text
  from supabase_migrations.schema_migrations as m
  order by m.version asc;
$$;

revoke all on function public.observability_applied_migrations() from public;
grant execute on function public.observability_applied_migrations() to service_role;
