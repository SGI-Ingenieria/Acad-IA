import {
  Activity,
  Archive,
  Building2,
  Layers,
  Settings2,
  Users,
} from 'lucide-react'

import type { AppPermission } from '@/data/auth/permissions'
import type { LucideIcon } from 'lucide-react'

/**
 * Secciones de la página de administración (/administracion): fuente única para
 * las pestañas del layout, el redirect del índice y la visibilidad del enlace
 * en el menú lateral. Cada sección conserva el guard de su propia ruta; aquí
 * solo se decide qué pestañas mostrar.
 */
export interface AdminSection {
  to: string
  label: string
  icon: LucideIcon
  permissions?: Array<AppPermission>
  allowBootstrap?: boolean
  adminOnly?: boolean
}

export const adminSections: Array<AdminSection> = [
  {
    to: '/administracion/referencias',
    label: 'Archivos',
    icon: Archive,
    permissions: ['archivos.ver', 'archivos.gestionar'],
  },
  {
    to: '/administracion/facultades',
    label: 'Facultades y Carreras',
    icon: Building2,
  },
  {
    to: '/administracion/estructuras',
    label: 'Estructuras',
    icon: Layers,
    permissions: ['catalogos.gestionar'],
  },
  {
    to: '/administracion/usuarios',
    label: 'Usuarios',
    icon: Users,
    permissions: ['usuarios.ver', 'usuarios.gestionar'],
    allowBootstrap: true,
  },
  {
    to: '/administracion/flujos-estados',
    label: 'Flujos y estados',
    icon: Settings2,
    permissions: ['catalogos.gestionar'],
  },
  {
    to: '/administracion/observabilidad',
    label: 'Observabilidad',
    icon: Activity,
    adminOnly: true,
  },
]

/** Forma mínima de authz que necesita la visibilidad (hook o beforeLoad). */
export interface SectionAuthz {
  isAdmin: boolean
  permissions: ReadonlySet<string>
  hasBootstrapAccess: boolean
}

export function canSeeAdminSection(
  authz: SectionAuthz,
  section: AdminSection,
): boolean {
  if (section.adminOnly && !authz.isAdmin) return false
  if (authz.isAdmin) return true
  if (section.allowBootstrap && authz.hasBootstrapAccess) return true
  if (!section.permissions) return true
  return section.permissions.some((permission) =>
    authz.permissions.has(permission),
  )
}
