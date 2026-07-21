-- Reparación idempotente para catálogos donde un archivo histórico comparte
-- contenido (tenant + hash + tamaño) con un blob ya canónico. La migración
-- inicial podía resolver el conflicto del blob pero omitir el archivo lógico.
create temporary table legacy_documentos_reparacion on commit drop as
select
  a.id,
  tm.tenant_id,
  a.creado_por as user_id,
  a.created_at,
  a.path,
  coalesce(
    nullif(a.size, 0)::bigint,
    case
      when coalesce(so.metadata ->> 'size', '') ~ '^[0-9]+$'
        then (so.metadata ->> 'size')::bigint
      else null
    end
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
where a.creado_por is not null;

delete from legacy_documentos_reparacion
where size_bytes is null or size_bytes not between 1 and 20971520;

insert into public.file_blobs (
  id, tenant_id, sha256, size_bytes, detected_mime, storage_bucket,
  storage_path, processing_status, created_at
)
select
  id, tenant_id, sha256, size_bytes, mime_type, 'ai-storage', path,
  'pending', created_at
from legacy_documentos_reparacion
on conflict do nothing;

insert into public.files (
  id, tenant_id, display_name, created_by, status, created_at, updated_at
)
select
  l.id, l.tenant_id, l.display_name, l.user_id, 'processing',
  l.created_at, l.created_at
from legacy_documentos_reparacion l
where exists (
  select 1
  from public.file_blobs b
  where b.tenant_id = l.tenant_id
    and b.sha256 = l.sha256
    and b.size_bytes = l.size_bytes
    and b.deleted_at is null
)
on conflict do nothing;

insert into public.file_versions (
  id, tenant_id, file_id, blob_id, version_number, original_filename,
  uploaded_by, created_at
)
select
  l.id,
  l.tenant_id,
  l.id,
  blob.id,
  1,
  l.display_name,
  l.user_id,
  l.created_at
from legacy_documentos_reparacion l
join public.files f on f.id = l.id and f.tenant_id = l.tenant_id
join lateral (
  select b.id
  from public.file_blobs b
  where b.tenant_id = l.tenant_id
    and b.sha256 = l.sha256
    and b.size_bytes = l.size_bytes
    and b.deleted_at is null
  order by (b.id = l.id) desc, b.created_at, b.id
  limit 1
) blob on true
on conflict do nothing;

update public.files f
set current_version_id = fv.id
from public.file_versions fv
join legacy_documentos_reparacion l on l.id = fv.file_id
where f.id = fv.file_id
  and f.current_version_id is null;

insert into public.ingestion_jobs (
  tenant_id, file_version_id, job_type, idempotency_key, payload, status,
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
join legacy_documentos_reparacion l on l.id = fv.file_id
on conflict (tenant_id, idempotency_key) do nothing;
