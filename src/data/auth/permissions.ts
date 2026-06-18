import type { Session } from '@supabase/supabase-js'

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
  | 'asignaturas.responsables.gestionar'
  | 'auditoria.ver'
  | 'ia.usar'
  | 'evaluaciones.comentar'
  | 'archivos.ver'
  | 'archivos.gestionar'
  | (string & {})

type JsonRecord = Record<string, unknown>

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

  const userMetadata = session?.user?.app_metadata
  return isRecord(userMetadata) ? userMetadata : {}
}

export function getSessionPermissions(session: Session | null | undefined) {
  return new Set(readStringArray(getSessionAppMetadata(session).permisos))
}

export function hasPermission(
  session: Session | null | undefined,
  permission: AppPermission,
) {
  return getSessionPermissions(session).has(permission)
}

export function hasAnyPermission(
  session: Session | null | undefined,
  permissions: Array<AppPermission>,
) {
  if (permissions.length === 0) return true
  const current = getSessionPermissions(session)
  return permissions.some((permission) => current.has(permission))
}

export function hasBootstrapAccess(session: Session | null | undefined) {
  return getSessionAppMetadata(session).authz_bootstrap === true
}
