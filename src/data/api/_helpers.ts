import type { Database } from '@/types/supabase'
import type {
  PostgrestError,
  AuthError,
  SupabaseClient,
} from '@supabase/supabase-js'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
    public readonly hint?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function throwIfError(error: PostgrestError | AuthError | null): void {
  if (!error) return
  const anyErr = error as any
  throw new ApiError(
    anyErr.message ?? 'Error inesperado',
    anyErr.code,
    anyErr.details,
    anyErr.hint,
  )
}

export function requireData<T>(
  data: T | null | undefined,
  message = 'Respuesta vacía',
): T {
  if (data === null || data === undefined) throw new ApiError(message)
  return data
}

export async function getUserIdOrThrow(
  supabase: SupabaseClient<Database>,
): Promise<string> {
  // Lee la sesión local (sin round-trip al servidor de auth). Antes esto
  // llamaba a `auth.getUser()`, que hace una petición de red a /auth/v1/user en
  // CADA consulta del data layer que necesita el id del usuario, y era el
  // principal cuello de botella de latencia. El id solo se usa para construir
  // filtros de consulta; la seguridad real la aplican las políticas RLS con el
  // JWT verificado en el servidor, así que leerlo de la sesión local es seguro.
  // `getSession()` refresca el token automáticamente si estuviera expirado.
  const { data, error } = await supabase.auth.getSession()
  throwIfError(error)
  const userId = data.session?.user.id
  if (!userId) throw new ApiError('No hay sesión activa (auth).')
  return userId
}

export function buildRange(
  limit?: number,
  offset?: number,
): { from?: number; to?: number } {
  if (!limit) return {}
  const from = Math.max(0, offset ?? 0)
  const to = from + Math.max(1, limit) - 1
  return { from, to }
}
