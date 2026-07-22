-- Trabajos documentales v2: sincronización a OpenAI Files, pre-calentamiento
-- de vector stores por selección y recolección de basura de blobs. Nada de
-- esto vive en el camino crítico del usuario: son colas drenadas por el
-- worker (process-file-jobs) y un cron de higiene diario.

create extension if not exists pgcrypto with schema extensions;

select pgmq.create('openai-sync');
select pgmq.create('vs-warmup');

-- ---------------------------------------------------------------------------
-- 1. Encolado: mapear los nuevos tipos a sus colas
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
    when 'extract_local' then 'file-extraction'
    when 'extract_openai' then 'file-extraction'
    when 'chunk' then 'file-chunking'
    when 'embed' then 'file-embedding'
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
-- 2. Pre-calentamiento de una selección de referencias
--    Idempotente y barato: el picker lo dispara en cada cambio de selección.
--    Sólo considera blobs de documentos (las imágenes van directo a visión).
-- ---------------------------------------------------------------------------

create or replace function public.solicitar_warmup_seleccion(
  p_usuario_id uuid,
  p_tenant_id uuid,
  p_file_ids uuid[] default '{}',
  p_collection_ids uuid[] default '{}'
) returns table (
  hash_seleccion text,
  estado_seleccion text,
  warmup_encolado boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blob_hashes text[];
  v_blob_ids uuid[];
  v_hash text;
  v_cache public.vector_store_selecciones;
  v_es_nueva boolean;
  v_encolado boolean := false;
begin
  -- Selección plana autorizada: archivos directos + archivos de colecciones,
  -- filtrados por permiso de uso. Los no autorizados se omiten en silencio
  -- (el orquestador de generación sí los rechaza; esto es sólo warm-up).
  with archivos_seleccion as (
    select distinct f.id
    from public.files f
    where f.tenant_id = p_tenant_id
      and f.deleted_at is null
      and (
        f.id = any(coalesce(p_file_ids, '{}'))
        or exists (
          select 1 from public.collection_files cf
          where cf.tenant_id = p_tenant_id
            and cf.file_id = f.id
            and cf.collection_id = any(coalesce(p_collection_ids, '{}'))
        )
      )
      and private.documentos_usuario_puede_archivo(p_usuario_id, f.id, 'use')
  ), blobs_documento as (
    select distinct b.id, b.sha256
    from archivos_seleccion a
    join public.files f on f.id = a.id
    join public.file_versions fv on fv.id = f.current_version_id
    join public.file_blobs b on b.id = fv.blob_id
    where b.deleted_at is null
      and b.detected_mime not like 'image/%'
  )
  select array_agg(sha256 order by sha256), array_agg(id order by sha256)
  into v_blob_hashes, v_blob_ids
  from blobs_documento;

  -- La selección cuenta como uso: alimenta "Recientes".
  update public.files f
  set last_used_at = now()
  where f.tenant_id = p_tenant_id
    and f.deleted_at is null
    and f.id = any(coalesce(p_file_ids, '{}'))
    and private.documentos_usuario_puede_archivo(p_usuario_id, f.id, 'use');

  if coalesce(cardinality(v_blob_hashes), 0) = 0 then
    return;
  end if;

  v_hash := encode(
    extensions.digest(convert_to(array_to_string(v_blob_hashes, E'\n'), 'UTF8'), 'sha256'),
    'hex'
  );

  update public.vector_store_selecciones
  set last_active_at = now(), blob_ids = v_blob_ids
  where tenant_id = p_tenant_id and seleccion_sha256 = v_hash
  returning * into v_cache;
  v_es_nueva := not found;
  if v_es_nueva then
    begin
      insert into public.vector_store_selecciones (tenant_id, seleccion_sha256, blob_ids)
      values (p_tenant_id, v_hash, v_blob_ids)
      returning * into v_cache;
    exception when unique_violation then
      v_es_nueva := false;
      update public.vector_store_selecciones
      set last_active_at = now(), blob_ids = v_blob_ids
      where tenant_id = p_tenant_id and seleccion_sha256 = v_hash
      returning * into v_cache;
    end;
  end if;

  -- Sólo se encola trabajo para selecciones nuevas o índices muertos; una
  -- selección ya en construcción no duplica trabajo. La llave de idempotencia
  -- rota por hora para permitir reconstrucciones tras fallos.
  if v_es_nueva or v_cache.estado in ('expirado', 'fallido') then
    perform public.encolar_trabajo_ingesta_documental(
      p_tenant_id,
      null,
      null,
      'vs_warmup',
      format('vswarmup:%s:%s', v_hash, to_char(now(), 'YYYYMMDDHH24')),
      jsonb_build_object('seleccion_sha256', v_hash)
    );
    if v_cache.estado in ('expirado', 'fallido') then
      update public.vector_store_selecciones
      set estado = 'creando', error = null, openai_vector_store_id = null, expires_at = null
      where id = v_cache.id;
    end if;
    v_encolado := true;
  end if;

  hash_seleccion := v_hash;
  estado_seleccion := v_cache.estado;
  warmup_encolado := v_encolado;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Recolección de basura de blobs
--    La higiene marca candidatos (refcount = 0 sostenido) y encola el borrado
--    físico; el worker confirma bajo bloqueo antes de tocar Storage/OpenAI.
-- ---------------------------------------------------------------------------

create or replace function public.preparar_blob_gc(p_blob_id uuid)
returns table (
  blob_id uuid,
  storage_bucket text,
  storage_path text,
  openai_file_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blob public.file_blobs;
begin
  select * into v_blob
  from public.file_blobs
  where id = p_blob_id
  for update;

  if v_blob.id is null then return; end if;

  -- Si el blob recuperó referencias desde que se encoló, se aborta el GC.
  if v_blob.refcount > 0 then
    update public.file_blobs set deleted_at = null where id = v_blob.id;
    return;
  end if;

  update public.file_blobs set deleted_at = coalesce(deleted_at, now())
  where id = v_blob.id;

  blob_id := v_blob.id;
  storage_bucket := v_blob.storage_bucket;
  storage_path := v_blob.storage_path;
  openai_file_id := v_blob.openai_file_id;
  return next;
end;
$$;

create or replace function public.finalizar_blob_gc(p_blob_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eliminados integer;
begin
  -- Un blob con refcount 0 sólo es referenciado por versiones de archivos
  -- soft-eliminados y nunca usados por la IA (los usados no pueden borrarse).
  -- Se purga el linaje lógico muerto junto con el blob.
  with versiones_purgadas as (
    delete from public.file_versions fv
    using public.files f
    where fv.blob_id = p_blob_id
      and f.id = fv.file_id
      and f.deleted_at is not null
    returning fv.file_id
  )
  delete from public.files f
  using (select distinct file_id from versiones_purgadas) v
  where f.id = v.file_id
    and f.deleted_at is not null
    and not exists (select 1 from public.file_versions fv where fv.file_id = f.id);

  delete from public.file_blobs
  where id = p_blob_id
    and refcount = 0
    and deleted_at is not null;
  get diagnostics v_eliminados = row_count;
  return v_eliminados = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Higiene diaria: candidatos a GC y caché de vector stores vencida
-- ---------------------------------------------------------------------------

create or replace function public.ejecutar_higiene_documental(
  p_dias_gracia_gc integer default 7
) returns table (
  blobs_encolados integer,
  selecciones_expiradas integer,
  selecciones_purgadas integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blob record;
  v_blobs integer := 0;
  v_expiradas integer;
  v_purgadas integer;
begin
  for v_blob in
    select id
    from public.file_blobs
    where refcount = 0
      and refcount_cero_desde is not null
      and refcount_cero_desde <= now() - make_interval(days => greatest(p_dias_gracia_gc, 1))
      and deleted_at is null
    limit 200
  loop
    perform public.encolar_trabajo_ingesta_documental(
      (select tenant_id from public.file_blobs where id = v_blob.id),
      null,
      null,
      'blob_gc',
      format('blobgc:%s:%s', v_blob.id, to_char(now(), 'YYYYMMDD')),
      jsonb_build_object('blob_id', v_blob.id)
    );
    v_blobs := v_blobs + 1;
  end loop;

  -- Los vector stores expiran solos en OpenAI (expires_after de 1 día);
  -- aquí sólo se refleja esa muerte para que la cascada no verifique IDs muertos.
  update public.vector_store_selecciones
  set estado = 'expirado'
  where estado = 'listo' and expires_at <= now();
  get diagnostics v_expiradas = row_count;

  delete from public.vector_store_selecciones
  where (estado in ('expirado', 'fallido') and last_active_at <= now() - interval '30 days')
     or (estado = 'creando' and created_at <= now() - interval '7 days');
  get diagnostics v_purgadas = row_count;

  blobs_encolados := v_blobs;
  selecciones_expiradas := v_expiradas;
  selecciones_purgadas := v_purgadas;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Permisos: todo es infraestructura, sólo service_role
-- ---------------------------------------------------------------------------

do $$
declare
  v_signature regprocedure;
begin
  foreach v_signature in array array[
    'public.solicitar_warmup_seleccion(uuid,uuid,uuid[],uuid[])'::regprocedure,
    'public.preparar_blob_gc(uuid)'::regprocedure,
    'public.finalizar_blob_gc(uuid)'::regprocedure,
    'public.ejecutar_higiene_documental(integer)'::regprocedure
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to service_role', v_signature);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Cron de higiene (minuto no redondo; puro SQL, sin HTTP)
-- ---------------------------------------------------------------------------

select cron.unschedule('higiene-documental-diaria')
where exists (select 1 from cron.job where jobname = 'higiene-documental-diaria');
select cron.schedule(
  'higiene-documental-diaria',
  '23 3 * * *',
  $cron$ select public.ejecutar_higiene_documental(); $cron$
);
