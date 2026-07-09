-- Unificar comentarios de asignatura en comentarios_plan,
-- agregar referencia de seleccion de texto y ambito por asignatura.

-- 1. Nuevas columnas
alter table public.comentarios_plan
  add column if not exists asignatura_id uuid null references public.asignaturas(id) on delete cascade,
  add column if not exists referencia jsonb null;

-- 2. Indices
create index if not exists comentarios_plan_asignatura_idx on public.comentarios_plan(asignatura_id);

-- 3. Migrar comentarios_asignatura a comentarios_plan como comentarios de asignatura.
-- Se deja estado_id en NULL porque los comentarios historicos no tenian fase asociada al plan.
insert into public.comentarios_plan (
  plan_estudio_id,
  estado_id,
  asignatura_id,
  comentario_padre_id,
  autor_id,
  categoria,
  cuerpo,
  resuelto,
  creado_en
)
select
  a.plan_estudio_id,
  null,
  ca.asignatura_id,
  null,
  ca.autor_id,
  ca.categoria,
  ca.cuerpo,
  ca.resuelto,
  ca.creado_en
from public.comentarios_asignatura ca
join public.asignaturas a on a.id = ca.asignatura_id
where not exists (
  select 1 from public.comentarios_plan cp
  where cp.asignatura_id = ca.asignatura_id
    and cp.autor_id = ca.autor_id
    and cp.cuerpo = ca.cuerpo
    and cp.creado_en = ca.creado_en
)
on conflict do nothing;

-- 4. Actualizar policies de comentarios_plan para respetar el ambito.
drop policy if exists comentarios_plan_select_by_scope on public.comentarios_plan;
create policy comentarios_plan_select_by_scope on public.comentarios_plan
  as permissive for select to authenticated
  using (
    (autor_id = (select auth.uid()))
    or (
      asignatura_id is null
      and authz_has_permission('planes.ver'::text)
      and authz_can_access_plan(plan_estudio_id)
    )
    or (
      asignatura_id is not null
      and authz_can_access_asignatura(asignatura_id)
    )
  );

drop policy if exists comentarios_plan_insert_by_scope on public.comentarios_plan;
create policy comentarios_plan_insert_by_scope on public.comentarios_plan
  as permissive for insert to authenticated
  with check (
    (autor_id = (select auth.uid()))
    and (
      (
        asignatura_id is null
        and private.usuario_puede_comentar_plan((select auth.uid()), plan_estudio_id)
      )
      or (
        asignatura_id is not null
        and authz_can_access_asignatura(asignatura_id)
        and private.usuario_puede_comentar_plan((select auth.uid()), plan_estudio_id)
      )
    )
  );

drop policy if exists comentarios_plan_update_own on public.comentarios_plan;
create policy comentarios_plan_update_own on public.comentarios_plan
  as permissive for update to authenticated
  using ((autor_id = (select auth.uid())) or authz_is_admin())
  with check ((autor_id = (select auth.uid())) or authz_is_admin());

drop policy if exists comentarios_plan_delete_own on public.comentarios_plan;
create policy comentarios_plan_delete_own on public.comentarios_plan
  as permissive for delete to authenticated
  using ((autor_id = (select auth.uid())) or authz_is_admin());
