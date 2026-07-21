import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { tareas_marcar_completada, tareas_mias_list } from '../api/tasks.api'
import { mk, qk } from '../query/keys'

import type { TareaRevision, UUID } from '../types/domain'

import { optimisticMutation } from '@/lib/optimistic'

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
    ...optimisticMutation<TareaRevision, UUID>({
      queryClient: qc,
      mutationKey: mk.tareaCompletar(),
      scope: (tareaId) => tareaId,
      writes: () => [
        {
          key: qk.tareas(),
          exact: true,
          updater: (current: any, tareaId) =>
            Array.isArray(current)
              ? current.map((t: any) =>
                  t.id === tareaId
                    ? {
                        ...t,
                        estatus: 'COMPLETADA',
                        completado_en: new Date().toISOString(),
                      }
                    : t,
                )
              : current,
        },
      ],
      reconcile: (completada, _tareaId, client) => {
        client.setQueryData(qk.tareas(), (current: any) =>
          Array.isArray(current)
            ? current.map((t: any) =>
                t.id === completada.id ? { ...t, ...completada } : t,
              )
            : current,
        )
      },
      errorMessage: 'No se pudo completar la tarea.',
    }),
  })
}
