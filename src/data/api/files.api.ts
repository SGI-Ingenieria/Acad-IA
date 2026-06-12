import { supabaseBrowser } from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import { throwIfError } from './_helpers'

import type { UUID } from '../types/domain'

export type ArchivoRow = {
  id: UUID
  created_at: string
  hash: string | null
  path: string
  openai_file_id: string | null
}

export async function files_list(params?: {
  search?: string
  limit?: number
}): Promise<Array<ArchivoRow>> {
  const supabase = supabaseBrowser()

  let q = supabase
    .from('archivos')
    .select('id,created_at,hash,path,openai_file_id')
    .order('created_at', { ascending: false })

  if (params?.search?.trim()) q = q.ilike('path', `%${params.search.trim()}%`)
  if (params?.limit) q = q.limit(params.limit)

  const { data, error } = await q
  throwIfError(error)
  return (data ?? []) as Array<ArchivoRow>
}

export class UploadSingleFileError extends Error {
  public readonly stage: 'storage' | 'db' | 'openai'
  public readonly archivoId?: string
  public readonly path?: string
  public readonly cause?: unknown

  constructor(input: {
    message: string
    stage: 'storage' | 'db' | 'openai'
    archivoId?: string
    path?: string
    cause?: unknown
  }) {
    super(input.message)
    this.name = 'UploadSingleFileError'
    this.stage = input.stage
    this.archivoId = input.archivoId
    this.path = input.path
    this.cause = input.cause
  }
}

export async function uploadOpenAIForArchivo(input: {
  archivoId: string
}): Promise<{ openaiFileId: string }> {
  const openaiFile = await invokeEdge<{ id: string }>(
    'openai-files/files',
    { archivoId: input.archivoId },
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  )

  const openaiFileId = String(openaiFile.id)
  if (!openaiFileId) {
    throw new Error('Edge Function: respuesta inválida (id de OpenAI vacío).')
  }

  return { openaiFileId }
}

export async function deleteArchivo(input: { archivoId: string }): Promise<{
  archivoId: string
  openaiFileId: string | null
  vectorStoreIds: Array<string>
}> {
  return invokeEdge<{
    archivoId: string
    openaiFileId: string | null
    vectorStoreIds: Array<string>
  }>(
    `openai-files/files/${input.archivoId}`,
    { archivoId: input.archivoId },
    { method: 'DELETE', headers: { 'Content-Type': 'application/json' } },
  )
}

