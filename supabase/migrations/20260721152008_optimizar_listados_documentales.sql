create index if not exists ai_request_references_conversation_file_idx
  on public.ai_request_references (
    tenant_id, conversation_type, conversation_id, file_id, created_at
  );

-- Devuelve asociaciones e historial de uso en una sola consulta. La función
-- conserva referencias históricas aunque una asociación antigua no exista,
-- pero aplica autorización documental antes de exponer cada archivo.
create or replace function public.listar_archivos_conversacion_documental(
  p_usuario_id uuid,
  p_tenant_id uuid,
  p_conversation_type public.tipo_conversacion_documental,
  p_conversation_id uuid
) returns table (
  file_id uuid,
  added_at timestamptz,
  active boolean,
  used boolean,
  first_used_at timestamptz,
  can_remove boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with primeros_usos as (
    select ar.file_id, min(ar.created_at) as first_used_at
    from public.ai_request_references ar
    where ar.tenant_id = p_tenant_id
      and ar.conversation_type = p_conversation_type
      and ar.conversation_id = p_conversation_id
    group by ar.file_id
  ), candidatos as (
    select cf.file_id
    from public.conversation_files cf
    where cf.tenant_id = p_tenant_id
      and cf.conversation_type = p_conversation_type
      and cf.conversation_id = p_conversation_id
    union
    select pu.file_id from primeros_usos pu
  )
  select
    c.file_id,
    coalesce(cf.added_at, pu.first_used_at) as added_at,
    (cf.file_id is null or cf.removed_at is null) as active,
    (pu.file_id is not null) as used,
    pu.first_used_at,
    (cf.file_id is not null and cf.removed_at is null and pu.file_id is null)
      as can_remove
  from candidatos c
  left join public.conversation_files cf
    on cf.tenant_id = p_tenant_id
   and cf.conversation_type = p_conversation_type
   and cf.conversation_id = p_conversation_id
   and cf.file_id = c.file_id
  left join primeros_usos pu on pu.file_id = c.file_id
  where private.documentos_usuario_puede_archivo(
    p_usuario_id,
    c.file_id,
    'view'::public.permiso_archivo_documental
  )
  order by coalesce(cf.added_at, pu.first_used_at), c.file_id
$$;

revoke all on function public.listar_archivos_conversacion_documental(
  uuid, uuid, public.tipo_conversacion_documental, uuid
) from public, anon, authenticated;
grant execute on function public.listar_archivos_conversacion_documental(
  uuid, uuid, public.tipo_conversacion_documental, uuid
) to service_role;
