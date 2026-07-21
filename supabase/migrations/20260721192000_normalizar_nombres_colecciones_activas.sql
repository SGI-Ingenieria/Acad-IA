-- La identidad semántica de una colección ignora mayúsculas y espacios
-- exteriores. Los nombres archivados quedan disponibles para su reutilización.
drop index if exists public.collections_personal_nombre_unique_idx;
drop index if exists public.collections_repositorio_nombre_unique_idx;

create unique index collections_personal_nombre_unique_idx
  on public.collections (tenant_id, created_by, lower(btrim(name)))
  where kind = 'collection' and status = 'active';

create unique index collections_repositorio_nombre_unique_idx
  on public.collections (tenant_id, lower(btrim(name)))
  where kind = 'curriculum_repository' and status = 'active';
