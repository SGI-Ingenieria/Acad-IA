import { supabaseBrowser } from '../supabase/client'

import { getUserIdOrThrow } from './_helpers'
import { UploadSingleFileError } from './files.api'

import type { AdjuntoComentarioInput, UUID } from '../types/domain'

export const COMMENT_ATTACHMENTS_BUCKET = 'comentarios-adjuntos'

export const MAX_COMMENT_ATTACHMENTS = 5
export const MAX_COMMENT_ATTACHMENT_BYTES = 25 * 1024 * 1024 // 25 MB

const sanitizeKeySegment = (input: string): string => {
  const withoutDiacritics = input.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const noPathSeparators = withoutDiacritics.replace(/[\\/]+/g, '_')
  const noSpaces = noPathSeparators.replace(/\s+/g, '-')
  const asciiSafe = noSpaces.replace(/[^A-Za-z0-9._-]+/g, '_')
  return asciiSafe
    .replace(/_+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
}

const sanitizeFilename = (filename: string): string => {
  const name = filename || 'adjunto'
  const lastDot = name.lastIndexOf('.')
  const base = lastDot > 0 ? name.slice(0, lastDot) : name
  const ext = lastDot > 0 ? name.slice(lastDot + 1) : ''
  const safeBase = sanitizeKeySegment(base) || 'adjunto'
  const safeExt = sanitizeKeySegment(ext).toLowerCase()
  return safeExt ? `${safeBase}.${safeExt}` : safeBase
}

/**
 * Sube un adjunto de comentario al bucket privado `comentarios-adjuntos`.
 * Ruta: comentarios/<planId>/<uuid>-<nombre>. No pasa por OpenAI.
 */
export async function uploadCommentAttachment(input: {
  planId: UUID
  file: File
}): Promise<AdjuntoComentarioInput> {
  const supabase = supabaseBrowser()
  // Asegura sesión válida (la RLS del bucket exige auth.uid()).
  await getUserIdOrThrow(supabase)

  const safeName = sanitizeFilename(input.file.name || 'adjunto')
  const path = `comentarios/${input.planId}/${crypto.randomUUID()}-${safeName}`

  const { error: storageError } = await supabase.storage
    .from(COMMENT_ATTACHMENTS_BUCKET)
    .upload(path, input.file, {
      contentType: input.file.type || undefined,
    })

  if (storageError) {
    throw new UploadSingleFileError({
      message: `Storage: ${storageError.message}`,
      stage: 'storage',
      path,
      cause: storageError,
    })
  }

  return {
    bucket: COMMENT_ATTACHMENTS_BUCKET,
    path,
    nombre: input.file.name || safeName,
    mime: input.file.type || null,
    size: input.file.size,
  }
}

/**
 * Elimina un objeto de Storage (usado al quitar un adjunto antes de enviar el
 * comentario, cuando aún no hay fila en `comentarios_adjuntos`).
 */
export async function deleteCommentAttachmentObject(input: {
  path: string
  bucket?: string
}): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase.storage
    .from(input.bucket ?? COMMENT_ATTACHMENTS_BUCKET)
    .remove([input.path])
  if (error) throw error
}
