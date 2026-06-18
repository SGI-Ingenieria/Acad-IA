import type { Usuario, UsuarioRol } from '@/data/api/usuarios.api'

import { DynamicIcon } from '@/features/planes/utils/icon-utils'
import { cn } from '@/lib/utils'

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

export function matchesSearch(usuario: Usuario, search: string) {
  const term = search.trim().toLowerCase()
  if (!term) return true

  return [
    usuario.nombre_completo,
    usuario.email,
    ...usuario.roles.map((asignacion) => asignacion.roles?.nombre),
    ...usuario.roles.map((asignacion) => asignacion.roles?.clave),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term))
}

export function FacultadIconPill({
  facultad,
}: {
  facultad: { color: string | null; icono: string | null } | undefined | null
}) {
  if (!facultad) return null
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
      style={{
        backgroundColor: facultad.color ? `${facultad.color}1a` : undefined,
        color: facultad.color ?? undefined,
      }}
    >
      <DynamicIcon
        name={facultad.icono ?? ''}
        className={cn('h-3.5 w-3.5')}
        style={facultad.color ? { color: facultad.color } : undefined}
      />
    </span>
  )
}
