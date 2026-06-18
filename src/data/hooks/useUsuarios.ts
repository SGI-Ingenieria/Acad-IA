import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  assignUsuarioRole,
  createUsuario,
  createUsuarioDirecto,
  darDeBajaUsuario,
  removeUsuarioRole,
  reactivarUsuario,
  reenviarInvitacion,
} from '../api/usuarios.api'
import { qk } from '../query/keys'
import {
  usuariosCatalogosOptions,
  usuariosOptions,
} from '../query/queryOptions'

import type {
  AssignUsuarioRoleInput,
  CreateUsuarioDirectoInput,
  CreateUsuarioInput,
} from '../api/usuarios.api'

export function useUsuarios() {
  return useQuery(usuariosOptions())
}

export function useUsuariosCatalogos() {
  return useQuery(usuariosCatalogosOptions())
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

export function useReenviarInvitacion() {
  return useMutation({
    mutationFn: (id: string) => reenviarInvitacion(id),
  })
}

export function useCreateUsuarioDirecto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUsuarioDirectoInput) =>
      createUsuarioDirecto(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.usuarios() }),
  })
}

export function useAssignUsuarioRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AssignUsuarioRoleInput) => assignUsuarioRole(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.meProfile() })
    },
  })
}

export function useRemoveUsuarioRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removeUsuarioRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.meProfile() })
    },
  })
}
