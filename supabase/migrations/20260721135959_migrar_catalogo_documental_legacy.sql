-- Integra el catálogo histórico (`archivos` / `repositorios`) en el lago
-- documental sin mantener dos fuentes de verdad en la interfaz. Los IDs se
-- conservan para que relaciones y enlaces existentes sigan siendo trazables.

alter table public.file_blobs
  drop constraint if exists file_blobs_storage_path_check;

alter table public.file_blobs
  add constraint file_blobs_storage_path_check check (
    (
      storage_bucket = 'documentos-academicos'
      and storage_path ~ '^content/[0-9a-f-]+/[a-f0-9]{2}/[a-f0-9]{64}$'
    )
    or (
      storage_bucket = 'ai-storage'
      and storage_path !~ '(^|/)\.\.(/|$)'
      and storage_path !~ '^/'
    )
  );

with legacy_files as (
  select
    a.id,
    tm.tenant_id,
    a.creado_por as user_id,
    a.created_at,
    a.path,
    coalesce(
      nullif(a.size, 0)::bigint,
      nullif(so.metadata ->> 'size', '')::bigint
    ) as size_bytes,
    case
      when lower(coalesce(a.hash, '')) ~ '^[a-f0-9]{64}$'
        then lower(a.hash)
      else md5('legacy:' || a.id::text) || md5(a.id::text || ':file')
    end as sha256,
    coalesce(
      nullif(so.metadata ->> 'mimetype', ''),
      case lower(substring(a.path from '\.([^.]+)$'))
        when 'pdf' then 'application/pdf'
        when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        when 'pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        when 'xlsx' then 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        when 'txt' then 'text/plain'
        when 'md' then 'text/markdown'
        when 'csv' then 'text/csv'
        when 'json' then 'application/json'
        when 'png' then 'image/png'
        when 'jpg' then 'image/jpeg'
        when 'jpeg' then 'image/jpeg'
        when 'webp' then 'image/webp'
        else 'application/octet-stream'
      end
    ) as mime_type,
    coalesce(
      nullif(regexp_replace(a.path, '^[0-9a-f-]{36}-', '', 'i'), ''),
      'Documento sin nombre'
    ) as display_name
  from public.archivos a
  join public.tenant_memberships tm
    on tm.user_id = a.creado_por
   and tm.is_default
  join storage.objects so
    on so.id = a.id
   and so.bucket_id = 'ai-storage'
  where a.creado_por is not null
), eligible_files as (
  select *
  from legacy_files
  where size_bytes between 1 and 20971520
)
insert into public.file_blobs (
  id,
  tenant_id,
  sha256,
  size_bytes,
  detected_mime,
  storage_bucket,
  storage_path,
  processing_status,
  created_at
)
select
  id,
  tenant_id,
  sha256,
  size_bytes,
  mime_type,
  'ai-storage',
  path,
  'pending',
  created_at
from eligible_files
on conflict do nothing;

with legacy_files as (
  select
    a.id,
    tm.tenant_id,
    a.creado_por as user_id,
    a.created_at,
    coalesce(
      nullif(a.size, 0)::bigint,
      nullif(so.metadata ->> 'size', '')::bigint
    ) as size_bytes,
    coalesce(
      nullif(regexp_replace(a.path, '^[0-9a-f-]{36}-', '', 'i'), ''),
      'Documento sin nombre'
    ) as display_name
  from public.archivos a
  join public.tenant_memberships tm
    on tm.user_id = a.creado_por
   and tm.is_default
  join storage.objects so
    on so.id = a.id
   and so.bucket_id = 'ai-storage'
  where a.creado_por is not null
)
insert into public.files (
  id,
  tenant_id,
  display_name,
  created_by,
  status,
  created_at,
  updated_at
)
select
  id,
  tenant_id,
  display_name,
  user_id,
  'processing',
  created_at,
  created_at
from legacy_files
where size_bytes between 1 and 20971520
  and exists (select 1 from public.file_blobs b where b.id = legacy_files.id)
on conflict do nothing;

insert into public.file_versions (
  id,
  tenant_id,
  file_id,
  blob_id,
  version_number,
  original_filename,
  uploaded_by,
  created_at
)
select
  f.id,
  f.tenant_id,
  f.id,
  b.id,
  1,
  f.display_name,
  f.created_by,
  f.created_at
from public.files f
join public.file_blobs b on b.id = f.id and b.tenant_id = f.tenant_id
join public.archivos a on a.id = f.id
on conflict do nothing;

update public.files f
set current_version_id = fv.id
from public.file_versions fv
join public.archivos a on a.id = fv.file_id
where f.id = fv.file_id
  and f.current_version_id is null;

insert into public.ingestion_jobs (
  tenant_id,
  file_version_id,
  job_type,
  idempotency_key,
  payload,
  status,
  available_at
)
select
  fv.tenant_id,
  fv.id,
  'extract_local',
  'legacy-extract:' || fv.id::text,
  jsonb_build_object('file_id', fv.file_id, 'legacy', true),
  'pending',
  now()
from public.file_versions fv
join public.archivos a on a.id = fv.file_id
on conflict (tenant_id, idempotency_key) do nothing;

insert into public.collections (
  id,
  tenant_id,
  name,
  description,
  created_by,
  status,
  created_at,
  updated_at,
  kind
)
select
  r.id,
  tm.tenant_id,
  coalesce(nullif(btrim(r.nombre), ''), 'Repositorio curricular'),
  'Repositorio migrado del catálogo anterior.',
  r.enviado_por,
  'active',
  r.created_at,
  r.created_at,
  'curriculum_repository'
from public.repositorios r
join public.tenant_memberships tm
  on tm.user_id = r.enviado_por
 and tm.is_default
where r.enviado_por is not null
on conflict do nothing;

insert into public.collection_files (
  tenant_id,
  collection_id,
  file_id,
  added_by,
  added_at
)
select
  c.tenant_id,
  c.id,
  f.id,
  c.created_by,
  ar.created_at
from public.archivos_repositorios ar
join public.collections c on c.id = ar.repositorio_id
join public.files f on f.id = ar.archivo_id and f.tenant_id = c.tenant_id
on conflict (collection_id, file_id) do nothing;

comment on constraint file_blobs_storage_path_check on public.file_blobs is
  'Contenido canónico nuevo o ruta histórica segura del bucket ai-storage durante la transición.';
