import { invokeEdge } from '../supabase/invokeEdge'

export type Usuario = {
  id: string
  nombre_completo: string | null
  email: string | null
  externo: boolean
  creado_en: string
  actualizado_en: string
  dado_de_baja_en: string | null
}

export type CreateUsuarioInput = {
  nombre_completo: string
  email: string
  externo: boolean
}

export function listUsuarios(): Promise<Usuario[]> {
  return invokeEdge<Usuario[]>('usuarios', undefined, { method: 'GET' })
}

export function createUsuario(input: CreateUsuarioInput): Promise<Usuario> {
  return invokeEdge<Usuario>('usuarios', input, { method: 'POST' })
}

export function darDeBajaUsuario(id: string): Promise<Usuario> {
  return invokeEdge<Usuario>(`usuarios/${id}/dar-de-baja`, undefined, {
    method: 'PATCH',
  })
}

export function reactivarUsuario(id: string): Promise<Usuario> {
  return invokeEdge<Usuario>(`usuarios/${id}/reactivar`, undefined, {
    method: 'PATCH',
  })
}

export function reenviarInvitacion(id: string): Promise<{ message: string }> {
  return invokeEdge<{ message: string }>(
    `usuarios/${id}/reenviar-invitacion`,
    undefined,
    { method: 'POST' },
  )
}
