import { useMutation } from '@tanstack/react-query'

import { paquetes_exportar, paquetes_previsualizar } from '../api/paquetes.api'

import type {
  ExportarContenidoPayload,
  PaqueteTipo,
  PrevisualizarContenidoPayload,
} from '../api/paquetes.api'
import type { UUID } from '../types/domain'

import { notify } from '@/lib/toast'

export function usePrevisualizarContenido() {
  return useMutation({
    mutationFn: (payload: PrevisualizarContenidoPayload) =>
      paquetes_previsualizar(payload),
    onError: (err) => {
      notify.error(err, {
        description: 'No se pudo cargar la vista previa.',
      })
    },
  })
}

export function useExportarContenido(asignaturaId: UUID) {
  return useMutation({
    mutationFn: (payload: Omit<ExportarContenidoPayload, 'asignaturaId'>) =>
      paquetes_exportar({ ...payload, asignaturaId }),
    onSuccess: (data) => {
      const link = document.createElement('a')
      link.href = data.signedUrl
      link.download = data.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo exportar el contenido.' })
    },
  })
}

export function puedeExportarComoPptx(
  objectIds: Array<string>,
  recursosPorId: Map<string, { tipo: string }>,
): boolean {
  if (objectIds.length === 0) return false
  return objectIds.every((id) => {
    const recurso = recursosPorId.get(id)
    return recurso?.tipo === 'outline_presentacion'
  })
}

export const TIPOS_DESCARGA_INDIVIDUAL: Array<{
  tipo: PaqueteTipo
  label: string
}> = [
  { tipo: 'html_bundle', label: 'Descargar como página web' },
  { tipo: 'scorm_1_2', label: 'Descargar como SCORM 1.2' },
]

export const TIPOS_DESCARGA_COLECCION: Array<{
  tipo: PaqueteTipo
  label: string
}> = [
  { tipo: 'html_bundle', label: 'Descargar como página web' },
  { tipo: 'scorm_1_2', label: 'Descargar como SCORM 1.2' },
]
