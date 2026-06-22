import type { Session, SupabaseClient } from '@supabase/supabase-js'

export type AppPermission =
  | 'usuarios.ver'
  | 'usuarios.gestionar'
  | 'usuarios.roles.gestionar'
  | 'catalogos.gestionar'
  | 'planes.ver'
  | 'planes.crear'
  | 'planes.editar'
  | 'planes.aprobar'
  | 'asignaturas.ver'
  | 'asignaturas.editar'
  | 'asignaturas.aprobar'
  | 'asignaturas.responsables.gestionar'
  | 'comentarios.crear'
  | 'comentarios.externos.crear'
  | 'expertos.gestionar'
  | 'auditoria.ver'
  | 'ia.usar'
  | 'evaluaciones.comentar'
  | 'archivos.ver'
  | 'archivos.gestionar'
  | (string & {})

type JsonRecord = Record<string, unknown>

const ADMIN_KNOWN_PERMISSIONS: Array<AppPermission> = [
  'usuarios.ver',
  'usuarios.gestionar',
  'usuarios.roles.gestionar',
  'catalogos.gestionar',
  'planes.ver',
  'planes.crear',
  'planes.editar',
  'planes.aprobar',
  'asignaturas.ver',
  'asignaturas.editar',
  'asignaturas.aprobar',
  'asignaturas.responsables.gestionar',
  'comentarios.crear',
  'comentarios.externos.crear',
  'expertos.gestionar',
  'auditoria.ver',
  'ia.usar',
  'evaluaciones.comentar',
  'archivos.ver',
  'archivos.gestionar',
]

export type EffectiveAuthz = {
  permissions: Set<string>
  roleKeys: Set<string>
  isAdmin: boolean
  hasBootstrapAccess: boolean
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readStringArray(value: unknown): Array<string> {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => key)
  }

  return []
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  )
  const decoded = window.atob(padded)
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function decodeJwtPayload(accessToken: string | null | undefined): JsonRecord {
  if (!accessToken) return {}

  try {
    const [, payload] = accessToken.split('.')
    if (!payload) return {}
    const parsed = JSON.parse(base64UrlDecode(payload))
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function getSessionClaims(session: Session | null | undefined) {
  return decodeJwtPayload(session?.access_token)
}

export function getSessionAppMetadata(session: Session | null | undefined) {
  const claims = getSessionClaims(session)
  const claimMetadata = claims.app_metadata
  if (isRecord(claimMetadata)) return claimMetadata

  const userMetadata = session?.user.app_metadata
  return isRecord(userMetadata) ? userMetadata : {}
}

export function getSessionPermissions(session: Session | null | undefined) {
  return new Set(readStringArray(getSessionAppMetadata(session).permisos))
}

export function getSessionRoleKeys(session: Session | null | undefined) {
  return new Set(readStringArray(getSessionAppMetadata(session).roles_claves))
}

export function isAdminSession(session: Session | null | undefined) {
  return getSessionRoleKeys(session).has('ADMIN')
}

export function getSessionEffectiveAuthz(
  session: Session | null | undefined,
): EffectiveAuthz {
  const roleKeys = getSessionRoleKeys(session)
  const isAdmin = roleKeys.has('ADMIN')

  return {
    permissions: getSessionPermissions(session),
    roleKeys,
    isAdmin,
    hasBootstrapAccess: hasBootstrapAccess(session),
  }
}

function readJoinedRoleKey(row: unknown) {
  if (!isRecord(row)) return null
  const roles = row.roles
  if (Array.isArray(roles)) {
    const first = roles[0]
    return isRecord(first) && typeof first.clave === 'string'
      ? first.clave
      : null
  }
  return isRecord(roles) && typeof roles.clave === 'string' ? roles.clave : null
}

function readJoinedPermissionKey(row: unknown) {
  if (!isRecord(row)) return null
  const permisos = row.permisos
  if (Array.isArray(permisos)) {
    const first = permisos[0]
    return isRecord(first) && typeof first.clave === 'string'
      ? first.clave
      : null
  }
  return isRecord(permisos) && typeof permisos.clave === 'string'
    ? permisos.clave
    : null
}

function grantAdminAuthz(effective: EffectiveAuthz) {
  effective.roleKeys.add('ADMIN')
  effective.isAdmin = true
  for (const permission of ADMIN_KNOWN_PERMISSIONS) {
    effective.permissions.add(permission)
  }
}

export async function resolveEffectiveAuthz(
  supabase: SupabaseClient,
  session: Session | null | undefined,
): Promise<EffectiveAuthz> {
  const effective = getSessionEffectiveAuthz(session)
  const userId = session?.user.id

  if (!userId) return effective
  if (effective.isAdmin) {
    grantAdminAuthz(effective)
    return effective
  }

  if (effective.permissions.size > 0 || effective.hasBootstrapAccess) {
    return effective
  }

  const { data: isAdminFromDb } = await supabase.rpc('authz_is_admin')
  if (isAdminFromDb === true) {
    grantAdminAuthz(effective)
  }

  const { data: userRoles } = await supabase
    .from('usuarios_roles')
    .select('rol_id, roles(clave)')
    .eq('usuario_id', userId)

  const roleIds = new Set<string>()
  for (const row of userRoles ?? []) {
    if (typeof row.rol_id === 'string') roleIds.add(row.rol_id)
    const roleKey = readJoinedRoleKey(row)
    if (roleKey) effective.roleKeys.add(roleKey)
  }

  effective.isAdmin = effective.roleKeys.has('ADMIN')

  if (effective.isAdmin) {
    grantAdminAuthz(effective)

    const { data: allPermissions } = await supabase
      .from('permisos')
      .select('clave')

    for (const permiso of allPermissions ?? []) {
      if (typeof permiso.clave === 'string') {
        effective.permissions.add(permiso.clave)
      }
    }

    return effective
  }

  if (roleIds.size === 0) return effective

  const { data: rolePermissions } = await supabase
    .from('roles_permisos')
    .select('permisos(clave)')
    .in('rol_id', Array.from(roleIds))

  for (const row of rolePermissions ?? []) {
    const permissionKey = readJoinedPermissionKey(row)
    if (permissionKey) effective.permissions.add(permissionKey)
  }

  return effective
}

export function hasPermission(
  session: Session | null | undefined,
  permission: AppPermission,
) {
  const effective = getSessionEffectiveAuthz(session)
  return effective.isAdmin || effective.permissions.has(permission)
}

export function hasAnyPermission(
  session: Session | null | undefined,
  permissions: Array<AppPermission>,
) {
  if (permissions.length === 0) return true
  const effective = getSessionEffectiveAuthz(session)
  if (effective.isAdmin) return true
  return permissions.some((permission) => effective.permissions.has(permission))
}

export function hasBootstrapAccess(session: Session | null | undefined) {
  return getSessionAppMetadata(session).authz_bootstrap === true
}
