-- Editing academic content does not confer authority to assign its authors.
-- These restrictions compose with (not replace) the existing subject-scope and
-- workflow-stage policies. SELECT and authorized service_role operations are unchanged.
create policy responsables_asignatura_insert_permiso_gestion
on public.responsables_asignatura as restrictive for insert to authenticated
with check ((select public.authz_has_permission('asignaturas.responsables.gestionar')));

create policy responsables_asignatura_update_permiso_gestion
on public.responsables_asignatura as restrictive for update to authenticated
using ((select public.authz_has_permission('asignaturas.responsables.gestionar')))
with check ((select public.authz_has_permission('asignaturas.responsables.gestionar')));

create policy responsables_asignatura_delete_permiso_gestion
on public.responsables_asignatura as restrictive for delete to authenticated
using ((select public.authz_has_permission('asignaturas.responsables.gestionar')));
