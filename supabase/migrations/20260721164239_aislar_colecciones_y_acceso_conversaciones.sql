-- Las colecciones de trabajo son personales dentro del tenant. Los repositorios
-- curriculares conservan un espacio de nombres institucional y sólo se
-- comparten cuando el usuario puede consultar al menos uno de sus archivos.
alter table public.collections
  drop constraint if exists collections_tenant_id_name_key;

create unique index collections_personal_nombre_unique_idx
  on public.collections (tenant_id, created_by, name)
  where kind = 'collection';

create unique index collections_repositorio_nombre_unique_idx
  on public.collections (tenant_id, name)
  where kind = 'curriculum_repository';

create or replace function public.listar_colecciones_documentales(
  p_usuario_id uuid,
  p_tenant_id uuid
) returns table (
  id uuid,
  name text,
  description text,
  kind text,
  status text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  file_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with colecciones_candidatas as (
    select c.*
    from public.collections c
    where c.tenant_id = p_tenant_id
      and c.status = 'active'
      and exists (
        select 1
        from public.tenant_memberships tm
        where tm.tenant_id = p_tenant_id
          and tm.user_id = p_usuario_id
      )
      and (
        (c.kind = 'collection' and c.created_by = p_usuario_id)
        or c.kind = 'curriculum_repository'
      )
  ), archivos_autorizados as (
    select
      cf.collection_id,
      array_agg(cf.file_id order by cf.added_at, cf.file_id) as file_ids
    from public.collection_files cf
    join colecciones_candidatas c on c.id = cf.collection_id
    where cf.tenant_id = p_tenant_id
      and private.documentos_usuario_puede_archivo(
        p_usuario_id,
        cf.file_id,
        'view'::public.permiso_archivo_documental
      )
    group by cf.collection_id
  )
  select
    c.id,
    c.name,
    c.description,
    c.kind,
    c.status,
    c.created_by,
    c.created_at,
    c.updated_at,
    coalesce(a.file_ids, '{}'::uuid[]) as file_ids
  from colecciones_candidatas c
  left join archivos_autorizados a on a.collection_id = c.id
  where c.kind = 'collection'
     or c.created_by = p_usuario_id
     or coalesce(cardinality(a.file_ids), 0) > 0
  order by lower(c.name), c.id
$$;

comment on function public.listar_colecciones_documentales(uuid, uuid) is
  'Lista colecciones personales propias y repositorios curriculares alcanzables mediante archivos autorizados.';

revoke all on function public.listar_colecciones_documentales(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.listar_colecciones_documentales(uuid, uuid)
  to service_role;
