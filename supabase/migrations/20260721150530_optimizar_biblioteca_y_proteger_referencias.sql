-- La biblioteca se consulta en una sola operación autorizada y paginada. La
-- función es interna para Edge Functions: los clientes no pueden omitir la
-- capa de datos ni elegir otro usuario o tenant.
create or replace function public.listar_biblioteca_documental(
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
      f.created_at,
      f.updated_at,
      f.current_version_id,
      fus.last_viewed_at,
      fus.last_used_at,
      fus.pinned_at,
      fus.archived_at
    from public.files f
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
    v.created_at,
    v.updated_at,
    v.current_version_id,
    v.last_viewed_at,
    v.last_used_at,
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

revoke all on function public.listar_biblioteca_documental(
  uuid, uuid, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.listar_biblioteca_documental(
  uuid, uuid, text, text, integer, integer
) to service_role;

-- Una referencia que ya formó parte de una petición de IA es evidencia. Se
-- puede seguir consultando, pero no retirarla del chat ni borrar el archivo
-- lógico que fija la versión utilizada.
create or replace function private.documentos_impedir_retiro_referencia_usada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retirando boolean;
begin
  if tg_op = 'DELETE' then
    v_retirando := true;
  else
    v_retirando := old.removed_at is null and new.removed_at is not null;
  end if;

  if v_retirando and exists (
    select 1
    from public.ai_request_references ar
    where ar.tenant_id = old.tenant_id
      and ar.conversation_type = old.conversation_type
      and ar.conversation_id = old.conversation_id
      and ar.file_id = old.file_id
  ) then
    raise exception using
      errcode = '55000',
      message = 'la referencia ya fue utilizada por una petición de IA';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_conversation_files_referencia_usada
  on public.conversation_files;
create trigger trg_conversation_files_referencia_usada
before update of removed_at or delete on public.conversation_files
for each row execute function private.documentos_impedir_retiro_referencia_usada();

create or replace function private.documentos_impedir_borrado_archivo_usado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    (old.deleted_at is null and new.deleted_at is not null)
    or (old.status <> 'deleted' and new.status = 'deleted')
  ) and (
    exists (
      select 1
      from public.ai_request_references ar
      where ar.tenant_id = old.tenant_id
        and ar.file_id = old.id
    )
    or exists (
      select 1
      from public.message_file_references mr
      where mr.tenant_id = old.tenant_id
        and mr.file_id = old.id
    )
  ) then
    raise exception using
      errcode = '55000',
      message = 'el archivo ya fue utilizado y debe conservarse para trazabilidad';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_files_archivo_usado on public.files;
create trigger trg_files_archivo_usado
before update of deleted_at, status on public.files
for each row execute function private.documentos_impedir_borrado_archivo_usado();
