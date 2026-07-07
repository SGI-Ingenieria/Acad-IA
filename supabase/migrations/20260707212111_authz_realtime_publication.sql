do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'usuarios_app'
  ) then
    execute 'alter publication supabase_realtime add table public.usuarios_app';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'usuarios_roles'
  ) then
    execute 'alter publication supabase_realtime add table public.usuarios_roles';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'roles_permisos'
  ) then
    execute 'alter publication supabase_realtime add table public.roles_permisos';
  end if;
end $$;
