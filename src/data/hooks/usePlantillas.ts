import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  plantilla_delete,
  plantilla_upload,
  plantillaCategory,
  plantillas_list,
} from '../api/plantillas.api'
import { mk, qk } from '../query/keys'

import type { PlantillaKind } from '../api/plantillas.api'

import { optimisticMutation } from '@/lib/optimistic'

export function usePlantillas(
  estructuraId: string,
  opts?: { enabled?: boolean; kind?: PlantillaKind },
) {
  const kind = opts?.kind ?? 'word'
  return useQuery({
    queryKey: qk.plantillas(estructuraId, kind),
    queryFn: () => plantillas_list(plantillaCategory(estructuraId, kind)),
    staleTime: 2 * 60_000,
    enabled: opts?.enabled ?? true,
  })
}

export function usePlantillasCrud(
  estructuraId: string,
  kind: PlantillaKind = 'word',
) {
  const queryClient = useQueryClient()

  const upload = useMutation({
    mutationKey: mk.plantillaUpload(),
    mutationFn: plantilla_upload,
    // Subida de archivo: sin optimismo (el id lo genera Carbone) y sin
    // reintento automático. Las pestañas de plantillas notifican
    // éxito/fracaso con sus propios toasts, así que la red global calla.
    meta: { errorMessage: false, retryable: false },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: qk.plantillas(estructuraId, kind),
      }),
  })

  const remove = useMutation({
    mutationFn: plantilla_delete,
    ...optimisticMutation<void, string>({
      queryClient,
      mutationKey: mk.plantillaDelete(),
      scope: () => `${estructuraId}:${kind}`,
      writes: () => [
        {
          key: qk.plantillas(estructuraId, kind),
          exact: true,
          // El id efectivo que maneja la UI es `id || versionId`.
          updater: (current: any, templateId) =>
            Array.isArray(current)
              ? current.filter((t: any) => (t.id || t.versionId) !== templateId)
              : current,
        },
      ],
      errorMessage: 'No se pudo eliminar la plantilla.',
    }),
    // Las pestañas capturan el error y notifican con su propio toast: la red
    // global calla (el rollback optimista sí corre aquí).
    meta: { errorMessage: false },
  })

  return { upload, remove }
}
