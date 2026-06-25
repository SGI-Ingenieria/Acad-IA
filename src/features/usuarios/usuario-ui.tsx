import type { Usuario, UsuarioRol } from '@/data/api/usuarios.api'

import { formatCarreraNombre, formatFacultadNombre } from '@/lib/facultad-utils'

export const NIVEL_ORDEN = [
  'Licenciatura',
  'Maestría',
  'Doctorado',
  'Especialidad',
  'Diplomado',
  'Otro',
] as const

export function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function getRoleName(asignacion: UsuarioRol) {
  return asignacion.roles?.nombre ?? 'Rol sin nombre'
}

export function getScopeLabel(asignacion: UsuarioRol) {
  if (asignacion.carreras) {
    return asignacion.carreras.nombre_corto ?? asignacion.carreras.nombre
  }
  if (asignacion.facultades) {
    return (
      asignacion.facultades.prefijo ??
      asignacion.facultades.nombre_corto ??
      asignacion.facultades.nombre
    )
  }
  if (asignacion.roles?.alcance_default === 'externo') return 'Externo'
  return 'Global'
}

/**
 * Nombre completo y estándar del alcance de un rol, para usarse en el tooltip
 * que acompaña a `getScopeLabel` (texto corto). Devuelve `null` para alcances
 * Global/Externo, donde la etiqueta corta ya es el texto completo.
 */
export function getScopeFullLabel(asignacion: UsuarioRol): string | null {
  if (asignacion.carreras) return formatCarreraNombre(asignacion.carreras)
  if (asignacion.facultades) return formatFacultadNombre(asignacion.facultades)
  return null
}

export function getUsuarioRoles(usuario: Usuario) {
  return Array.isArray(usuario.roles) ? usuario.roles : []
}

export function matchesSearch(usuario: Usuario, search: string) {
  const term = search.trim().toLowerCase()
  if (!term) return true
  const roles = getUsuarioRoles(usuario)

  return [
    usuario.nombre_completo,
    usuario.email,
    ...roles.map((asignacion) => asignacion.roles?.nombre),
    ...roles.map((asignacion) => asignacion.roles?.clave),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term))
}
