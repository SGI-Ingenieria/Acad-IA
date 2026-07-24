-- Retiro del pipeline propio de extracción/chunking/embeddings. El retrieval
-- pasa a vector stores de OpenAI (caché reconstruible con cascada de
-- recuperación). document_extractions y document_chunks quedan inertes —
-- nada nuevo los escribe — y se eliminarán en una migración posterior cuando
-- se confirme que ningún historial los renderiza.

-- ---------------------------------------------------------------------------
-- 1. La materialización deja el archivo listo de inmediato: la disponibilidad
--    para el usuario ya no depende de indexado alguno. Lo único que se encola
--    es la sincronización (asíncrona y opcional) del blob a OpenAI Files.
-- ---------------------------------------------------------------------------

create or replace function public.materializar_sesion_carga_documento(
  p_session_id uuid,
  p_sha256 text,
  p_size_bytes bigint,
  p_detected_mime text,
  p_storage_path text
) returns table (
  file_id uuid,
  file_version_id uuid,
  blob_id uuid,
  blob_created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesion public.upload_sessions;
  v_blob public.file_blobs;
  v_archivo public.files;
  v_version public.file_versions;
  v_nuevo_blob boolean := false;
begin
  if p_sha256 !~ '^[a-f0-9]{64}$'
     or p_size_bytes not between 1 and 20971520
     or nullif(btrim(p_detected_mime), '') is null then
    raise exception using errcode = '22023', message = 'Metadatos de archivo inválidos';
  end if;

  select * into v_sesion
  from public.upload_sessions
  where id = p_session_id
    and status in ('uploaded', 'hashing', 'deduplicating')
  for update;
  if v_sesion.id is null then
    raise exception using errcode = 'P0002', message = 'Sesión de carga no disponible';
  end if;
  if v_sesion.declared_size <> p_size_bytes then
    raise exception using errcode = '23514', message = 'El tamaño real no coincide con la sesión';
  end if;
  if p_storage_path <> format('content/%s/%s/%s', v_sesion.tenant_id, left(p_sha256, 2), p_sha256) then
    raise exception using errcode = '23514', message = 'Ruta física no canónica';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_sesion.tenant_id::text || ':' || p_sha256, 0)
  );
  select * into v_blob
  from public.file_blobs
  where tenant_id = v_sesion.tenant_id
    and sha256 = p_sha256
    and size_bytes = p_size_bytes
    and deleted_at is null
  for update;

  if v_blob.id is null then
    insert into public.file_blobs (
      tenant_id, sha256, size_bytes, detected_mime, storage_path, processing_status
    ) values (
      v_sesion.tenant_id, p_sha256, p_size_bytes, p_detected_mime,
      p_storage_path, 'ready'
    ) returning * into v_blob;
    v_nuevo_blob := true;
  end if;

  insert into public.files (
    tenant_id, display_name, created_by, status, last_used_at, source
  ) values (
    v_sesion.tenant_id, v_sesion.original_filename, v_sesion.user_id, 'ready',
    now(), v_sesion.source
  ) returning * into v_archivo;

  insert into public.file_versions (
    tenant_id, file_id, blob_id, version_number, original_filename, uploaded_by
  ) values (
    v_sesion.tenant_id, v_archivo.id, v_blob.id, 1,
    v_sesion.original_filename, v_sesion.user_id
  ) returning * into v_version;

  update public.files
  set current_version_id = v_version.id
  where id = v_archivo.id;
  update public.upload_sessions
  set status = 'ready', result_file_id = v_archivo.id, completed_at = now(), error_code = null
  where id = v_sesion.id;

  -- Sincronización a OpenAI Files: caché, jamás bloqueante. Las imágenes no
  -- se sincronizan (van directo a visión en la generación).
  if v_nuevo_blob and v_blob.detected_mime not like 'image/%' then
    perform public.encolar_trabajo_ingesta_documental(
      v_sesion.tenant_id,
      null,
      v_version.id,
      'openai_sync',
      format('openaisync:%s', v_blob.id),
      jsonb_build_object('blob_id', v_blob.id)
    );
  end if;

  file_id := v_archivo.id;
  file_version_id := v_version.id;
  blob_id := v_blob.id;
  blob_created := v_nuevo_blob;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tipos de trabajo retirados: rechazo explícito en el encolado
