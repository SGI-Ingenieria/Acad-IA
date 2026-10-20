-- Responsible-professor changes must reconcile in every open academic client.
-- Publication does not grant access; the existing scoped SELECT policy still applies.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'responsables_asignatura'
  ) then
    alter publication supabase_realtime add table public.responsables_asignatura;
  end if;
end $$;
