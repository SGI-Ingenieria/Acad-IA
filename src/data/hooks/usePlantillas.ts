import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  plantilla_delete,
  plantilla_upload,
  plantillaCategory,
  plantillas_list,
} from '../api/plantillas.api'

import type { PlantillaKind } from '../api/plantillas.api'

const qkPlantillas = (estructuraId: string, kind: PlantillaKind) =>
  ['plantillas', kind, estructuraId] as const

export function usePlantillas(
  estructuraId: string,
  opts?: { enabled?: boolean; kind?: PlantillaKind },
) {
  const kind = opts?.kind ?? 'word'
  return useQuery({
    queryKey: qkPlantillas(estructuraId, kind),
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
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: qkPlantillas(estructuraId, kind),
    })

  const upload = useMutation({
    mutationFn: plantilla_upload,
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: plantilla_delete,
    onSuccess: invalidate,
  })

  return { upload, remove }
}
