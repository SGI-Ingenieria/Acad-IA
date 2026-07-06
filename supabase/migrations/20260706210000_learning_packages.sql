-- Asset Factory: paquetes exportables (PPTX, SCORM 1.2, HTML bundle) generados
-- a partir de learning_objects revisados.
--  - Tabla learning_packages con estado del pipeline de empaquetado.
--  - Bucket privado 'learning-packages' en Storage; la edge function
--    learning-package-export escribe con service role y el frontend descarga
--    via signed URL (politica select por asignatura).

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'learning_package_tipo'
  ) then
    create type public.learning_package_tipo as enum (
      'scorm_1_2',
      'scorm_2004',
      'html_bundle',
      'pptx_bundle'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'learning_package_estado'
  ) then
    create type public.learning_package_estado as enum (
      'queued',
      'generating',
      'ready',
      'failed'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tabla learning_packages
-- ---------------------------------------------------------------------------
create table if not exists public.learning_packages (
  id uuid primary key default gen_random_uuid(),
  asignatura_id uuid not null references public.asignaturas(id) on delete cascade,
  unidad_id text,
  tema_id text,
  scope public.learning_generation_scope not null default 'asignatura',
  tipo public.learning_package_tipo not null,
  estado public.learning_package_estado not null default 'queued',
  zip_path text,
  archivo_nombre text,
  archivo_mime text,
  archivo_size bigint,
  manifest_json jsonb not null default '{}'::jsonb,
  error text,
  creado_por uuid references public.usuarios_app(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  completado_en timestamptz,
  constraint learning_packages_scope_target_chk
    check (
      (scope = 'asignatura')
      or (scope = 'unidad' and unidad_id is not null)
      or (scope = 'tema' and unidad_id is not null and tema_id is not null)
    ),
  constraint learning_packages_manifest_object_chk
    check (jsonb_typeof(manifest_json) = 'object'),
  constraint learning_packages_archivo_size_chk
    check (archivo_size is null or archivo_size >= 0),
  constraint learning_packages_ready_requires_path_chk
    check (estado <> 'ready' or zip_path is not null)
);

create index if not exists learning_packages_asignatura_target_idx
  on public.learning_packages (asignatura_id, unidad_id, tema_id, creado_en desc);

drop trigger if exists trg_learning_packages_actualizado_en
  on public.learning_packages;
create trigger trg_learning_packages_actualizado_en
before update on public.learning_packages
for each row execute function public.set_actualizado_en();

-- ---------------------------------------------------------------------------
-- 3. RLS (mismo criterio que learning_objects: ver por acceso a la
--    asignatura, escribir solo con permiso de edicion de contenido)
-- ---------------------------------------------------------------------------
alter table public.learning_packages enable row level security;

drop policy if exists learning_packages_select_by_scope on public.learning_packages;
create policy learning_packages_select_by_scope on public.learning_packages
  for select to authenticated
  using (
    (creado_por = (select auth.uid()))
    or (
      public.authz_has_permission('asignaturas.ver')
      and public.authz_can_access_asignatura(asignatura_id)
    )
  );

drop policy if exists learning_packages_insert_by_scope on public.learning_packages;
create policy learning_packages_insert_by_scope on public.learning_packages
  for insert to authenticated
  with check (public.authz_asignatura_content_write_allowed(asignatura_id));

drop policy if exists learning_packages_update_by_scope on public.learning_packages;
create policy learning_packages_update_by_scope on public.learning_packages
  for update to authenticated
  using (public.authz_asignatura_content_write_allowed(asignatura_id))
  with check (public.authz_asignatura_content_write_allowed(asignatura_id));

drop policy if exists learning_packages_delete_by_scope on public.learning_packages;
create policy learning_packages_delete_by_scope on public.learning_packages
  for delete to authenticated
  using (public.authz_asignatura_content_write_allowed(asignatura_id));

grant select, insert, update, delete on table public.learning_packages
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Bucket privado para los artefactos exportados
--    Path convencional: asignaturas/{asignatura_id}/{package_id}/{archivo}
--    Las escrituras las hace la edge function con service role; los usuarios
--    solo necesitan select para generar signed URLs de descarga.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('learning-packages', 'learning-packages', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

drop policy if exists learning_packages_storage_select on storage.objects;
create policy learning_packages_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'learning-packages'
  and public.authz_has_permission('asignaturas.ver'::text)
  and case
    when name ~* '^asignaturas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
      then public.authz_can_access_asignatura(split_part(name, '/', 2)::uuid)
    else false
  end
);

drop policy if exists learning_packages_storage_delete on storage.objects;
create policy learning_packages_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'learning-packages'
  and case
    when name ~* '^asignaturas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+$'
      then public.authz_asignatura_content_write_allowed(split_part(name, '/', 2)::uuid)
    else false
  end
);
