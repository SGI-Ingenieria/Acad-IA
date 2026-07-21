-- Storage evalúa sus políticas con el rol del usuario. La bitácora documental
-- permanece privada y esta función expone únicamente la decisión booleana
-- necesaria para autorizar el objeto temporal de la sesión vigente.
create or replace function public.puede_usar_carga_documental_temporal(
  p_object_name text,
  p_incluir_subido boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.upload_sessions s
    where s.user_id = (select auth.uid())
      and s.temporary_path = p_object_name
      and (
        s.status in ('created', 'uploading')
        or (p_incluir_subido and s.status = 'uploaded')
      )
      and s.expires_at > now()
  )
$$;

revoke all on function public.puede_usar_carga_documental_temporal(text, boolean)
  from public, anon;
grant execute on function public.puede_usar_carga_documental_temporal(text, boolean)
  to authenticated, service_role;

drop policy if exists documentos_academicos_upload_temporal on storage.objects;
create policy documentos_academicos_upload_temporal
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos-academicos'
  and public.puede_usar_carga_documental_temporal(name, false)
);

drop policy if exists documentos_academicos_reanudar_temporal on storage.objects;
create policy documentos_academicos_reanudar_temporal
on storage.objects for update to authenticated
using (
  bucket_id = 'documentos-academicos'
  and public.puede_usar_carga_documental_temporal(name, false)
)
with check (
  bucket_id = 'documentos-academicos'
  and public.puede_usar_carga_documental_temporal(name, false)
);

drop policy if exists documentos_academicos_leer_temporal on storage.objects;
create policy documentos_academicos_leer_temporal
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos-academicos'
  and public.puede_usar_carga_documental_temporal(name, true)
);

