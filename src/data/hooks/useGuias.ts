import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  guardar_progreso_guia,
  obtener_progreso_guia,
} from '@/data/api/guias.api'
import { qk } from '@/data/query/keys'

export function useProgresoGuia(
  clave: string,
  version: number,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.guia(clave, version),
    queryFn: () => obtener_progreso_guia(clave, version),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useGuardarProgresoGuia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: guardar_progreso_guia,
    onSuccess: (_, input) =>
      queryClient.invalidateQueries({
        queryKey: qk.guia(input.clave, input.version),
      }),
  })
}
