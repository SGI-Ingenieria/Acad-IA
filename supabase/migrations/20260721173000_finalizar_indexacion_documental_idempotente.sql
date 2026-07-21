-- Cierra la indexación en una sola transacción. Si el worker cae después de
-- escribir el último embedding, un reintento puede repetir esta RPC sin dejar
-- el archivo, blob o sesión de carga permanentemente en procesamiento.
create or replace function public.finalizar_indexacion_documental(
  p_file_version_id uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file_id uuid;
  v_blob_id uuid;
  v_actualizados integer;
begin
  select fv.file_id, fv.blob_id
  into v_file_id, v_blob_id
  from public.file_versions fv
  join public.files f
    on f.id = fv.file_id
   and f.current_version_id = fv.id
   and f.deleted_at is null
  where fv.id = p_file_version_id
  for update of f;

  if v_file_id is null
     or not exists (
       select 1 from public.document_chunks c
       where c.file_version_id = p_file_version_id
     )
     or exists (
       select 1 from public.document_chunks c
       where c.file_version_id = p_file_version_id
         and c.embedding is null
     ) then
    return false;
  end if;

  update public.files
  set status = 'ready'
  where id = v_file_id
    and current_version_id = p_file_version_id
    and deleted_at is null;
  get diagnostics v_actualizados = row_count;
  if v_actualizados <> 1 then return false; end if;

  update public.file_blobs
  set processing_status = 'ready'
  where id = v_blob_id and deleted_at is null;

  update public.upload_sessions
  set status = 'ready', error_code = null, completed_at = coalesce(completed_at, now())
  where result_file_id = v_file_id
    and status not in ('failed', 'expired');

  return true;
end;
$$;

revoke all on function public.finalizar_indexacion_documental(uuid)
  from public, anon, authenticated;
grant execute on function public.finalizar_indexacion_documental(uuid)
  to service_role;
