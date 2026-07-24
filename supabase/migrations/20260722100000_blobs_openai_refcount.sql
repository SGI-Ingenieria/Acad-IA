-- OpenAI como caché reconstruible del acervo documental: cada blob físico
-- registra su File de OpenAI (si existe) y un contador de referencias lógicas
-- que gobierna la recolección de basura. Storage sigue siendo la única fuente
-- de verdad; perder openai_file_id nunca pierde datos.

-- ---------------------------------------------------------------------------
-- 1. Caché de OpenAI Files y contador de referencias en blobs
-- ---------------------------------------------------------------------------

alter table public.file_blobs
  add column if not exists openai_file_id text,
  add column if not exists openai_synced_at timestamptz,
  add column if not exists openai_sync_error text,
  add column if not exists refcount integer not null default 0,
  add column if not exists refcount_cero_desde timestamptz;

alter table public.file_blobs
  drop constraint if exists file_blobs_refcount_no_negativo;
alter table public.file_blobs
  add constraint file_blobs_refcount_no_negativo check (refcount >= 0);

comment on column public.file_blobs.openai_file_id is
  'Caché del File en OpenAI. Reconstruible: si expira o se pierde, la cascada lo vuelve a subir desde Storage.';
comment on column public.file_blobs.refcount is
  'Referencias lógicas activas (versiones de archivos no eliminados). Lo mantienen triggers; 0 sostenido habilita GC.';

create index if not exists file_blobs_gc_candidatos_idx
  on public.file_blobs (refcount_cero_desde)
  where refcount = 0 and refcount_cero_desde is not null and deleted_at is null;

-- El unique absoluto impediría volver a subir un contenido cuyo blob fue
-- recolectado (tombstone con deleted_at). Se sustituye por unicidad parcial
-- sobre blobs vivos, que es lo que consulta la materialización.
alter table public.file_blobs
  drop constraint if exists file_blobs_tenant_id_sha256_size_bytes_key;
create unique index if not exists file_blobs_vivos_por_contenido_idx
  on public.file_blobs (tenant_id, sha256, size_bytes)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Uso reciente y procedencia del archivo lógico
-- ---------------------------------------------------------------------------

alter table public.files
  add column if not exists last_used_at timestamptz,
  add column if not exists source text not null default 'upload';

alter table public.files
  drop constraint if exists files_source_valido;
alter table public.files
  add constraint files_source_valido check (source in ('upload', 'note'));

-- La procedencia viaja con la sesión de carga (las notas creadas in-app usan
-- exactamente el mismo pipeline de subida que cualquier archivo).
alter table public.upload_sessions
  add column if not exists source text not null default 'upload';
alter table public.upload_sessions
  drop constraint if exists upload_sessions_source_valido;
alter table public.upload_sessions
  add constraint upload_sessions_source_valido check (source in ('upload', 'note'));

comment on column public.files.last_used_at is
  'Última vez que el archivo se seleccionó o usó en una generación. Alimenta "Recientes".';
comment on column public.files.source is
  'Procedencia del archivo: subida directa o nota creada en la aplicación.';

create index if not exists files_recientes_idx
  on public.files (tenant_id, last_used_at desc nulls last)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. Mantenimiento del refcount
--    Una referencia activa = una fila de file_versions cuyo archivo lógico no
--    está eliminado. Las versiones son inmutables y no se borran una a una;
--    el ciclo de vida pasa por insertar versiones y soft-eliminar archivos.
-- ---------------------------------------------------------------------------

create or replace function private.ajustar_refcount_blob(p_blob_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.file_blobs
  set refcount = refcount + p_delta,
      refcount_cero_desde = case
        when refcount + p_delta = 0 then now()
        else null
      end,
      -- Un blob que recupera referencias deja de ser candidato a GC.
      deleted_at = case
        when refcount + p_delta > 0 then null
        else deleted_at
      end
  where id = p_blob_id;
end;
$$;

create or replace function private.refcount_blob_por_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file_borrado timestamptz;
begin
  if tg_op = 'INSERT' then
    select deleted_at into v_file_borrado from public.files where id = new.file_id;
    if v_file_borrado is null then
      perform private.ajustar_refcount_blob(new.blob_id, 1);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    select deleted_at into v_file_borrado from public.files where id = old.file_id;
    if v_file_borrado is null then
      perform private.ajustar_refcount_blob(old.blob_id, -1);
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_file_versions_refcount on public.file_versions;
create trigger trg_file_versions_refcount
after insert or delete on public.file_versions
for each row execute function private.refcount_blob_por_version();

create or replace function private.refcount_blob_por_archivo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    perform private.ajustar_refcount_blob(fv.blob_id, -1)
    from public.file_versions fv
    where fv.file_id = new.id;
  elsif old.deleted_at is not null and new.deleted_at is null then
    perform private.ajustar_refcount_blob(fv.blob_id, 1)
    from public.file_versions fv
    where fv.file_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_files_refcount on public.files;
create trigger trg_files_refcount
after update of deleted_at on public.files
for each row execute function private.refcount_blob_por_archivo();

-- Backfill con el conteo real de referencias activas.
update public.file_blobs b
set refcount = coalesce(activas.total, 0),
    refcount_cero_desde = case
      when coalesce(activas.total, 0) = 0 then now()
      else null
    end
from (
  select fv.blob_id, count(*) as total
  from public.file_versions fv
  join public.files f on f.id = fv.file_id and f.deleted_at is null
  group by fv.blob_id
) activas
where activas.blob_id = b.id;

update public.file_blobs
set refcount = 0, refcount_cero_desde = now()
where refcount_cero_desde is null
  and not exists (
    select 1
    from public.file_versions fv
    join public.files f on f.id = fv.file_id and f.deleted_at is null
    where fv.blob_id = public.file_blobs.id
  );

-- ---------------------------------------------------------------------------
-- 4. Nuevos tipos de trabajo (los usan migraciones y funciones posteriores;
--    los valores de enum no pueden usarse en la misma transacción que los crea)
-- ---------------------------------------------------------------------------

alter type public.tipo_trabajo_ingesta_documental add value if not exists 'openai_sync';
alter type public.tipo_trabajo_ingesta_documental add value if not exists 'vs_warmup';
alter type public.tipo_trabajo_ingesta_documental add value if not exists 'blob_gc';
