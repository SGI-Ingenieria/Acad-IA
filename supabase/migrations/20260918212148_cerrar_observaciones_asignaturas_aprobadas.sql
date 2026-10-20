-- Freeze direct observation writes after approval without changing access to history.
-- RESTRICTIVE policies are ANDed with the existing author/scope policies; they never
-- grant access. The authenticated transition Edge Function uses service_role only
-- after its existing authorization RPC; its approval/reopening history is unaffected.
create policy comentarios_asignatura_insert_revision_abierta
on public.comentarios_asignatura as restrictive for insert to authenticated
with check (exists (
  select 1 from public.asignaturas a
  where a.id = comentarios_asignatura.asignatura_id and a.estado <> 'aprobada'
));

create policy comentarios_asignatura_update_revision_abierta
on public.comentarios_asignatura as restrictive for update to authenticated
using (exists (
  select 1 from public.asignaturas a
  where a.id = comentarios_asignatura.asignatura_id and a.estado <> 'aprobada'
))
with check (exists (
  select 1 from public.asignaturas a
  where a.id = comentarios_asignatura.asignatura_id and a.estado <> 'aprobada'
));

create policy comentarios_asignatura_delete_revision_abierta
on public.comentarios_asignatura as restrictive for delete to authenticated
using (exists (
  select 1 from public.asignaturas a
  where a.id = comentarios_asignatura.asignatura_id and a.estado <> 'aprobada'
));

-- Legacy subject observations and transition reasons also live in comentarios_plan.
-- Plan-only discussions are unaffected.
create policy comentarios_plan_insert_revision_abierta
on public.comentarios_plan as restrictive for insert to authenticated
with check (asignatura_id is null or exists (
  select 1 from public.asignaturas a
  where a.id = comentarios_plan.asignatura_id and a.estado <> 'aprobada'
));

create policy comentarios_plan_update_revision_abierta
on public.comentarios_plan as restrictive for update to authenticated
using (asignatura_id is null or exists (
  select 1 from public.asignaturas a
  where a.id = comentarios_plan.asignatura_id and a.estado <> 'aprobada'
))
with check (asignatura_id is null or exists (
  select 1 from public.asignaturas a
  where a.id = comentarios_plan.asignatura_id and a.estado <> 'aprobada'
));

create policy comentarios_plan_delete_revision_abierta
on public.comentarios_plan as restrictive for delete to authenticated
using (asignatura_id is null or exists (
  select 1 from public.asignaturas a
  where a.id = comentarios_plan.asignatura_id and a.estado <> 'aprobada'
));
