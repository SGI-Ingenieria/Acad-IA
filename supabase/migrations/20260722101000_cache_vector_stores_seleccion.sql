-- Caché de vector stores de OpenAI por selección de referencias. La llave es
-- el SHA-256 del conjunto ordenado de hashes de blobs, de modo que dos
-- usuarios del mismo tenant que seleccionan el mismo contenido comparten el
-- índice. Toda la tabla es desechable: vaciarla sólo obliga a reconstruir.

create table public.vector_store_selecciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  seleccion_sha256 text not null check (seleccion_sha256 ~ '^[a-f0-9]{64}$'),
  openai_vector_store_id text,
  estado text not null default 'creando'
    check (estado in ('creando', 'listo', 'expirado', 'fallido')),
  blob_ids uuid[] not null default '{}',
  last_active_at timestamptz not null default now(),
  expires_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (tenant_id, seleccion_sha256),
  check ((estado = 'listo') = (openai_vector_store_id is not null and expires_at is not null))
);

comment on table public.vector_store_selecciones is
  'Caché reconstruible de vector stores de OpenAI por selección de blobs. Nunca es fuente de verdad.';

create index vector_store_selecciones_higiene_idx
  on public.vector_store_selecciones (expires_at)
  where estado in ('listo', 'creando');

alter table public.vector_store_selecciones enable row level security;
revoke all on table public.vector_store_selecciones from public, anon, authenticated;
grant select, insert, update, delete on table public.vector_store_selecciones to service_role;
