-- Los encargados pueden consultar contenido y archivos únicamente de su bloque.
-- La línea incorporada a una licenciatura sigue disponible para su propio plan.
create or replace function public.authz_can_access_asignatura(p_asignatura_id uuid)
returns boolean
language sql stable
set search_path = public, private, auth, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.asignaturas a
    join public.planes_estudio p on p.id=a.plan_estudio_id
    where a.id=p_asignatura_id
      and case when p.categoria='AREA_COMUN' then
        private.area_comun_gestor(auth.uid()) or
        private.area_comun_encargado(
          auth.uid(), private.area_comun_bloque_clave(a.meta_origen->>'bloque')
        )
      else
        public.authz_can_access_plan(a.plan_estudio_id) or
        public.authz_is_responsable_asignatura(a.id)
      end
  );
$$;

revoke all on function public.authz_can_access_asignatura(uuid) from public,anon;
grant execute on function public.authz_can_access_asignatura(uuid) to authenticated,service_role;