-- ---------------------------------------------------------------------------

create or replace function public.encolar_trabajo_ingesta_documental(
  p_tenant_id uuid,
  p_upload_session_id uuid,
  p_file_version_id uuid,
  p_tipo public.tipo_trabajo_ingesta_documental,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb
) returns public.ingestion_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trabajo public.ingestion_jobs;
  v_cola text;
begin
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception using errcode = '22023', message = 'idempotency_key requerido';
  end if;
  if p_tipo in ('extract_local', 'extract_openai', 'chunk', 'embed') then
    raise exception using errcode = '55000',
      message = 'El pipeline de extracción propia fue retirado; el retrieval usa la cascada de OpenAI.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || p_idempotency_key, 0)
  );
  select * into v_trabajo
  from public.ingestion_jobs
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if v_trabajo.id is not null then return v_trabajo; end if;

  insert into public.ingestion_jobs (
    tenant_id, upload_session_id, file_version_id, job_type, idempotency_key, payload
  ) values (
    p_tenant_id, p_upload_session_id, p_file_version_id, p_tipo,
    p_idempotency_key, coalesce(p_payload, '{}'::jsonb)
  ) returning * into v_trabajo;

  v_cola := case p_tipo
    when 'hash_file' then 'file-hashing'
    when 'cleanup' then 'file-cleanup'
    when 'openai_sync' then 'openai-sync'
    when 'vs_warmup' then 'vs-warmup'
    when 'blob_gc' then 'file-cleanup'
  end;
  perform pgmq.send(v_cola, jsonb_build_object('job_id', v_trabajo.id));
  return v_trabajo;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Cancelar trabajos pendientes del pipeline retirado y normalizar estados
-- ---------------------------------------------------------------------------

update public.ingestion_jobs
set status = 'cancelled', completed_at = now(), locked_at = null, locked_by = null
where job_type in ('extract_local', 'extract_openai', 'chunk', 'embed')
  and status in ('pending', 'retry', 'processing');

-- Archivos que quedaron a medio indexar: ya están materializados en Storage,
-- por lo que bajo el nuevo modelo están listos.
update public.files
set status = 'ready'
where status in ('pending', 'processing', 'partial_error')
  and deleted_at is null
  and current_version_id is not null;

update public.file_blobs
set processing_status = 'ready'
where processing_status in ('pending', 'processing', 'partial_error')
  and deleted_at is null;

update public.upload_sessions
set status = 'ready', completed_at = coalesce(completed_at, now())
where result_file_id is not null
  and status in ('extracting', 'waiting_provider', 'chunking', 'embedding');

-- ---------------------------------------------------------------------------
-- 4. Retirar colas y funciones del pipeline propio
-- ---------------------------------------------------------------------------

select pgmq.drop_queue('file-extraction');
select pgmq.drop_queue('file-chunking');
select pgmq.drop_queue('file-embedding');

drop function if exists public.search_authorized_chunks(uuid, uuid, uuid[], uuid[], uuid, text, extensions.vector, integer);
drop function if exists public.finalizar_extraccion_openai_documental(text, text, jsonb, jsonb);
drop function if exists public.finalizar_indexacion_documental(uuid);
drop function if exists public.registrar_webhook_documental(text, text, text, jsonb);

-- ---------------------------------------------------------------------------
-- 5. Backfill de sincronización: blobs vivos y referenciados sin File en
--    OpenAI. La cascada (nivel 3) cubriría igual cualquier omisión.
-- ---------------------------------------------------------------------------

do $$
declare
  v_blob record;
begin
  for v_blob in
    select b.id, b.tenant_id
    from public.file_blobs b
    where b.deleted_at is null
      and b.refcount > 0
      and b.openai_file_id is null
      and b.detected_mime not like 'image/%'
    limit 500
  loop
    perform public.encolar_trabajo_ingesta_documental(
      v_blob.tenant_id,
      null,
      null,
      'openai_sync',
      format('openaisync:%s', v_blob.id),
      jsonb_build_object('blob_id', v_blob.id)
    );
  end loop;
end $$;
