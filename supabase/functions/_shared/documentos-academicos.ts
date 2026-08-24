import { HttpError } from './utils.ts'
import type { ServiceRoleClient } from './supabase.ts'

export const DOCUMENTOS_BUCKET = 'documentos-academicos'
export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const MAX_FILES_PER_MESSAGE = 5
export const MAX_FILES_PER_IMPORT = 30
export const MAX_FILES_PER_UPLOAD_BATCH = MAX_FILES_PER_IMPORT
export const MAX_TOTAL_DIRECT_INPUT = 40 * 1024 * 1024
export const DEFAULT_DOCUMENT_EXTRACTION_MODEL = 'gpt-5.6-luna'
export const MAX_PDF_PAGES = 200
export const MAX_IMAGE_DIMENSION = 12_000
export const MAX_EXTRACTED_CHARACTERS = 2_000_000

export function documentExtractionModel(configured?: string | null): string {
  return configured?.trim() || DEFAULT_DOCUMENT_EXTRACTION_MODEL
}
export const MAX_OOXML_ENTRIES = 5_000
export const MAX_OOXML_EXPANDED_BYTES = 100 * 1024 * 1024
export const MAX_CHUNKS_PER_EMBED_JOB = 32
export const MAX_EXTRACTION_PAGES_PER_JOB = 25
export const MAX_JOB_ATTEMPTS = 5

export const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'pptx',
  'xlsx',
  'txt',
  'md',
  'csv',
  'json',
  'png',
  'jpg',
  'jpeg',
  'webp',
])

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/webp',
])

export type DetectedDocument = {
  mimeType: string
  extension: string
  isOoxml: boolean
}

export async function resolveTenantId(
  supabase: ServiceRoleClient,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()
  if (error || !data?.tenant_id) {
    throw new HttpError(
      403,
      'No tienes un tenant documental asignado.',
      'DOCUMENT_TENANT_NOT_FOUND',
    )
  }
  return String(data.tenant_id)
}

export async function assertDocumentPermission(args: {
  supabase: ServiceRoleClient
  userId: string
  fileId: string
  permission: 'view' | 'use' | 'manage'
}) {
  const { data, error } = await args.supabase.rpc(
    'autorizar_uso_archivo_documental',
    {
      p_usuario_id: args.userId,
      p_file_id: args.fileId,
      p_permiso: args.permission,
    },
  )
  if (error || data !== true) {
    throw new HttpError(
      403,
      'No tienes acceso a este archivo.',
      'FILE_FORBIDDEN',
    )
  }
}

export function documentExtension(filename: string): string {
  const extension = filename.trim().toLowerCase().split('.').pop() ?? ''
  return extension === 'jpeg' ? 'jpg' : extension
}

export function validateUploadDeclaration(input: {
  filename: string
  size: number
  mimeType: string
}) {
  const extension = documentExtension(input.filename)
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new HttpError(
      422,
      'El formato del archivo no está permitido.',
      'FILE_TYPE_REJECTED',
    )
  }
  if (
    !Number.isSafeInteger(input.size) ||
    input.size < 1 ||
    input.size > MAX_FILE_BYTES
  ) {
    throw new HttpError(
      422,
      'El archivo debe pesar como máximo 20 MiB.',
      'FILE_SIZE_REJECTED',
    )
  }
  if (!ALLOWED_MIME_TYPES.has(input.mimeType.toLowerCase())) {
    throw new HttpError(
      422,
      'El MIME declarado no está permitido.',
      'FILE_MIME_REJECTED',
    )
  }
  if (/\.(ppt|docm|xlsm|pptm|zip|rar|7z|exe|js|ps1)$/i.test(input.filename)) {
    throw new HttpError(
      422,
      'El formato del archivo no está permitido.',
      'FILE_TYPE_REJECTED',
    )
  }
}

function hasPrefix(bytes: Uint8Array, prefix: Array<number>) {
  return prefix.every((value, index) => bytes[index] === value)
}

export function detectDocument(
  bytes: Uint8Array,
  filename: string,
): DetectedDocument {
  const extension = documentExtension(filename)
  if (hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mimeType: 'application/pdf', extension: 'pdf', isOoxml: false }
  }
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: 'image/png', extension: 'png', isOoxml: false }
  }
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    return { mimeType: 'image/jpeg', extension: 'jpg', isOoxml: false }
  }
  if (
    hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: 'webp', isOoxml: false }
  }
  if (hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (!['docx', 'pptx', 'xlsx'].includes(extension)) {
      throw new HttpError(
        422,
        'Sólo se permiten paquetes Office OOXML.',
        'FILE_MAGIC_REJECTED',
      )
    }
    return {
      mimeType:
        extension === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : extension === 'pptx'
            ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension,
      isOoxml: true,
    }
  }
  if (hasPrefix(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (extension === 'doc') {
      return { mimeType: 'application/msword', extension, isOoxml: false }
    }
    if (extension === 'xls') {
      return {
        mimeType: 'application/vnd.ms-excel',
        extension,
        isOoxml: false,
      }
    }
    throw new HttpError(
      422,
      'El contenido no coincide con un documento Word o Excel permitido.',
      'FILE_MAGIC_REJECTED',
    )
  }
  if (['txt', 'md', 'csv', 'json'].includes(extension)) {
    return {
      mimeType:
        extension === 'md'
          ? 'text/markdown'
          : extension === 'csv'
            ? 'text/csv'
            : extension === 'json'
              ? 'application/json'
              : 'text/plain',
      extension,
      isOoxml: false,
    }
  }
  throw new HttpError(
    422,
    'El contenido no coincide con un formato permitido.',
    'FILE_MAGIC_REJECTED',
  )
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export function canonicalContentPath(tenantId: string, hash: string) {
  return `content/${tenantId}/${hash.slice(0, 2)}/${hash}`
}

export function temporaryUploadPath(tenantId: string, sessionId: string) {
  return `tmp/${tenantId}/${sessionId}/${crypto.randomUUID()}`
}
