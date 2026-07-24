/**
 * Recuerda la última cuenta que inició sesión en este navegador para ofrecer un
 * reingreso rápido ("bienvenido de nuevo"). Solo persiste el identificador
 * público (Clave La Salle o correo) y el tipo de acceso: nunca la contraseña.
 *
 * Es estado del navegador (preferencia de dispositivo), no estado de servidor
 * ni de sesión —por eso vive en localStorage y no en TanStack Query—, y
 * sobrevive intencionalmente al cierre de sesión, a diferencia de la sesión de
 * Supabase que se limpia con `signOut()`.
 */

const STORAGE_KEY = 'acadia.lastAccount.v1'

export type LastAccountType = 'internal' | 'external'

export interface LastAccount {
  type: LastAccountType
  /** Clave La Salle (interno) o correo electrónico (externo). */
  identifier: string
  savedAt: string
}

function isLastAccount(value: unknown): value is LastAccount {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.type === 'internal' || v.type === 'external') &&
    typeof v.identifier === 'string' &&
    v.identifier.length > 0 &&
    typeof v.savedAt === 'string'
  )
}

export function getLastAccount(): LastAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isLastAccount(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function setLastAccount(
  account: Pick<LastAccount, 'type' | 'identifier'>,
): void {
  try {
    const record: LastAccount = {
      type: account.type,
      identifier: account.identifier,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Almacenamiento no disponible (modo privado, cuota): el reingreso rápido
    // es una mejora opcional, así que se ignora sin afectar el login.
  }
}

export function clearLastAccount(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignorar: ver setLastAccount.
  }
}
