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

const RESOURCE_NOT_FOUND_CODES = new Set([
  'PGRST116',
  'PLAN_NOT_FOUND',
  'SUBJECT_NOT_FOUND',
])

/**
 * Reconoce tanto el error histórico de `.single()` de PostgREST como los
 * códigos de dominio usados por las lecturas con `.maybeSingle()`.
 */
export function isResourceNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && RESOURCE_NOT_FOUND_CODES.has(code)
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

/**
 * Columnas de `asignaturas` declaradas `GENERATED ALWAYS AS (...) STORED`
 * (migración `20260721203000`): Postgres deriva `creditos` de las horas
 * —`floor((horas_academicas + horas_independientes) / 16 * 100) / 100`, ver
 * `calcularCreditos` en `src/lib/creditos-utils.ts`— y `asignatura_hash` del
 * `id`.
 *
 * Postgres rechaza cualquier INSERT o UPDATE que las mencione, **incluso con
 * `null`**, con el código `428C9` («cannot insert a non-DEFAULT value into
 * column»). No basta, por tanto, con no editarlas: hay que quitarlas del
 * payload antes de escribir.
 *
 * El filtro vive en la capa de datos y no en cada llamador porque los tipos
 * generados (`src/types/supabase.ts`) todavía las listan como insertables y
 * actualizables, así que TypeScript no detecta el error en el punto de la
 * llamada.
 */
export const COLUMNAS_GENERADAS_ASIGNATURA = [
  'creditos',
  'asignatura_hash',
] as const

export type ColumnaGeneradaAsignatura =
  (typeof COLUMNAS_GENERADAS_ASIGNATURA)[number]

export function esColumnaGeneradaAsignatura(campo: string): boolean {
  return (COLUMNAS_GENERADAS_ASIGNATURA as ReadonlyArray<string>).includes(
    campo,
  )
}

/** Copia del payload sin las columnas generadas. Ver arriba el porqué. */
export function sinColumnasGeneradasAsignatura<T extends object>(
  payload: T,
): Omit<T, ColumnaGeneradaAsignatura> {
  const copia = { ...payload } as Record<string, unknown>
  for (const columna of COLUMNAS_GENERADAS_ASIGNATURA) delete copia[columna]
  return copia as Omit<T, ColumnaGeneradaAsignatura>
}