const sanitizeKeySegment = (input: string): string => {
  const withoutDiacritics = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const noPathSeparators = withoutDiacritics.replace(/[\\/]+/g, '_')
  const noSpaces = noPathSeparators.replace(/\s+/g, '-')

  // Supabase Storage es estricto con keys: evitar unicode/espacios
  const asciiSafe = noSpaces.replace(/[^A-Za-z0-9._-]+/g, '_')

  return asciiSafe
    .replace(/_+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
}

const sanitizeFilename = (filename: string): string => {
  const name = filename || 'archivo'
  const lastDot = name.lastIndexOf('.')

  const base = lastDot > 0 ? name.slice(0, lastDot) : name
  const ext = lastDot > 0 ? name.slice(lastDot + 1) : ''

  const safeBase = sanitizeKeySegment(base) || 'archivo'
  const safeExt = sanitizeKeySegment(ext).toLowerCase()
  return safeExt ? `${safeBase}.${safeExt}` : safeBase
}

/**
 * Flujo canónico (frontend): Storage -> BD -> OpenAI (via Edge `openai-files`).
 * Nota: `archivos.id` referencia `storage.objects.id`, por eso usamos `uploadData.id`.
 */
export async function uploadSingleFile(input: {
  file: File
  sha256: string
}): Promise<UploadSingleFileResult> {
  const supabase = supabaseBrowser()

  const safeName = sanitizeFilename(input.file.name || 'archivo')

  const path = `${crypto.randomUUID()}-${safeName}`

  // 1) Subir a Storage
  const { data: uploadData, error: storageError } = await supabase.storage
    .from('ai-storage')
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

  const storageObjectId = String((uploadData as any)?.id ?? '')
  if (!storageObjectId) {
    throw new Error(
      'No se pudo obtener el id del objeto subido desde Storage (uploadData.id vacío).',
    )
  }

  // 2) Crear registro en BD
  const { error: dbError } = await supabase.from('archivos').insert({
    id: storageObjectId,
    hash: input.sha256,
    path,
    size: input.file.size,
  })
  if (dbError) {
    // Si el hash ya existe (carrera), usa el existente para continuar.
    if ((dbError as any)?.code === '23505') {
      const { data: existing, error: fetchErr } = await supabase
        .from('archivos')
        .select('id,path,openai_file_id')
        .eq('hash', input.sha256)
        .maybeSingle()

      if (fetchErr || !existing?.id) {
        throw new UploadSingleFileError({
          message: `BD: ${dbError.message}`,
          stage: 'db',
          archivoId: storageObjectId,
          path,
          cause: dbError,
        })
      }

      const existingOpenAI = existing.openai_file_id
        ? String(existing.openai_file_id)
        : ''

      if (existingOpenAI) {
        return {
          archivoId: String(existing.id),
          path: String(existing.path),
          openaiFileId: existingOpenAI,
        }
      }

      const { openaiFileId } = await uploadOpenAIForArchivo({
        archivoId: String(existing.id),
      })

      return {
        archivoId: String(existing.id),
        path: String(existing.path),
        openaiFileId,
      }
    }

    throw new UploadSingleFileError({
      message: `BD: ${dbError.message}`,
      stage: 'db',
      archivoId: storageObjectId,
      path,
      cause: dbError,
    })
  }

  // 3) Subir a OpenAI vía Edge Function
  try {
    const { openaiFileId } = await uploadOpenAIForArchivo({
      archivoId: storageObjectId,
    })

    return { archivoId: storageObjectId, path, openaiFileId }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Edge Function: fallo subiendo a OpenAI.'
    throw new UploadSingleFileError({
      message,
      stage: 'openai',
      archivoId: storageObjectId,
      path,
      cause: e,
    })
  }
}

// ============================================
// Implementar descarga y previsualizacion de archivos del storage de supabase
// ============================================

const SIGNED_URL_EXPIRES_IN_SECONDS = 600

// Base pública (devtunnel) hacia Kong para pruebas locales.
const LOCAL_KONG_BASE_URL = 'https://mrx7013v-54321.usw3.devtunnels.ms/'

const isLocalApp = () => {
  try {
    const host = window.location.hostname

    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return false
  }
}

const rewriteSignedUrlForLocalKong = (signedUrl: string) => {
  if (!isLocalApp()) return signedUrl

  try {
    const src = new URL(signedUrl)

    const isLocalOrigin =
      src.hostname === 'localhost' || src.hostname === '127.0.0.1'

    if (!isLocalOrigin) return signedUrl

    const base = new URL(LOCAL_KONG_BASE_URL)

    src.protocol = base.protocol
    src.hostname = base.hostname
    src.port = base.port

    return src.toString()
  } catch {
    return signedUrl
  }
}

const getBasename = (path: string) => {
  const parts = path.split('/').filter(Boolean)

  return parts.length ? parts[parts.length - 1] : path
}

const getExtension = (path: string) => {
  const base = getBasename(path)

  const dot = base.lastIndexOf('.')

  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : ''
}

const isOfficeDoc = (path: string) => {
  const ext = getExtension(path)

  return ext === 'doc' || ext === 'docx'
}

const toOfficeViewerUrl = (signedUrl: string) => {
  const url = rewriteSignedUrlForLocalKong(signedUrl)

  console.log('URL a enviar a Google:', url)

  return `https://docs.google.com/gview?url=${encodeURIComponent(
    url,
  )}&embedded=true`
}

export async function files_get_signed_url(payload: {
  path: string
  expiresIn?: number
  preview?: boolean
}): Promise<{
  signedUrl: string
  finalUrl: string
  isOfficeDoc: boolean
}> {
  const supabase = supabaseBrowser()

  const expiresIn = payload.expiresIn ?? SIGNED_URL_EXPIRES_IN_SECONDS

  const { data, error } = await supabase.storage
    .from('ai-storage')
    .createSignedUrl(payload.path, expiresIn, {
      download: false,
    })

  if (error) {
    console.error('Error creando signed url:', error)

    throw error
  }

  const signedUrl = String(data?.signedUrl || '')

  if (!signedUrl) {
    throw new Error('No se pudo generar la URL firmada.')
  }

  const office = isOfficeDoc(payload.path)

  const finalUrl =
    payload.preview && office
      ? toOfficeViewerUrl(signedUrl)
      : rewriteSignedUrlForLocalKong(signedUrl)

  return {
    signedUrl,
    finalUrl,
    isOfficeDoc: office,
  }
}

export async function files_download(payload: { path: string }) {
  const supabase = supabaseBrowser()

  const { data, error } = await supabase.storage
    .from('ai-storage')
    .download(payload.path)

  if (error) {
    console.error('Error descargando archivo:', error)

    throw error
  }

  return data
}

export type UploadSingleFileResult = {
  archivoId: UUID
  path: string
  openaiFileId: string
}
