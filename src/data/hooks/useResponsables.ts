import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { responsable_add, responsable_remove } from '../api/responsables.api'
import { qk } from '../query/keys'
import {
  asignaturasAsignablesOptions,
  responsablesAsignaturaOptions,
} from '../query/queryOptions'

import type { RolResponsable } from '../api/responsables.api'

export function useResponsablesAsignatura(asignaturaId: string | null) {
  return useQuery({
    ...responsablesAsignaturaOptions(asignaturaId ?? ''),
    enabled: !!asignaturaId,
  })
}

export function useAsignaturasAsignables(enabled = true) {
  return useQuery({ ...asignaturasAsignablesOptions(), enabled })
}

function useResponsableInvalidations() {
  const queryClient = useQueryClient()
  return (asignaturaId: string) => {
    queryClient.invalidateQueries({
      queryKey: qk.responsablesAsignatura(asignaturaId),
    })
    // El auto-grant del rol PROFESOR cambia roles/materias del usuario.
    queryClient.invalidateQueries({ queryKey: qk.usuarios() })
    queryClient.invalidateQueries({ queryKey: ['usuarios', 'relaciones'] })
  }
}

export function useAddResponsable() {
  const invalidate = useResponsableInvalidations()
  return useMutation({
    mutationFn: (input: {
      asignaturaId: string
      usuarioId: string
      rol: RolResponsable
    }) => responsable_add(input),
    onSuccess: (_data, variables) => invalidate(variables.asignaturaId),
  })
}

export function useRemoveResponsable() {
  const invalidate = useResponsableInvalidations()
  return useMutation({
    mutationFn: (input: { id: string; asignaturaId: string }) =>
      responsable_remove(input.id),
    onSuccess: (_data, variables) => invalidate(variables.asignaturaId),
  })
}
