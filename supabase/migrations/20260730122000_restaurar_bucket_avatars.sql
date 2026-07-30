-- La consolidación de migraciones conservó las políticas de Storage, pero no
-- la fila que materializa el bucket requerido por avatars.api.ts.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

drop policy if exists "avatars_public_read" on storage.objects;

create policy "avatars_public_read"
  on storage.objects
  for select
  using (bucket_id = 'avatars');
