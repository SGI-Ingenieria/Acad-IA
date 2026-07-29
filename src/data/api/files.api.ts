// Módulo de documentos oficiales de plan y URLs firmadas de buckets clásicos.
// La biblioteca de referencias de IA vive en `documentos.api.ts` (files-api).
import { supabaseBrowser } from '../supabase/client'

import { getUserIdOrThrow } from './_helpers'

import type { UUID } from '../types/domain'

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

// ============================================
// Implementar descarga y previsualizacion de archivos del storage de supabase
// ============================================

const SIGNED_URL_EXPIRES_IN_SECONDS = 600
export const OFFICIAL_PLAN_DOCUMENTS_BUCKET = 'documentos-oficiales'

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
  bucket: string
  expiresIn?: number
  preview?: boolean
}): Promise<{
  signedUrl: string
  finalUrl: string
  isOfficeDoc: boolean
}> {
  const supabase = supabaseBrowser()

  const expiresIn = payload.expiresIn ?? SIGNED_URL_EXPIRES_IN_SECONDS
  const bucket = payload.bucket

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(payload.path, expiresIn, {
      download: false,
    })

  if (error) {
    console.error('Error creando signed url:', error)

    throw error
  }

  const signedUrl = String(data.signedUrl || '')

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

export async function officialPlanDocument_get_signed_url(payload: {
  path: string
  bucket?: string | null
  expiresIn?: number
  preview?: boolean
}) {
  return files_get_signed_url({
    path: payload.path,
    bucket: payload.bucket || OFFICIAL_PLAN_DOCUMENTS_BUCKET,
    expiresIn: payload.expiresIn,
    preview: payload.preview,
  })
}

export type OfficialPlanDocumentUploadResult = {
  archivoId: UUID
  bucket: string
  path: string
  nombre: string
  mime: string | null
  size: number
}

export async function uploadOfficialPlanDocument(input: {
  planId: UUID
  file: File
}): Promise<OfficialPlanDocumentUploadResult> {
  const supabase = supabaseBrowser()
  const userId = await getUserIdOrThrow(supabase)
  const safeName = sanitizeFilename(input.file.name || 'documento-oficial')
  const path = `planes/${input.planId}/${crypto.randomUUID()}-${safeName}`

  const { data: uploadData, error: storageError } = await supabase.storage
    .from(OFFICIAL_PLAN_DOCUMENTS_BUCKET)
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
      'No se pudo obtener el id del documento oficial subido desde Storage.',
    )
  }

  const { error: dbError } = await supabase.from('archivos').insert({
    id: storageObjectId,
    hash: null,
    path,
    size: input.file.size,
    creado_por: userId,
  })

  if (dbError) {
    throw new UploadSingleFileError({
      message: `BD: ${dbError.message}`,
      stage: 'db',
      archivoId: storageObjectId,
      path,
      cause: dbError,
    })
  }

  return {
    archivoId: storageObjectId,
    bucket: OFFICIAL_PLAN_DOCUMENTS_BUCKET,
    path,
    nombre: input.file.name || safeName,
    mime: input.file.type || null,
    size: input.file.size,
  }
}
