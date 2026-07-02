-- Keep subject-scoped simulations narrow: a simulated PROFESOR should see the
-- selected asignatura through authz_is_responsable_asignatura, not the whole
-- plan. EVALUADOR_EXTERNO keeps plan-level access because that role is assigned
-- at plan/review scope.

create or replace function private.authz_claim_can_access_plan(p_plan_id uuid)
returns boolean
language sql
stable
security invoker
set search_path to public, private, auth, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.planes_estudio pe
    join public.carreras c on c.id = pe.carrera_id
    where pe.id = p_plan_id
      and (
        private.authz_claim_has_global_scope()
        or (
          private.authz_claim_has_role('EVALUADOR_EXTERNO')
          and nullif(auth.jwt() #>> '{app_metadata,authz_simulacion,plan_estudio_id}', '')::uuid = pe.id
        )
        or exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(auth.jwt() #> '{app_metadata,alcances,carreras}', '[]'::jsonb)
          ) as alcance(value)
          where alcance.value = pe.carrera_id::text
        )
        or exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(auth.jwt() #> '{app_metadata,alcances,facultades}', '[]'::jsonb)
          ) as alcance(value)
          where alcance.value = c.facultad_id::text
        )
      )
  );
$$;

revoke all on function private.authz_claim_can_access_plan(uuid) from public, anon;
grant execute on function private.authz_claim_can_access_plan(uuid) to authenticated, service_role;
