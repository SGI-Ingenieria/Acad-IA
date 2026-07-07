do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'learning_object_tipo'
  ) then
    create type public.learning_object_tipo as enum (
      'apunte',
      'quiz',
      'actividad',
      'ejercicios',
      'rubrica',
      'outline_presentacion',
      'recursos_externos'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'learning_object_estado'
  ) then
    create type public.learning_object_estado as enum (
      'draft',
      'generated',
      'reviewed',
      'published',
      'archived'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'learning_generation_scope'
  ) then
    create type public.learning_generation_scope as enum (
      'tema',
      'unidad',
      'asignatura'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'learning_generation_estado'
  ) then
    create type public.learning_generation_estado as enum (
      'queued',
      'running',
      'needs_review',
      'completed',
      'failed'
    );
  end if;
end $$;

create table if not exists public.learning_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  asignatura_id uuid not null references public.asignaturas(id) on delete cascade,
  unidad_id text,
  tema_id text,
  scope public.learning_generation_scope not null default 'tema',
  estado public.learning_generation_estado not null default 'queued',
  requested_types public.learning_object_tipo[] not null,
  config_json jsonb not null default '{}'::jsonb,
  openai_response_id text,
  resultado_json jsonb not null default '{}'::jsonb,
  error text,
  creado_por uuid references public.usuarios_app(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  completado_en timestamptz,
  constraint learning_generation_jobs_requested_types_nonempty
    check (cardinality(requested_types) > 0),
  constraint learning_generation_jobs_scope_target_chk
    check (
      (scope = 'asignatura')
      or (scope = 'unidad' and unidad_id is not null)
      or (scope = 'tema' and unidad_id is not null and tema_id is not null)
    )
);

