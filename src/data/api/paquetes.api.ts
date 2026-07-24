import { supabaseBrowser, supabasePublicUrl } from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import type { UUID } from '../types/domain'

const EDGE = {
  learning_package_export: 'learning-package-export',
} as const

export const LEARNING_PACKAGES_BUCKET = 'learning-packages'

export type PaqueteTipo = 'html_bundle' | 'scorm_1_2' | 'pptx_bundle'

export const PAQUETE_TIPO_LABEL: Record<PaqueteTipo, string> = {
  html_bundle: 'Página web',
  scorm_1_2: 'SCORM 1.2',
  pptx_bundle: 'Presentación',
}

export type ExportarContenidoPayload = {
  asignaturaId: UUID
  tipo: PaqueteTipo
  objectIds: Array<string>
}

export type ExportarContenidoResult = {
  blob: Blob
  filename: string
}

/**
 * Descarga el paquete directamente desde la edge function (binario HTTP).
 * No pasa por Storage ni signed URLs — funciona en cualquier entorno.
 */
export async function paquetes_exportar(
  payload: ExportarContenidoPayload,
): Promise<ExportarContenidoResult> {
  const supabase = supabaseBrowser()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('No hay sesión activa. Inicia sesión e intenta de nuevo.')
  }

  const url = `${supabasePublicUrl()}/functions/v1/${EDGE.learning_package_export}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'export',
      asignaturaId: payload.asignaturaId,
      tipo: payload.tipo,
      objectIds: payload.objectIds,
    }),
  })

  if (!response.ok) {
    let message = `Error ${response.status}`
    try {
      const body = (await response.json()) as unknown
      if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>
        if (typeof b.message === 'string') message = b.message
        else if (typeof b.error === 'string') message = b.error
      }
    } catch {
      // ignore JSON parse errors on error body
    }
    throw new Error(message)
  }

  const blob = await response.blob()

  const contentDisposition = response.headers.get('Content-Disposition') ?? ''
  const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
  const filename =
    filenameMatch?.[1] ??
    `${payload.tipo === 'pptx_bundle' ? 'presentacion' : payload.tipo === 'scorm_1_2' ? 'scorm' : 'html'}-export.${payload.tipo === 'pptx_bundle' ? 'pptx' : 'zip'}`

  return { blob, filename }
}

export type PrevisualizarContenidoPayload = {
  asignaturaId: UUID
  objectIds: Array<string>
}

export type PrevisualizarContenidoResult = {
  ok: boolean
  html: string
  css: string
  objetos: Array<{
    id: string
    tipo: string
    titulo: string
    unidad_id: string | null
    tema_id: string | null
  }>
}

export async function paquetes_previsualizar(
  payload: PrevisualizarContenidoPayload,
): Promise<PrevisualizarContenidoResult> {
  return invokeEdge<PrevisualizarContenidoResult>(
    EDGE.learning_package_export,
    {
      action: 'preview',
      asignaturaId: payload.asignaturaId,
      objectIds: payload.objectIds,
    },
  )
}
