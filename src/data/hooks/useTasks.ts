import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { tareas_marcar_completada, tareas_mias_list } from '../api/tasks.api'
import { qk } from '../query/keys'

export function useMisTareas() {
  return useQuery({
    queryKey: qk.tareas(),
    queryFn: tareas_mias_list,
    staleTime: 15_000,
  })
}

export function useMarcarTareaCompletada() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: tareas_marcar_completada,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tareas() })
    },
  })
}
