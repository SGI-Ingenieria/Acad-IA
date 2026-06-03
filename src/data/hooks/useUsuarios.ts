import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createUsuario,
  darDeBajaUsuario,
  reactivarUsuario,
} from '../api/usuarios.api'
import { qk } from '../query/keys'
import { usuariosOptions } from '../query/queryOptions'

import type { CreateUsuarioInput } from '../api/usuarios.api'

export function useUsuarios() {
  return useQuery(usuariosOptions())
}

export function useCreateUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUsuarioInput) => createUsuario(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.usuarios() }),
  })
}

export function useDarDeBajaUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => darDeBajaUsuario(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.usuarios() }),
  })
}

export function useReactivarUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reactivarUsuario(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.usuarios() }),
  })
}
