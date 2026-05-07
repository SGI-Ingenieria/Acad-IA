import { invokeEdge } from '../supabase/invokeEdge'
import type { UUID } from '../types/domain'

/**
 * Metadata “canónica” para UI (archivo OpenAI + espejo en Supabase)
 * Se apoya en tu tabla `archivos`.
 */
export type AppFile = {
  id: UUID // id interno (tabla archivos)
  openai_file_id: string // id OpenAI
  nombre: string
  mime_type: string | null
  bytes: number | null

  // espejo Supabase para preview/descarga
  ruta_storage: string | null // "bucket/path"
  signed_url?: string | null

  // auditoría/evidencia
  temporal: boolean
  notas?: string | null

  subido_en: string
}

const EDGE = {
  upload: 'openai_files_upload',
  remove: 'openai_files_delete',
} as const

/**
 * Sube archivo a OpenAI y (opcional) crea espejo en Storage
 * - El frontend NO toca Storage.
 */
export async function openai_files_upload(payload: {
  /**
   * Si tu Edge soporta multipart: manda File/Blob directo.
   * Si no, manda base64/bytes (según tu implementación).
   */
  file: File

  /** “temporal” = evidencia usada para generar plan/asignatura */
  temporal?: boolean

  /** contexto para auditoría */
  contexto?: {
    planId?: UUID
    asignaturaId?: UUID
    motivo?: 'WIZARD_PLAN' | 'WIZARD_MATERIA' | 'ADHOC'
  }

  /** si quieres forzar espejo para preview siempre */
  mirrorToSupabase?: boolean
}): Promise<AppFile> {
  return invokeEdge<AppFile>(EDGE.upload, payload)
}

/* 
export async function openai_files_delete(payload: {
  openaiFileId: string
   //si quieres borrar también espejo y registro 
  hardDelete?: boolean
}): Promise<{ ok: true }> {
  return invokeEdge<{ ok: true }>(EDGE.remove, payload)
} */
 
export async function openai_files_delete(payload: {
  archivoId: string
}): Promise<{ ok: true }> {
  return invokeEdge<{ ok: true }>('openai-files', payload, {
    method: 'DELETE',
  })
}

export async function createRepositorio(payload: {
  nombre: string
}) {
  return invokeEdge('openai-files/files', {
    action: 'create_vector_store',
    nombre: payload.nombre,
  })
}