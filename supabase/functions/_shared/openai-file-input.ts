import { MAX_FILE_BYTES } from './documentos-academicos.ts'
import type { ServiceRoleClient } from './supabase.ts'
import { HttpError } from './utils.ts'

const OPENAI_FILE_DATA_MAX_CHARACTERS = 32 * 1024 * 1024
const BASE64_CHUNK_BYTES = 32 * 1024

export type OpenAIInputFile =
  | {
      type: 'input_file'
      file_data: string
      filename: string
    }
  | {
      type: 'input_image'
      image_url: string
      detail: 'auto'
    }

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK_BYTES) {
    binary += String.fromCharCode(
      ...bytes.subarray(start, start + BASE64_CHUNK_BYTES),
    )
  }
  return btoa(binary)
}

export function openAIFileData(bytes: Uint8Array, mimeType: string): string {
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new HttpError(
      422,
      'El documento excede el límite de 20 MiB.',
      'DOCUMENT_TOO_LARGE',
    )
  }
  const safeMime = /^[\w.+-]+\/[\w.+-]+$/.test(mimeType)
    ? mimeType
    : 'application/octet-stream'
  const fileData = `data:${safeMime};base64,${base64(bytes)}`
  if (fileData.length > OPENAI_FILE_DATA_MAX_CHARACTERS) {
    throw new HttpError(
      422,
      'El documento codificado excede el límite aceptado por OpenAI.',
      'DOCUMENT_ENCODED_TOO_LARGE',
    )
  }
  return fileData
}

export async function storageOpenAIInputFile(args: {
  supabase: ServiceRoleClient
  bucket: string
  path: string
  filename: string
  mimeType?: string | null
  expectedSize?: number | null
}): Promise<OpenAIInputFile> {
  const { data: blob, error } = await args.supabase.storage
    .from(args.bucket)
    .download(args.path)
  if (error || !blob) {
    throw new HttpError(
      404,
      'No se pudo leer el contenido físico del documento.',
      'DOCUMENT_BLOB_MISSING',
      error,
    )
  }
  if (
    args.expectedSize !== undefined &&
    args.expectedSize !== null &&
    blob.size !== args.expectedSize
  ) {
    throw new HttpError(
      409,
      'El tamaño físico del documento no coincide con su versión registrada.',
      'DOCUMENT_SIZE_MISMATCH',
    )
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const mimeType = (
    args.mimeType ||
    blob.type ||
    'application/octet-stream'
  ).toLowerCase()
  const fileData = openAIFileData(bytes, mimeType)

  // Responses distingue imágenes de documentos. Enviar un PNG como
  // `input_file` produce Invalid file data aunque el data URL sea válido.
  if (mimeType.startsWith('image/')) {
    return {
      type: 'input_image',
      image_url: fileData,
      detail: 'auto',
    }
  }

  return {
    type: 'input_file',
    file_data: fileData,
    filename: args.filename,
  }
}
