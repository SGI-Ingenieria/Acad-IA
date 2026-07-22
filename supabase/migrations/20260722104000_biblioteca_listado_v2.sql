-- El listado de biblioteca expone el tipo de contenido, tamaño y procedencia
-- (nota o subida) que la interfaz necesita para filtrar por Imágenes/Archivos
-- y mostrar el detalle de cada fila. El orden por uso ahora considera el uso
-- del archivo en generaciones (files.last_used_at), no sólo la vista personal.

drop function if exists public.listar_biblioteca_documental(uuid, uuid, text, text, integer, integer);

create function public.listar_biblioteca_documental(
  p_usuario_id uuid,
  p_tenant_id uuid,
  p_query text default null,
  p_sort text default 'updated_desc',
  p_limit integer default 100,
  p_offset integer default 0
) returns table (
  id uuid,
  display_name text,
  description text,
  status public.estado_procesamiento_documento,
  source text,
  detected_mime text,
  size_bytes bigint,
  created_at timestamptz,
  updated_at timestamptz,
  current_version_id uuid,
  last_viewed_at timestamptz,
  last_used_at timestamptz,
  pinned_at timestamptz,
  archived_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with visibles as (
    select
      f.id,
      f.display_name,
      f.description,
      f.status,
      f.source,
      b.detected_mime,
      b.size_bytes,
      f.created_at,
      f.updated_at,
      f.current_version_id,
      fus.last_viewed_at,
      greatest(
        coalesce(f.last_used_at, '-infinity'::timestamptz),
        coalesce(fus.last_used_at, '-infinity'::timestamptz)
      ) as last_used_at,
      fus.pinned_at,
      fus.archived_at
    from public.files f
    left join public.file_versions fv on fv.id = f.current_version_id
    left join public.file_blobs b on b.id = fv.blob_id
    left join public.file_user_state fus
      on fus.tenant_id = f.tenant_id
     and fus.user_id = p_usuario_id
     and fus.file_id = f.id
    where f.tenant_id = p_tenant_id
      and f.deleted_at is null
      and fus.archived_at is null
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or position(lower(btrim(p_query)) in lower(f.display_name)) > 0
      )
      and private.documentos_usuario_puede_archivo(
        p_usuario_id,
        f.id,
        'view'::public.permiso_archivo_documental
      )
  )
  select
    v.id,
    v.display_name,
    v.description,
    v.status,
    v.source,
    v.detected_mime,
    v.size_bytes,
    v.created_at,
    v.updated_at,
    v.current_version_id,
    v.last_viewed_at,
    nullif(v.last_used_at, '-infinity'::timestamptz) as last_used_at,
    v.pinned_at,
    v.archived_at,
    count(*) over() as total_count
  from visibles v
  order by
    case when p_sort = 'name_asc' then lower(v.display_name) end asc nulls last,
    case when p_sort = 'name_desc' then lower(v.display_name) end desc nulls last,
    case when p_sort = 'used_desc' then v.last_used_at end desc nulls last,
    case when p_sort = 'created_desc' then v.created_at end desc nulls last,
    case
      when p_sort = 'updated_desc'
        or p_sort not in ('name_asc', 'name_desc', 'used_desc', 'created_desc')
      then v.updated_at
    end desc nulls last,
    v.id asc
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.listar_biblioteca_documental(uuid, uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.listar_biblioteca_documental(uuid, uuid, text, text, integer, integer)
  to service_role;
