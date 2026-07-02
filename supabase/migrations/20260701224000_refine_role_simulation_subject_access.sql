-- Make helper-level subject access match the SELECT policy used by asignaturas:
-- simulated PROFESOR access is granted through authz_is_responsable_asignatura.

create or replace function public.authz_can_access_asignatura(p_asignatura_id uuid)
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.asignaturas a
    where a.id = p_asignatura_id
      and (
        public.authz_can_access_plan(a.plan_estudio_id)
        or public.authz_is_responsable_asignatura(a.id)
      )
  );
$$;

revoke all on function public.authz_can_access_asignatura(uuid) from public, anon;
grant execute on function public.authz_can_access_asignatura(uuid) to authenticated, service_role;
