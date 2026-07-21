-- Sistema documental académico: contenido inmutable, referencias versionadas y
-- trabajos durables procesados exclusivamente por Edge Functions y Postgres.

create schema if not exists extensions;
create schema if not exists pgmq;
create extension if not exists vector with schema extensions;
create extension if not exists pgmq with schema pgmq;

do $$
begin
  create type public.estado_sesion_carga_documento as enum (
    'created', 'uploading', 'uploaded', 'hashing', 'deduplicating',
    'extracting', 'waiting_provider', 'chunking', 'embedding', 'ready',
    'failed', 'expired'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.estado_procesamiento_documento as enum (
    'pending', 'processing', 'ready', 'partial_error', 'failed', 'deleted'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.permiso_archivo_documental as enum ('view', 'use', 'manage');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.tipo_sujeto_archivo_documental as enum (
    'user', 'role', 'plan', 'subject', 'conversation', 'tenant'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.tipo_trabajo_ingesta_documental as enum (
    'hash_file', 'extract_local', 'extract_openai', 'chunk', 'embed', 'cleanup'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.estado_trabajo_ingesta_documental as enum (
    'pending', 'processing', 'completed', 'retry', 'dead_letter', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.tipo_conversacion_documental as enum ('plan', 'asignatura');
exception when duplicate_object then null;
end $$;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  nombre text not null check (btrim(nombre) <> ''),
  created_at timestamptz not null default now()
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.usuarios_app(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create unique index tenant_memberships_one_default_per_user_idx
  on public.tenant_memberships (user_id) where is_default;

insert into public.tenants (slug, nombre)
values ('acad-ia', 'Acad-IA')
on conflict (slug) do nothing;

insert into public.tenant_memberships (tenant_id, user_id, is_default)
select t.id, u.id, true
from public.tenants t
cross join public.usuarios_app u
where t.slug = 'acad-ia'
on conflict (tenant_id, user_id) do update set is_default = true;

create or replace function private.asignar_tenant_predeterminado_a_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_memberships (tenant_id, user_id, is_default)
  select id, new.id, true
  from public.tenants
  where slug = 'acad-ia'
  on conflict (tenant_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_usuarios_app_tenant_predeterminado on public.usuarios_app;
create trigger trg_usuarios_app_tenant_predeterminado
after insert on public.usuarios_app
for each row execute function private.asignar_tenant_predeterminado_a_usuario();

create or replace function private.tenant_documental_predeterminado(p_usuario_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.tenant_id
  from public.tenant_memberships m
  where m.user_id = p_usuario_id and m.is_default
  limit 1
$$;

create table public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  user_id uuid not null references public.usuarios_app(id) on delete restrict,
  temporary_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  declared_mime text not null,
  declared_size bigint not null check (declared_size > 0 and declared_size <= 20971520),
  client_sha256 text check (client_sha256 is null or client_sha256 ~ '^[a-f0-9]{64}$'),
  status public.estado_sesion_carga_documento not null default 'created',
  result_file_id uuid,
  error_code text,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (temporary_path ~ '^tmp/[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+$')
);
create index upload_sessions_pending_idx
  on public.upload_sessions (tenant_id, status, expires_at)
  where status not in ('ready', 'failed', 'expired');

create table public.file_blobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  detected_mime text not null,
  storage_bucket text not null default 'documentos-academicos',
  storage_path text not null unique,
  processing_status public.estado_procesamiento_documento not null default 'pending',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, sha256, size_bytes),
  check (storage_path ~ '^content/[0-9a-f-]+/[a-f0-9]{2}/[a-f0-9]{64}$')
);
create index file_blobs_gc_idx
  on public.file_blobs (deleted_at) where deleted_at is not null;

create table public.files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  display_name text not null check (btrim(display_name) <> ''),
  description text,
  current_version_id uuid,
  created_by uuid not null references public.usuarios_app(id) on delete restrict,
  status public.estado_procesamiento_documento not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.upload_sessions
  add constraint upload_sessions_result_file_fk
  foreign key (result_file_id) references public.files(id) on delete set null;
create index files_tenant_visible_idx
  on public.files (tenant_id, updated_at desc)
  where deleted_at is null;

create table public.file_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  file_id uuid not null references public.files(id) on delete restrict,
  blob_id uuid not null references public.file_blobs(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  original_filename text not null,
  uploaded_by uuid not null references public.usuarios_app(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (file_id, version_number),
  unique (tenant_id, id)
);
alter table public.files
  add constraint files_current_version_fk
  foreign key (current_version_id) references public.file_versions(id)
  deferrable initially deferred;
create index file_versions_file_idx on public.file_versions (file_id, version_number desc);
create index file_versions_blob_idx on public.file_versions (blob_id);

create table public.file_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  file_id uuid not null references public.files(id) on delete cascade,
  subject_type public.tipo_sujeto_archivo_documental not null,
  subject_id uuid not null,
  permission public.permiso_archivo_documental not null,
  granted_by uuid not null references public.usuarios_app(id) on delete restrict,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (file_id, subject_type, subject_id, permission)
);
create index file_grants_lookup_idx
  on public.file_grants (tenant_id, subject_type, subject_id, permission)
  where expires_at is null;

create table public.file_user_state (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.usuarios_app(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  last_viewed_at timestamptz,
  last_used_at timestamptz,
  pinned_at timestamptz,
  archived_at timestamptz,
  primary key (tenant_id, user_id, file_id)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  description text,
  created_by uuid not null references public.usuarios_app(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.collection_files (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  added_by uuid not null references public.usuarios_app(id) on delete restrict,
  added_at timestamptz not null default now(),
  primary key (collection_id, file_id)
);
create index collection_files_file_idx on public.collection_files (tenant_id, file_id);

create table public.conversation_files (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_type public.tipo_conversacion_documental not null,
  conversation_id uuid not null,
  file_id uuid not null references public.files(id) on delete cascade,
  added_by uuid not null references public.usuarios_app(id) on delete restrict,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (conversation_type, conversation_id, file_id)
);
create index conversation_files_active_idx
  on public.conversation_files (tenant_id, conversation_type, conversation_id)
  where removed_at is null;

create table public.message_file_references (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  message_type public.tipo_conversacion_documental not null,
  message_id uuid not null,
  file_id uuid not null references public.files(id) on delete restrict,
  file_version_id uuid not null references public.file_versions(id) on delete restrict,
  reference_mode text not null check (reference_mode in ('direct', 'retrieval')),
  created_at timestamptz not null default now(),
  primary key (message_type, message_id, file_id, file_version_id)
);
create index message_file_references_file_idx
  on public.message_file_references (tenant_id, file_id, created_at desc);

create table public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  file_version_id uuid not null references public.file_versions(id) on delete cascade,
  provider text not null check (provider in ('local', 'openai')),
  provider_response_id text,
  page_from integer check (page_from is null or page_from >= 1),
  page_to integer check (page_to is null or page_to >= page_from),
  status text not null check (status in ('pending', 'processing', 'waiting_provider', 'completed', 'failed')),
  schema_version text not null,
  extracted_content jsonb,
  quality_flags jsonb not null default '[]'::jsonb,
  attempts integer not null default 0 check (attempts between 0 and 5),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique nulls not distinct (file_version_id, provider, page_from, page_to, schema_version)
);
create index document_extractions_provider_idx
  on public.document_extractions (provider_response_id)
  where provider_response_id is not null;
create unique index document_extractions_provider_response_unique_idx
  on public.document_extractions (provider, provider_response_id)
  where provider_response_id is not null;
create index document_extractions_pending_idx
  on public.document_extractions (tenant_id, status, created_at)
  where status in ('pending', 'processing', 'waiting_provider');

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  file_version_id uuid not null references public.file_versions(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  heading_path text[] not null default '{}',
  page_start integer check (page_start is null or page_start >= 1),
  page_end integer check (page_end is null or page_end >= page_start),
  text text not null check (btrim(text) <> ''),
  token_count integer not null check (token_count > 0),
  text_sha256 text not null check (text_sha256 ~ '^[a-f0-9]{64}$'),
  chunker_version text not null,
  search_vector tsvector generated always as (to_tsvector('spanish', text)) stored,
  embedding extensions.vector(1536),
  embedding_model text,
  embedding_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (file_version_id, chunk_index, chunker_version)
);
create index document_chunks_fts_idx on public.document_chunks using gin (search_vector);
create index document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;
create index document_chunks_version_idx on public.document_chunks (tenant_id, file_version_id, chunk_index);

create table public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  upload_session_id uuid references public.upload_sessions(id) on delete set null,
  file_version_id uuid references public.file_versions(id) on delete set null,
  job_type public.tipo_trabajo_ingesta_documental not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.estado_trabajo_ingesta_documental not null default 'pending',
  attempts integer not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (tenant_id, idempotency_key),
  check ((status = 'processing') = (locked_at is not null and locked_by is not null))
);
create index ingestion_jobs_claim_idx
  on public.ingestion_jobs (available_at, created_at)
  where status in ('pending', 'retry');
create index ingestion_jobs_locked_idx
  on public.ingestion_jobs (locked_at)
  where status = 'processing';

create table public.ai_request_references (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  request_id text not null,
  conversation_type public.tipo_conversacion_documental not null,
  conversation_id uuid not null,
  message_type public.tipo_conversacion_documental,
  message_id uuid,
  file_id uuid not null references public.files(id) on delete restrict,
  file_version_id uuid not null references public.file_versions(id) on delete restrict,
  mode text not null check (mode in ('direct', 'retrieval')),
  chunk_ids uuid[] not null default '{}',
  retrieval_query text,
  retrieval_scores jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (request_id, file_version_id, mode)
);
create index ai_request_references_message_idx
  on public.ai_request_references (tenant_id, message_id, created_at desc);

create table public.file_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  file_id uuid references public.files(id) on delete set null,
  actor_user_id uuid references public.usuarios_app(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index file_events_tenant_file_idx
  on public.file_events (tenant_id, file_id, created_at desc);

create table public.document_webhook_events (
  event_id text primary key,
  event_type text not null,
  provider_response_id text not null,
  payload jsonb not null,
  delivery_count integer not null default 1 check (delivery_count > 0),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);
create index document_webhook_events_response_idx
  on public.document_webhook_events (provider_response_id, received_at desc);

create or replace function private.documentos_actualizar_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_files_actualizado_en
before update on public.files
for each row execute function private.documentos_actualizar_timestamp();
create trigger trg_collections_actualizado_en
before update on public.collections
for each row execute function private.documentos_actualizar_timestamp();

create or replace function private.documentos_rechazar_cambio_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'Los originales documentales son inmutables; crea una nueva versión.';
end;
$$;

create trigger trg_file_versions_inmutables
before update on public.file_versions
for each row execute function private.documentos_rechazar_cambio_inmutable();
create trigger trg_file_events_append_only_update
before update on public.file_events
for each row execute function private.documentos_rechazar_cambio_inmutable();
create trigger trg_file_events_append_only_delete
before delete on public.file_events
for each row execute function private.documentos_rechazar_cambio_inmutable();

create or replace function private.documentos_validar_mismo_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  if tg_table_name = 'file_versions' then
    select tenant_id into v_tenant from public.files where id = new.file_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'file_version no pertenece al tenant del archivo';
    end if;
    select tenant_id into v_tenant from public.file_blobs where id = new.blob_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'blob no pertenece al tenant de la versión';
    end if;
  elsif tg_table_name = 'collection_files' then
    select tenant_id into v_tenant from public.collections where id = new.collection_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'colección no pertenece al tenant';
    end if;
    select tenant_id into v_tenant from public.files where id = new.file_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'archivo no pertenece al tenant';
    end if;
  elsif tg_table_name in ('file_grants', 'file_user_state', 'conversation_files', 'message_file_references', 'ai_request_references') then
    select tenant_id into v_tenant from public.files where id = new.file_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'archivo no pertenece al tenant';
    end if;
  elsif tg_table_name in ('document_extractions', 'document_chunks') then
    select fv.tenant_id into v_tenant from public.file_versions fv where fv.id = new.file_version_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'versión no pertenece al tenant';
    end if;
  elsif tg_table_name = 'ingestion_jobs' and new.file_version_id is not null then
    select tenant_id into v_tenant from public.file_versions where id = new.file_version_id;
    if v_tenant is distinct from new.tenant_id then
      raise exception using errcode = '23514', message = 'job no pertenece al tenant de la versión';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_file_versions_tenant
before insert on public.file_versions for each row execute function private.documentos_validar_mismo_tenant();
create trigger trg_collection_files_tenant
before insert or update on public.collection_files for each row execute function private.documentos_validar_mismo_tenant();
create trigger trg_file_grants_tenant
before insert or update on public.file_grants for each row execute function private.documentos_validar_mismo_tenant();
create trigger trg_file_user_state_tenant
before insert or update on public.file_user_state for each row execute function private.documentos_validar_mismo_tenant();
create trigger trg_conversation_files_tenant
before insert or update on public.conversation_files for each row execute function private.documentos_validar_mismo_tenant();
create trigger trg_message_file_references_tenant
before insert or update on public.message_file_references for each row execute function private.documentos_validar_mismo_tenant();
create trigger trg_ai_request_references_tenant
before insert or update on public.ai_request_references for each row execute function private.documentos_validar_mismo_tenant();
create trigger trg_document_extractions_tenant
before insert or update on public.document_extractions for each row execute function private.documentos_validar_mismo_tenant();
create trigger trg_document_chunks_tenant
before insert or update on public.document_chunks for each row execute function private.documentos_validar_mismo_tenant();
create trigger trg_ingestion_jobs_tenant
before insert or update on public.ingestion_jobs for each row execute function private.documentos_validar_mismo_tenant();

create or replace function private.documentos_otorgar_control_al_creador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.file_grants (
    tenant_id, file_id, subject_type, subject_id, permission, granted_by
  ) values (
    new.tenant_id, new.id, 'user', new.created_by, 'manage', new.created_by
  ) on conflict do nothing;
  return new;
end;
$$;
create trigger trg_files_grant_creador
after insert on public.files
for each row execute function private.documentos_otorgar_control_al_creador();

create or replace function private.documentos_usuario_puede_archivo(
  p_usuario_id uuid,
  p_file_id uuid,
  p_permiso public.permiso_archivo_documental
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with archivo as (
    select f.id, f.tenant_id, f.created_by
    from public.files f
    where f.id = p_file_id and f.deleted_at is null
  )
  select exists (
    select 1
    from archivo f
    join public.tenant_memberships tm
      on tm.tenant_id = f.tenant_id and tm.user_id = p_usuario_id
    where f.created_by = p_usuario_id
       or exists (
        select 1
        from public.file_grants g
        where g.file_id = f.id
          and g.tenant_id = f.tenant_id
          and (g.expires_at is null or g.expires_at > now())
          and (
            (p_permiso = 'view' and g.permission in ('view', 'use', 'manage'))
            or (p_permiso = 'use' and g.permission in ('use', 'manage'))
            or (p_permiso = 'manage' and g.permission = 'manage')
          )
          and (
            (g.subject_type = 'tenant' and g.subject_id = f.tenant_id)
            or (g.subject_type = 'user' and g.subject_id = p_usuario_id)
            or (g.subject_type = 'role' and exists (
              select 1 from public.usuarios_roles ur
              where ur.usuario_id = p_usuario_id and ur.rol_id = g.subject_id
            ))
            or (g.subject_type = 'plan' and public.usuario_puede_acceder_plan(p_usuario_id, g.subject_id))
            or (g.subject_type = 'subject' and exists (
              select 1
              from public.asignaturas a
              where a.id = g.subject_id
                and public.usuario_puede_acceder_plan(p_usuario_id, a.plan_estudio_id)
            ))
            or (g.subject_type = 'conversation' and (
              exists (
                select 1 from public.conversaciones_plan c
                where c.id = g.subject_id and c.creado_por = p_usuario_id
              )
              or exists (
                select 1 from public.conversaciones_asignatura c
                where c.id = g.subject_id and c.creado_por = p_usuario_id
              )
            ))
          )
       )
  )
$$;

create or replace function public.autorizar_uso_archivo_documental(
  p_usuario_id uuid,
  p_file_id uuid,
  p_permiso public.permiso_archivo_documental
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.documentos_usuario_puede_archivo(p_usuario_id, p_file_id, p_permiso)
$$;

create or replace function public.search_authorized_chunks(
  p_user_id uuid,
  p_tenant_id uuid,
  p_collection_ids uuid[] default '{}',
  p_file_ids uuid[] default '{}',
  p_conversation_id uuid default null,
  p_query_text text default '',
  p_query_embedding extensions.vector(1536) default null,
  p_limit integer default 12
) returns table (
  chunk_id uuid,
  file_id uuid,
  file_version_id uuid,
  page_start integer,
  page_end integer,
  heading_path text[],
  chunk_text text,
  lexical_rank real,
  semantic_rank real,
  rrf_score real
)
language sql
stable
security definer
set search_path = ''
as $$
  with autorizados as (
    select c.*, fv.file_id
    from public.document_chunks c
    join public.file_versions fv on fv.id = c.file_version_id
    where c.tenant_id = p_tenant_id
      and private.documentos_usuario_puede_archivo(p_user_id, fv.file_id, 'use')
      and (
        coalesce(cardinality(p_file_ids), 0) = 0
        or fv.file_id = any(p_file_ids)
      )
      and (
        coalesce(cardinality(p_collection_ids), 0) = 0
        or exists (
          select 1 from public.collection_files cf
          where cf.tenant_id = p_tenant_id
            and cf.file_id = fv.file_id
            and cf.collection_id = any(p_collection_ids)
        )
      )
      and (
        p_conversation_id is null
        or exists (
          select 1 from public.conversation_files cf
          where cf.tenant_id = p_tenant_id
            and cf.conversation_id = p_conversation_id
            and cf.file_id = fv.file_id
            and cf.removed_at is null
        )
      )
  ), puntuados as (
    select a.*,
      ts_rank_cd(a.search_vector, websearch_to_tsquery('spanish', p_query_text))::real as lexical_rank,
      case when p_query_embedding is null or a.embedding is null then 0::real
           else (1 - (a.embedding OPERATOR(extensions.<=>) p_query_embedding))::real end as semantic_rank
    from autorizados a
    where (p_query_text = '' or a.search_vector @@ websearch_to_tsquery('spanish', p_query_text))
       or p_query_embedding is not null
  ), ordenados as (
    select *,
      row_number() over (order by lexical_rank desc, id) as lexical_position,
      row_number() over (order by semantic_rank desc, id) as semantic_position
    from puntuados
  )
  select id, file_id, file_version_id, page_start, page_end, heading_path, text,
    lexical_rank, semantic_rank,
    (1.0 / (60 + lexical_position) + 1.0 / (60 + semantic_position))::real as rrf_score
  from ordenados
  order by rrf_score desc, id
  limit greatest(1, least(p_limit, 50))
$$;

create or replace function public.reclamar_trabajos_ingesta_documental(
  p_worker text,
  p_limite integer default 3,
  p_arrendamiento interval default interval '2 minutes'
) returns setof public.ingestion_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(p_worker), '') is null
     or p_limite not between 1 and 3
     or p_arrendamiento <= interval '0 seconds' then
    raise exception using errcode = '22023', message = 'Reclamación de trabajos inválida';
  end if;
  return query
  with seleccionados as (
    select j.id
    from public.ingestion_jobs j
    where ((j.status in ('pending', 'retry') and j.available_at <= now())
       or (j.status = 'processing' and j.locked_at + p_arrendamiento <= now()))
      and j.attempts < 5
    order by j.available_at, j.created_at
    limit p_limite
    for update skip locked
  )
  update public.ingestion_jobs j
  set status = 'processing', locked_at = now(), locked_by = p_worker,
      attempts = j.attempts + 1
  from seleccionados s
  where j.id = s.id
  returning j.*;
end;
$$;

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
  end;
  perform pgmq.send(v_cola, jsonb_build_object('job_id', v_trabajo.id));
  return v_trabajo;
end;
$$;

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
      p_storage_path, 'pending'
    ) returning * into v_blob;
    v_nuevo_blob := true;
  end if;

  insert into public.files (
    tenant_id, display_name, created_by, status
  ) values (
    v_sesion.tenant_id, v_sesion.original_filename, v_sesion.user_id, 'processing'
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
  set status = 'extracting', result_file_id = v_archivo.id, completed_at = now(), error_code = null
  where id = v_sesion.id;

  perform public.encolar_trabajo_ingesta_documental(
    v_sesion.tenant_id,
    null,
    v_version.id,
    'extract_local',
    format('extract:%s:local:0:0:v1', v_version.id),
    jsonb_build_object('file_id', v_archivo.id, 'blob_created', v_nuevo_blob)
  );

  file_id := v_archivo.id;
  file_version_id := v_version.id;
  blob_id := v_blob.id;
  blob_created := v_nuevo_blob;
  return next;
end;
$$;

create or replace function public.finalizar_trabajo_ingesta_documental(
  p_job_id uuid,
  p_worker text,
  p_ok boolean,
  p_error jsonb default null,
  p_reintentar_en timestamptz default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actualizados integer;
begin
  update public.ingestion_jobs
  set status = case
        when p_ok then 'completed'::public.estado_trabajo_ingesta_documental
        when attempts >= 5 then 'dead_letter'::public.estado_trabajo_ingesta_documental
        else 'retry'::public.estado_trabajo_ingesta_documental
      end,
      available_at = case when p_ok or attempts >= 5 then available_at
        else coalesce(p_reintentar_en, now() + interval '1 minute') end,
      locked_at = null,
      locked_by = null,
      last_error = case when p_ok then null else p_error end,
      completed_at = case when p_ok or attempts >= 5 then now() else null end
  where id = p_job_id
    and status = 'processing'
    and locked_by = p_worker;
  get diagnostics v_actualizados = row_count;
  return v_actualizados = 1;
end;
$$;

-- Una entrega de webhook y el reconciliador pueden observar la misma respuesta.
-- Esta transición mantiene el efecto documental (extracción, archivo y siguiente job)
-- en una sola transacción y sólo permite un ganador.
create or replace function public.finalizar_extraccion_openai_documental(
  p_response_id text,
  p_estado text,
  p_contenido jsonb default null,
  p_error jsonb default null
) returns table (
  applied boolean,
  file_id uuid,
  tenant_id uuid,
  file_version_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_extraccion public.document_extractions;
  v_archivo_id uuid;
begin
  if nullif(btrim(p_response_id), '') is null
     or p_estado not in ('completed', 'failed') then
    raise exception using errcode = '22023', message = 'Finalización de extracción inválida';
  end if;

  select * into v_extraccion
  from public.document_extractions
  where provider = 'openai' and provider_response_id = p_response_id
  for update;
  if v_extraccion.id is null then return; end if;
  if v_extraccion.status <> 'waiting_provider' then
    applied := false;
    file_id := null;
    tenant_id := v_extraccion.tenant_id;
    file_version_id := v_extraccion.file_version_id;
    return next;
    return;
  end if;

  select fv.file_id into v_archivo_id
  from public.file_versions fv
  where fv.id = v_extraccion.file_version_id;
  if v_archivo_id is null then
    raise exception using errcode = 'P0002', message = 'La extracción no tiene archivo asociado';
  end if;

  update public.document_extractions
  set status = p_estado,
      extracted_content = case when p_estado = 'completed' then p_contenido else jsonb_build_object('error', coalesce(p_error, '{}'::jsonb), 'status', p_estado) end,
      quality_flags = case when p_estado = 'completed'
        then coalesce(p_contenido->'qualityFlags', '[]'::jsonb)
        else '["provider_failed"]'::jsonb end,
      completed_at = now()
  where id = v_extraccion.id;

  if p_estado = 'completed' then
    perform public.encolar_trabajo_ingesta_documental(
      v_extraccion.tenant_id,
      null,
      v_extraccion.file_version_id,
      'chunk',
      format('chunk:%s:v1', v_extraccion.file_version_id),
      jsonb_build_object('file_id', v_archivo_id, 'extraction_id', v_extraccion.id)
    );
  else
    update public.files set status = 'partial_error' where id = v_archivo_id;
  end if;

  applied := true;
  file_id := v_archivo_id;
  tenant_id := v_extraccion.tenant_id;
  file_version_id := v_extraccion.file_version_id;
  return next;
end;
$$;

create or replace function public.registrar_webhook_documental(
  p_event_id text,
  p_event_type text,
  p_response_id text,
  p_payload jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery_count integer;
begin
  insert into public.document_webhook_events (
    event_id, event_type, provider_response_id, payload, delivery_count, received_at
  ) values (
    p_event_id, p_event_type, p_response_id, p_payload, 1, now()
  ) on conflict (event_id) do update
  set delivery_count = public.document_webhook_events.delivery_count + 1,
      event_type = excluded.event_type,
      provider_response_id = excluded.provider_response_id,
      payload = excluded.payload,
      received_at = excluded.received_at
  returning delivery_count into v_delivery_count;
  return v_delivery_count;
end;
$$;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'documentos-academicos',
  'documentos-academicos',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/markdown', 'text/csv', 'application/json',
    'image/png', 'image/jpeg', 'image/webp'
  ]
) on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists documentos_academicos_upload_temporal on storage.objects;
create policy documentos_academicos_upload_temporal
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos-academicos'
  and exists (
    select 1
    from public.upload_sessions s
    where s.user_id = (select auth.uid())
      and s.temporary_path = name
      and s.status in ('created', 'uploading')
      and s.expires_at > now()
  )
);

drop policy if exists documentos_academicos_reanudar_temporal on storage.objects;
create policy documentos_academicos_reanudar_temporal
on storage.objects for update to authenticated
using (
  bucket_id = 'documentos-academicos'
  and exists (
    select 1 from public.upload_sessions s
    where s.user_id = (select auth.uid())
      and s.temporary_path = name
      and s.status in ('created', 'uploading')
      and s.expires_at > now()
  )
)
with check (
  bucket_id = 'documentos-academicos'
  and exists (
    select 1 from public.upload_sessions s
    where s.user_id = (select auth.uid())
      and s.temporary_path = name
      and s.status in ('created', 'uploading')
      and s.expires_at > now()
  )
);

drop policy if exists documentos_academicos_leer_temporal on storage.objects;
create policy documentos_academicos_leer_temporal
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos-academicos'
  and exists (
    select 1 from public.upload_sessions s
    where s.user_id = (select auth.uid())
      and s.temporary_path = name
      and s.status in ('created', 'uploading', 'uploaded')
      and s.expires_at > now()
  )
);

-- Las colas son la fuente durable; el consumidor Edge sólo las drena.
select pgmq.create('file-hashing');
select pgmq.create('file-extraction');
select pgmq.create('file-chunking');
select pgmq.create('file-embedding');
select pgmq.create('file-cleanup');

do $$
declare
  v_signature regprocedure;
begin
  foreach v_signature in array array[
    'public.search_authorized_chunks(uuid,uuid,uuid[],uuid[],uuid,text,extensions.vector,integer)'::regprocedure,
    'public.autorizar_uso_archivo_documental(uuid,uuid,public.permiso_archivo_documental)'::regprocedure,
    'public.encolar_trabajo_ingesta_documental(uuid,uuid,uuid,public.tipo_trabajo_ingesta_documental,text,jsonb)'::regprocedure,
    'public.materializar_sesion_carga_documento(uuid,text,bigint,text,text)'::regprocedure,
    'public.reclamar_trabajos_ingesta_documental(text,integer,interval)'::regprocedure,
    'public.finalizar_trabajo_ingesta_documental(uuid,text,boolean,jsonb,timestamptz)'::regprocedure,
    'public.finalizar_extraccion_openai_documental(text,text,jsonb,jsonb)'::regprocedure,
    'public.registrar_webhook_documental(text,text,text,jsonb)'::regprocedure
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to service_role', v_signature);
  end loop;
end $$;

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'tenants', 'tenant_memberships', 'upload_sessions', 'file_blobs', 'files',
    'file_versions', 'file_grants', 'file_user_state', 'collections',
    'collection_files', 'conversation_files', 'message_file_references',
    'document_extractions', 'document_chunks', 'ingestion_jobs',
    'ai_request_references', 'file_events', 'document_webhook_events'
  ] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', v_tabla);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_tabla);
  end loop;
end $$;

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.upload_sessions enable row level security;
alter table public.file_blobs enable row level security;
alter table public.files enable row level security;
alter table public.file_versions enable row level security;
alter table public.file_grants enable row level security;
alter table public.file_user_state enable row level security;
alter table public.collections enable row level security;
alter table public.collection_files enable row level security;
alter table public.conversation_files enable row level security;
alter table public.message_file_references enable row level security;
alter table public.document_extractions enable row level security;
alter table public.document_chunks enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.ai_request_references enable row level security;
alter table public.file_events enable row level security;
alter table public.document_webhook_events enable row level security;

create or replace function public.activar_cron_documentos_academicos()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
  v_secretos integer;
begin
  select jobid into v_job_id from cron.job where jobname = 'procesar-documentos-ia-1m';
  if v_job_id is null then
    raise exception using errcode = '55000', message = 'El cron documental no está provisionado';
  end if;
  select count(*) into v_secretos
  from vault.decrypted_secrets
  where name in ('FILE_JOBS_CRON_URL', 'FILE_JOBS_CRON_PUBLISHABLE_KEY', 'FILE_JOBS_CRON_SECRET')
    and nullif(decrypted_secret, '') is not null;
  if v_secretos <> 3 then
    raise exception using errcode = '55000', message = 'Faltan secretos documentales en Vault';
  end if;
  perform cron.alter_job(job_id := v_job_id, active := true);
  return true;
end;
$$;
revoke all on function public.activar_cron_documentos_academicos() from public, anon, authenticated;
grant execute on function public.activar_cron_documentos_academicos() to service_role;

select cron.unschedule('procesar-documentos-ia-1m')
where exists (select 1 from cron.job where jobname = 'procesar-documentos-ia-1m');
-- La URL, publishable key y secreto se provisionan en Vault antes de activar
-- este cron, exactamente igual que la recuperación de generaciones de IA.
do $$
declare
  v_job_id bigint;
begin
  select cron.schedule(
    'procesar-documentos-ia-1m',
    '* * * * *',
    $cron$
      select net.http_post(
        url := (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'FILE_JOBS_CRON_URL'
        ) || '/functions/v1/process-file-jobs',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'FILE_JOBS_CRON_PUBLISHABLE_KEY'
          ),
          'apikey', (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'FILE_JOBS_CRON_PUBLISHABLE_KEY'
          ),
          'x-file-jobs-cron-secret', (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'FILE_JOBS_CRON_SECRET'
          )
        ),
        body := '{"source":"supabase-cron"}'::jsonb,
        timeout_milliseconds := 5000
      );
    $cron$
  ) into v_job_id;
  perform cron.alter_job(job_id := v_job_id, active := false);
end $$;
