-- Bucket de fotos de perfil (avatars)
--
-- Ejecutar UNA vez contra la BD (hosted o local). No es una migración de esquema
-- de la app: solo crea el bucket de Storage y sus políticas. Es idempotente, así
-- que puede re-ejecutarse sin riesgo.
--
-- Modelo: las fotos viven en una ruta determinista por id de usuario
-- (`avatars/{usuario_id}`), sin columna en la BD. La URL pública se construye en
-- el cliente (`src/data/api/avatars.api.ts`); si el objeto no existe, el avatar
-- cae al fallback de iniciales.

-- 1) Bucket público (lectura vía CDN sin firmar).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- 2) Políticas sobre storage.objects acotadas al bucket 'avatars'.
--    Lectura: cualquiera. Escritura: cualquier usuario autenticado (el directorio
--    de usuarios permite a administradores fijar la foto de cualquier persona).

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_insert" on storage.objects;
create policy "avatars_authenticated_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_update" on storage.objects;
create policy "avatars_authenticated_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_delete" on storage.objects;
create policy "avatars_authenticated_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars');
