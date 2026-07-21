-- Distingue colecciones de trabajo y repositorios institucionales sin volver a
-- introducir Vector Stores externos en el contrato del producto.
alter table public.collections
  add column if not exists kind text not null default 'collection'
  check (kind in ('collection', 'curriculum_repository'));

create index if not exists collections_tenant_kind_idx
  on public.collections (tenant_id, kind, updated_at desc)
  where status = 'active';

comment on column public.collections.kind is
  'collection: carpeta de trabajo; curriculum_repository: acervo de planeación curricular.';
