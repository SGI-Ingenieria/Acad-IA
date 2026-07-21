import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getUsuarioAvatarUrl, uploadUsuarioAvatar } from '../api/avatars.api'
import {
  assignUsuarioRole,
  createUsuario,
  createUsuarioDirecto,
  darDeBajaUsuario,
  reasignarResponsabilidades,
  removeUsuarioRole,
  reactivarUsuario,
  reenviarInvitacion,
  updateUsuarioClave,
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
    // Alta con envío de invitación: repetirla podría duplicar el correo.
    meta: { errorMessage: 'No se pudo crear el usuario.', retryable: false },
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
    // PATCH idempotente: seguro de reintentar.
    meta: { errorMessage: 'No se pudo dar de baja al usuario.' },
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
    // PATCH idempotente: seguro de reintentar.
    meta: { errorMessage: 'No se pudo reactivar al usuario.' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() })
    },
  })
}

export function useReenviarInvitacion() {
  return useMutation({
    mutationFn: (id: string) => reenviarInvitacion(id),
    // Reenviar de nuevo duplicaría el correo: sin "Reintentar" automático.
    meta: {
      errorMessage: 'No se pudo reenviar la invitación.',
      retryable: false,
    },
  })
}

export function useUpdateUsuarioClave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; clave: string }) =>
      updateUsuarioClave(input),
    // PATCH idempotente: seguro de reintentar.
    meta: { errorMessage: 'No se pudo actualizar la clave del usuario.' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
    },
  })
}

export function useCreateUsuarioDirecto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUsuarioDirectoInput) =>
      createUsuarioDirecto(input),
    // Alta directa (crea cuenta en Auth): sin "Reintentar" automático.
    meta: { errorMessage: 'No se pudo crear el usuario.', retryable: false },
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
    // Cambio de permisos con posible nombramiento (retiro del titular
    // previo): sin "Reintentar" automático.
    meta: { errorMessage: 'No se pudo asignar el rol.', retryable: false },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.meProfile() })
      queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() })
      // Un nombramiento puede afectar al titular reemplazado: refrescar relaciones.
      queryClient.invalidateQueries({ queryKey: qk.usuarioRelacionesRoot() })
    },
  })
}

export function useRemoveUsuarioRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removeUsuarioRole,
    // Cambio de permisos: sin "Reintentar" automático.
    meta: { errorMessage: 'No se pudo retirar el rol.', retryable: false },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.meProfile() })
      queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() })
    },
  })
}

/**
 * URL pública de la foto de perfil de un usuario, reactiva al cache-busting que
 * dispara {@link useUploadUsuarioAvatar}. Devuelve `null` si no hay id. Que el
 * objeto no exista en Storage no es un error: el `<Avatar>` cae a las iniciales.
 */
export function useUsuarioAvatarUrl(userId: string | null | undefined) {
  const { data: version } = useQuery({
    queryKey: qk.usuarioAvatar(userId ?? ''),
    queryFn: () => 0,
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  return userId ? getUsuarioAvatarUrl(userId, version || undefined) : null
}

export function useUploadUsuarioAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, file }: { userId: string; file: File }) =>
      uploadUsuarioAvatar(userId, file),
    // Subida a Storage: sin "Reintentar" automático.
    meta: {
      errorMessage: 'No se pudo subir la foto de perfil.',
      retryable: false,
    },
    onSuccess: (_url, { userId }) => {
      // Bump del timestamp → todas las instancias del avatar refrescan la foto.
      queryClient.setQueryData(qk.usuarioAvatar(userId), Date.now())
    },
  })
}

export function useReasignarResponsabilidades() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ReasignarInput) => reasignarResponsabilidades(input),
    // Mueve responsabilidades origen → destino: repetirla tras un éxito
    // parcial completa lo pendiente, por eso admite "Reintentar".
    meta: {
      errorMessage: 'No se pudieron reasignar las responsabilidades.',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.usuarios() })
      queryClient.invalidateQueries({ queryKey: qk.meProfile() })
      queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() })
      queryClient.invalidateQueries({ queryKey: qk.usuarioRelacionesRoot() })
    },
  })
}
