-- Academic clients reconcile server state on Postgres Changes. Publication does not
-- grant access: existing table grants and SELECT RLS policies remain authoritative.
-- Internal AI jobs intentionally stay unpublished; clients watch their messages.
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'facultades', 'carreras', 'estructuras_plan', 'estructuras_asignatura',
    'lineas_plan', 'bibliografia_asignatura', 'comentarios_plan',
    'comentarios_asignatura', 'cambios_plan', 'cambios_asignatura',
    'conversaciones_plan', 'conversaciones_asignatura', 'notificaciones',
    'registros_oficiales_plan', 'tareas_revision'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabla
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tabla);
    end if;
  end loop;
end $$;
