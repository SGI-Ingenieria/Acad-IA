// avatars.api.ts
//
// Fotos de perfil de usuario. Viven en el bucket público `avatars` de Supabase
// Storage en una ruta determinista por id de usuario (sin columna en la BD ni
// image proxy). Para mostrarlas basta construir la URL pública; cuando el objeto
// no existe, el componente `Avatar` cae al fallback de iniciales.
//
// Requiere ejecutar una vez `supabase/setup/avatars-bucket.sql` (crea el bucket
// público y las políticas de lectura/escritura).

import { supabaseBrowser } from '../supabase/client'

const BUCKET = 'avatars'

/** Ruta del objeto dentro del bucket. Determinista para poder sobrescribir. */
function avatarObjectPath(userId: string): string {
  return userId
}

/**
 * URL pública de la foto de un usuario. `version` (timestamp) se anexa como
 * query param para invalidar la caché del navegador tras una nueva subida.
 */
export function getUsuarioAvatarUrl(
  userId: string,
  version?: number | string,
): string | null {
  const { data } = supabaseBrowser()
    .storage.from(BUCKET)
    .getPublicUrl(avatarObjectPath(userId))
  if (!data.publicUrl) return null
  return version ? `${data.publicUrl}?v=${version}` : data.publicUrl
}

/**
 * Sube (o reemplaza) la foto de perfil de un usuario y devuelve la URL pública
 * ya con cache-busting. Lanza si Storage devuelve error.
 */
export async function uploadUsuarioAvatar(
  userId: string,
  file: File,
): Promise<string> {
  const { error } = await supabaseBrowser()
    .storage.from(BUCKET)
    .upload(avatarObjectPath(userId), file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
    })
  if (error) throw new Error(error.message)
  return getUsuarioAvatarUrl(userId, Date.now()) ?? ''
}
