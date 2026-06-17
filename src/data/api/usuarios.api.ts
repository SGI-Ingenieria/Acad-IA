import { invokeEdge } from '../supabase/invokeEdge'

export type Usuario = {
  id: string
  nombre_completo: string | null
  email: string | null
  externo: boolean
  email_confirmed: boolean
  creado_en: string
  actualizado_en: string
  dado_de_baja_en: string | null
}

export type CreateUsuarioInput = {
  nombre_completo: string
  email: string
}

export function listUsuarios(): Promise<Array<Usuario>> {
  return invokeEdge<Array<Usuario>>('usuarios', undefined, { method: 'GET' })
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

export type CreateUsuarioDirectoInput = {
  nombre_completo: string
  email: string
  password: string
  clave?: string
  masterPassword: string
}

export type CreateUsuarioDirectoResult = {
  id: string
  nombre_completo: string | null
}

export function createUsuarioDirecto(
  input: CreateUsuarioDirectoInput,
): Promise<CreateUsuarioDirectoResult> {
  return invokeEdge<CreateUsuarioDirectoResult>(
    'usuarios-alta-directa',
    input as unknown as Record<string, unknown>,
    { method: 'POST' },
  )
}
