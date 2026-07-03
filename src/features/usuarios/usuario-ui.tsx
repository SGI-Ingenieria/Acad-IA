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

/**
 * Etiqueta natural y combinada del puesto de jefatura de una carrera, en un solo
 * texto y según el nivel (solo visual; los datos no cambian):
 *  - Licenciatura → "Jefe de carrera de {nombre}"
 *  - Maestría/Especialidad → "Coordinador de la {nivel} en {nombre}"
 *  - Doctorado/Diplomado → "Coordinador del {nivel} en {nombre}"
 *  - Otro (o sin nivel) → "Encargado de {nombre}"
 */
function formatJefeCarreraLabel(carrera: {
  nombre: string
  nivel?: string | null
}): string {
  const nombre = carrera.nombre
  const nivel = carrera.nivel?.trim().toLowerCase() ?? ''
  switch (nivel) {
    case 'licenciatura':
      return `Jefe de carrera de ${nombre}`
    case 'maestría':
    case 'maestria':
      return `Coordinador de la maestría en ${nombre}`
    case 'especialidad':
      return `Coordinador de la especialidad en ${nombre}`
    case 'doctorado':
      return `Coordinador del doctorado en ${nombre}`
    case 'diplomado':
      return `Coordinador del diplomado en ${nombre}`
    default:
      return `Encargado de ${nombre}`
  }
}

/**
 * Nombre del rol para "Rol en este nodo", en un solo texto. La jefatura de
 * carrera usa la convención por nivel ({@link formatJefeCarreraLabel}); el resto
 * de roles muestran su nombre tal cual (el alcance ya aparece en la migaja).
 */
export function getRoleNodeLabel(asignacion: UsuarioRol): string {
  const clave = asignacion.roles?.clave
  if (clave === 'JEFE_CARRERA' && asignacion.carreras) {
    return formatJefeCarreraLabel(asignacion.carreras)
  }
  if (asignacion.facultades) {
    const facultad = formatFacultadNombre(asignacion.facultades)
    if (clave === 'DIRECTOR_FACULTAD') return `Director de la ${facultad}`
    if (clave === 'SECRETARIO_ACADEMICO') {
      return `Secretario académico de la ${facultad}`
    }
    if (clave === 'JEFE_POSGRADO') {
      return `Jefe de posgrado de la ${facultad}`
    }
  }
  return getRoleName(asignacion)
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
