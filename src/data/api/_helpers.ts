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
  const { data, error } = await supabase.auth.getUser()
  throwIfError(error)
  if (!data.user?.id) throw new ApiError('No hay sesión activa (auth).')
  return data.user.id
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
