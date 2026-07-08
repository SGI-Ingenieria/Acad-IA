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
  ok: boolean
  signedUrl: string
  filename: string
}

export async function paquetes_exportar(
  payload: ExportarContenidoPayload,
): Promise<ExportarContenidoResult> {
  return invokeEdge<ExportarContenidoResult>(EDGE.learning_package_export, {
    action: 'export',
    asignaturaId: payload.asignaturaId,
    tipo: payload.tipo,
    objectIds: payload.objectIds,
  })
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
