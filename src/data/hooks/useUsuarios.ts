import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  assignUsuarioRole,
  createUsuario,
  createUsuarioDirecto,
  darDeBajaUsuario,
  reasignarResponsabilidades,
  removeUsuarioRole,
  reactivarUsuario,
  reenviarInvitacion,
} from '../api/usuarios.api'
import { qk } from '../query/keys'
import {
  usuarioRelacionesOptions,
  usuariosCatalogosOptions,
  usuariosOptions,
} from '../query/queryOptions'

import type {
  AssignUsuarioRoleInput,
  CreateUsuarioDirectoInput,
  CreateUsuarioInput,
  ReasignarInput,
} from '../api/usuarios.api'

export function useUsuarios() {
  return useQuery(usuariosOptions())
}

export function useUsuariosCatalogos() {
  return useQuery(usuariosCatalogosOptions())
}

export function useUsuarioRelaciones(id: string | null) {
  return useQuery({
    ...usuarioRelacionesOptions(id ?? ''),
    enabled: !!id,
  })
}

export function useCreateUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUsuarioInput) => createUsuario(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() })
    },
  })
}

export function useDarDeBajaUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => darDeBajaUsuario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() })
    },
  })
}

export function useReactivarUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reactivarUsuario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() })
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() })
    },
  })
}

export function useAssignUsuarioRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AssignUsuarioRoleInput) => assignUsuarioRole(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.meProfile() })
      queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() })
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
      queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() })
    },
  })
}

export function useReasignarResponsabilidades() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ReasignarInput) => reasignarResponsabilidades(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.meProfile() })
      queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() })
      queryClient.invalidateQueries({ queryKey: ['usuarios', 'relaciones'] })
    },
  })
}
