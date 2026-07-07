import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  PAQUETE_TIPO_LABEL,
  paquetes_exportar,
  paquetes_get_download_url,
} from '../api/paquetes.api'
import { qk } from '../query/keys'
import { asignaturaPaquetesOptions } from '../query/queryOptions'

import type { ExportarPaquetePayload } from '../api/paquetes.api'
import type { UUID } from '../types/domain'
import type { Tables } from '@/types/supabase'

import { notify } from '@/lib/toast'

export function useAsignaturaPaquetes(asignaturaId: UUID | null | undefined) {
  return useQuery({
    ...asignaturaPaquetesOptions(asignaturaId as UUID),
    enabled: Boolean(asignaturaId),
  })
}

export function useExportarPaquete(asignaturaId: UUID) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: Omit<ExportarPaquetePayload, 'asignaturaId'>) =>
      paquetes_exportar({ ...payload, asignaturaId }),
    onSuccess: (paquete) => {
      qc.invalidateQueries({ queryKey: qk.asignaturaPaquetes(asignaturaId) })
      // El PPTX actualiza archivo_path del outline correspondiente.
      qc.invalidateQueries({ queryKey: qk.asignaturaRecursos(asignaturaId) })
      notify.success(`${PAQUETE_TIPO_LABEL[paquete.tipo]} listo.`)
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo exportar el paquete.' })
    },
  })
}

export function useDescargarPaquete() {
  return useMutation({
    mutationFn: async (paquete: Tables<'learning_packages'>) => {
      const url = await paquetes_get_download_url(paquete)
      const link = document.createElement('a')
      link.href = url
      link.download = paquete.archivo_nombre ?? ''
      document.body.appendChild(link)
      link.click()
      link.remove()
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo descargar el paquete.' })
    },
  })
}
