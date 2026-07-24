import { useMutation, useQuery } from '@tanstack/react-query'

import { paquetes_exportar, paquetes_previsualizar } from '../api/paquetes.api'
import { qk } from '../query/keys'

import type {
  ExportarContenidoPayload,
  PaqueteTipo,
  PrevisualizarContenidoPayload,
} from '../api/paquetes.api'
import type { UUID } from '../types/domain'

/**
 * Vista previa de contenidos. Es una lectura (render idempotente en el
 * servidor, sin efectos persistentes), así que se modela como query: se
 * dispara declarativamente con `enabled` al abrir el modal, se cachea por
 * recurso y reintenta con la política estándar de queries.
 */
export function usePrevisualizarContenido(
  payload: PrevisualizarContenidoPayload | null,
) {
  return useQuery({
    queryKey: qk.paquetePreview(
      payload?.asignaturaId ?? '',
      payload?.objectIds ?? [],
    ),
    queryFn: () =>
      paquetes_previsualizar(payload as PrevisualizarContenidoPayload),
    enabled: Boolean(payload && payload.objectIds.length > 0),
    // El HTML cambia cuando el recurso se regenera y nadie invalida esta
    // familia: se muestra la caché al instante y se revalida en cada apertura.
    staleTime: 0,
    meta: { errorMessage: 'No se pudo cargar la vista previa.' },
  })
}

export function useExportarContenido(asignaturaId: UUID) {
  return useMutation({
    mutationFn: (payload: Omit<ExportarContenidoPayload, 'asignaturaId'>) =>
      paquetes_exportar({ ...payload, asignaturaId }),
    // El paquete lo produce el servidor: pending visible, sin optimismo.
    // Reexportar es seguro (regenera el mismo artefacto), así que el toast
    // global ofrece "Reintentar" y al completar vuelve a lanzar la descarga.
    meta: { errorMessage: 'No se pudo exportar el contenido.' },
    onSuccess: (data) => {
      const objectUrl = URL.createObjectURL(data.blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = data.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
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