create table if not exists public.learning_objects (
  id uuid primary key default gen_random_uuid(),
  asignatura_id uuid not null references public.asignaturas(id) on delete cascade,
  unidad_id text,
  tema_id text,
  tipo public.learning_object_tipo not null,
  titulo text not null,
  descripcion text,
  contenido_json jsonb not null default '{}'::jsonb,
  archivo_path text,
  estado public.learning_object_estado not null default 'generated',
  score integer,
  metadata jsonb not null default '{}'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  creado_por uuid references public.usuarios_app(id) on delete set null,
  actualizado_por uuid references public.usuarios_app(id) on delete set null,
  interaccion_ia_id uuid references public.interacciones_ia(id) on delete set null,
  generation_job_id uuid references public.learning_generation_jobs(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint learning_objects_score_range_chk
    check (score is null or (score >= 0 and score <= 100)),
  constraint learning_objects_source_refs_array_chk
    check (jsonb_typeof(source_refs) = 'array'),
  constraint learning_objects_metadata_object_chk
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.learning_quality_scores (
  id uuid primary key default gen_random_uuid(),
  asignatura_id uuid not null references public.asignaturas(id) on delete cascade,
  unidad_id text,
  tema_id text,
  score_total integer not null,
  rubrica_json jsonb not null default '{}'::jsonb,
  recomendaciones_json jsonb not null default '[]'::jsonb,
  generation_job_id uuid references public.learning_generation_jobs(id) on delete set null,
  generado_por uuid references public.usuarios_app(id) on delete set null,
  calculado_en timestamptz not null default now(),
  constraint learning_quality_scores_total_range_chk
    check (score_total >= 0 and score_total <= 100),
  constraint learning_quality_scores_rubrica_object_chk
    check (jsonb_typeof(rubrica_json) = 'object'),
  constraint learning_quality_scores_recomendaciones_array_chk
    check (jsonb_typeof(recomendaciones_json) = 'array')
);

create index if not exists learning_generation_jobs_asignatura_target_idx
  on public.learning_generation_jobs (asignatura_id, scope, unidad_id, tema_id, creado_en desc);

create index if not exists learning_objects_asignatura_target_idx
  on public.learning_objects (asignatura_id, unidad_id, tema_id, tipo, creado_en desc);

create index if not exists learning_objects_generation_job_idx
  on public.learning_objects (generation_job_id);

create index if not exists learning_quality_scores_target_idx
  on public.learning_quality_scores (asignatura_id, unidad_id, tema_id, calculado_en desc);

drop trigger if exists trg_learning_generation_jobs_actualizado_en
  on public.learning_generation_jobs;
create trigger trg_learning_generation_jobs_actualizado_en
before update on public.learning_generation_jobs
for each row execute function public.set_actualizado_en();

drop trigger if exists trg_learning_objects_actualizado_en
  on public.learning_objects;
create trigger trg_learning_objects_actualizado_en
before update on public.learning_objects
for each row execute function public.set_actualizado_en();

alter table public.learning_generation_jobs enable row level security;
alter table public.learning_objects enable row level security;
alter table public.learning_quality_scores enable row level security;

drop policy if exists learning_generation_jobs_select_by_scope
  on public.learning_generation_jobs;
create policy learning_generation_jobs_select_by_scope
  on public.learning_generation_jobs
  as permissive for select to authenticated
  using (
    (creado_por = (select auth.uid()))
    or (
      authz_has_permission('asignaturas.ver'::text)
      and authz_can_access_asignatura(asignatura_id)
    )
    or authz_asignatura_ia_allowed(asignatura_id)
  );

drop policy if exists learning_generation_jobs_insert_by_scope
  on public.learning_generation_jobs;
create policy learning_generation_jobs_insert_by_scope
  on public.learning_generation_jobs
  as permissive for insert to authenticated
  with check (
    (creado_por = (select auth.uid()))
    and authz_asignatura_ia_allowed(asignatura_id)
  );

drop policy if exists learning_generation_jobs_update_by_scope
  on public.learning_generation_jobs;
create policy learning_generation_jobs_update_by_scope
  on public.learning_generation_jobs
  as permissive for update to authenticated
  using (authz_asignatura_ia_allowed(asignatura_id))
  with check (authz_asignatura_ia_allowed(asignatura_id));

drop policy if exists learning_generation_jobs_delete_by_scope
  on public.learning_generation_jobs;
create policy learning_generation_jobs_delete_by_scope
  on public.learning_generation_jobs
  as permissive for delete to authenticated
  using (authz_asignatura_ia_allowed(asignatura_id));

drop policy if exists learning_objects_select_by_scope
  on public.learning_objects;
create policy learning_objects_select_by_scope
  on public.learning_objects
  as permissive for select to authenticated
  using (
    (creado_por = (select auth.uid()))
    or (
      authz_has_permission('asignaturas.ver'::text)
      and authz_can_access_asignatura(asignatura_id)
    )
    or authz_asignatura_ia_allowed(asignatura_id)
  );

drop policy if exists learning_objects_insert_by_scope
  on public.learning_objects;
create policy learning_objects_insert_by_scope
  on public.learning_objects
  as permissive for insert to authenticated
  with check (
    (creado_por = (select auth.uid()))
    and authz_asignatura_ia_allowed(asignatura_id)
  );

drop policy if exists learning_objects_update_by_scope
  on public.learning_objects;
create policy learning_objects_update_by_scope
  on public.learning_objects
  as permissive for update to authenticated
  using (authz_asignatura_ia_allowed(asignatura_id))
  with check (authz_asignatura_ia_allowed(asignatura_id));

drop policy if exists learning_objects_delete_by_scope
  on public.learning_objects;
create policy learning_objects_delete_by_scope
  on public.learning_objects
  as permissive for delete to authenticated
  using (authz_asignatura_ia_allowed(asignatura_id));

drop policy if exists learning_quality_scores_select_by_scope
  on public.learning_quality_scores;
create policy learning_quality_scores_select_by_scope
  on public.learning_quality_scores
  as permissive for select to authenticated
  using (
    (generado_por = (select auth.uid()))
    or (
      authz_has_permission('asignaturas.ver'::text)
      and authz_can_access_asignatura(asignatura_id)
    )
    or authz_asignatura_ia_allowed(asignatura_id)
  );

drop policy if exists learning_quality_scores_insert_by_scope
  on public.learning_quality_scores;
create policy learning_quality_scores_insert_by_scope
  on public.learning_quality_scores
  as permissive for insert to authenticated
  with check (
    (generado_por = (select auth.uid()))
    and authz_asignatura_ia_allowed(asignatura_id)
  );

drop policy if exists learning_quality_scores_update_by_scope
  on public.learning_quality_scores;
create policy learning_quality_scores_update_by_scope
  on public.learning_quality_scores
  as permissive for update to authenticated
  using (authz_asignatura_ia_allowed(asignatura_id))
  with check (authz_asignatura_ia_allowed(asignatura_id));

drop policy if exists learning_quality_scores_delete_by_scope
  on public.learning_quality_scores;
create policy learning_quality_scores_delete_by_scope
  on public.learning_quality_scores
  as permissive for delete to authenticated
  using (authz_asignatura_ia_allowed(asignatura_id));

grant select, insert, update, delete on table public.learning_generation_jobs
  to authenticated, service_role;
grant select, insert, update, delete on table public.learning_objects
  to authenticated, service_role;
grant select, insert, update, delete on table public.learning_quality_scores
  to authenticated, service_role;
