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
  roles: Array<UsuarioRol>
}

export type Rol = {
  id: string
  clave: string
  nombre: string
  descripcion: string | null
  nivel_jerarquico: number
  alcance_default: 'global' | 'facultad' | 'carrera' | 'asignatura' | 'externo'
}

export type Permiso = {
  id: string
  clave: string
  nombre: string
  descripcion: string | null
  grupo: string
  orden: number
}

export type UsuarioRol = {
  id: string
  usuario_id: string
  rol_id: string
  facultad_id: string | null
  carrera_id: string | null
  creado_en: string
  asignado_por: string | null
  roles: Rol | null
  facultades: {
    id: string
    nombre: string
    nombre_corto: string | null
    prefijo: string | null
  } | null
  carreras: {
    id: string
    nombre: string
    nombre_corto: string | null
    facultad_id: string
    nivel: string
  } | null
}

export type UsuariosCatalogos = {
  roles: Array<Rol>
  permisos: Array<Permiso>
  facultades: Array<{
    id: string
    nombre: string
    nombre_corto: string | null
    prefijo: string | null
    color: string | null
    icono: string | null
    activa: boolean
  }>
  carreras: Array<{
    id: string
    facultad_id: string
    nombre: string
    nombre_corto: string | null
    nivel: string
    activa: boolean
  }>
}

export type CreateUsuarioInput = {
  nombre_completo: string
  email: string
}

export function listUsuarios(): Promise<Array<Usuario>> {
  return invokeEdge<Array<Usuario>>('usuarios', undefined, { method: 'GET' })
}

export function getUsuariosCatalogos(): Promise<UsuariosCatalogos> {
  return invokeEdge<UsuariosCatalogos>('usuarios/catalogos', undefined, {
    method: 'GET',
  })
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

export type AssignUsuarioRoleInput = {
  usuarioId: string
  rol_id: string
  facultad_id?: string | null
  carrera_id?: string | null
}

export function assignUsuarioRole(
  input: AssignUsuarioRoleInput,
): Promise<UsuarioRol> {
  const { usuarioId, ...body } = input
  return invokeEdge<UsuarioRol>(`usuarios/${usuarioId}/roles`, body, {
    method: 'POST',
  })
}

export function removeUsuarioRole(input: {
  usuarioId: string
  asignacionId: string
}): Promise<{ id: string }> {
  return invokeEdge<{ id: string }>(
    `usuarios/${input.usuarioId}/roles/${input.asignacionId}`,
    undefined,
    { method: 'DELETE' },
  )
}

export type CreateUsuarioDirectoInput =
  | {
      type: 'internal'
      nombre_completo: string
      email: string
      clave: string
      // Solo requerida en el registro público (/registro); las llamadas
      // autenticadas (/usuarios) se autorizan por su sesión.
      masterPassword?: string
      password?: never
    }
  | {
      type: 'external'
      nombre_completo: string
      email: string
      password: string
      masterPassword?: string
      clave?: never
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
