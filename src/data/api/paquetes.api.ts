import { supabaseBrowser } from '../supabase/client'
import { invokeEdge } from '../supabase/invokeEdge'

import { throwIfError } from './_helpers'

import type { UUID } from '../types/domain'
import type { Database, Tables } from '@/types/supabase'

const EDGE = {
  learning_package_export: 'learning-package-export',
} as const

export const LEARNING_PACKAGES_BUCKET = 'learning-packages'

export type PaqueteTipo = Database['public']['Enums']['learning_package_tipo']
export type PaqueteEstado =
  Database['public']['Enums']['learning_package_estado']

/** Tipos exportables desde la UI (scorm_2004 está reservado, aún sin worker). */
export type PaqueteTipoExportable = Exclude<PaqueteTipo, 'scorm_2004'>

export const PAQUETES_EXPORTACION_CONTENIDO: Array<{
  value: PaqueteTipoExportable
  label: string
}> = [{ value: 'pptx_bundle', label: 'Descargar presentación' }]

export const PAQUETES_EXPORTACION_AVANZADA: Array<{
  value: PaqueteTipoExportable
  label: string
}> = [
  { value: 'scorm_1_2', label: 'Publicar en LMS' },
  { value: 'html_bundle', label: 'Publicar como sitio web' },
]

export const PAQUETE_TIPO_LABEL: Record<PaqueteTipo, string> = {
  pptx_bundle: 'Presentación',
  scorm_1_2: 'LMS',
  scorm_2004: 'LMS',
  html_bundle: 'Web',
}

export const PAQUETE_ESTADO_LABEL: Record<PaqueteEstado, string> = {
  queued: 'En cola',
  generating: 'Generando',
  ready: 'Listo',
  failed: 'Fallido',
}

export async function paquetes_list(
  asignaturaId: UUID,
): Promise<Array<Tables<'learning_packages'>>> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from('learning_packages')
    .select('*')
    .eq('asignatura_id', asignaturaId)
    .order('creado_en', { ascending: false })

  throwIfError(error)
  return data ?? []
}

export type ExportarPaquetePayload = {
  asignaturaId: UUID
  tipo: PaqueteTipoExportable
  scope: Database['public']['Enums']['learning_generation_scope']
  unidadId?: string
  temaId?: string
  incluirEstados?: Array<'generated' | 'reviewed' | 'published'>
}

export async function paquetes_exportar(
  payload: ExportarPaquetePayload,
): Promise<Tables<'learning_packages'>> {
  const result = await invokeEdge<{
    ok: boolean
    package: Tables<'learning_packages'>
  }>(EDGE.learning_package_export, payload)
  return result.package
}

/** Signed URL de descarga con el nombre de archivo original. */
export async function paquetes_get_download_url(
  paquete: Pick<Tables<'learning_packages'>, 'zip_path' | 'archivo_nombre'>,
  expiresIn = 60 * 10,
): Promise<string> {
  if (!paquete.zip_path) {
    throw new Error('El paquete no tiene archivo generado.')
  }

  const supabase = supabaseBrowser()
  const { data, error } = await supabase.storage
    .from(LEARNING_PACKAGES_BUCKET)
    .createSignedUrl(paquete.zip_path, expiresIn, {
      download: paquete.archivo_nombre ?? true,
    })

  if (error) throw error
  if (!data.signedUrl) throw new Error('No se pudo generar la URL firmada.')
  return data.signedUrl
}
