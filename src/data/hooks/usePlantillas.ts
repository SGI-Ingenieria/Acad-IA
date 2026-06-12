import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { plantilla_delete, plantilla_upload, plantillas_list } from '../api/plantillas.api'

const qkPlantillas = (estructuraId: string) => ['plantillas', estructuraId] as const

export function usePlantillas(estructuraId: string) {
  return useQuery({
    queryKey: qkPlantillas(estructuraId),
    queryFn: () => plantillas_list(estructuraId),
    staleTime: 2 * 60_000,
  })
}

export function usePlantillasCrud(estructuraId: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qkPlantillas(estructuraId) })

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
