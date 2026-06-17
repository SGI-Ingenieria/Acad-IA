import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js'

import { supabaseBrowser } from './client'

import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

export type EdgeInvokeOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer'
}

export class EdgeFunctionError extends Error {
  constructor(
    message: string,
    public readonly functionName: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'EdgeFunctionError'
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getEdgeFunctionErrorCode(error: unknown): string | undefined {
  if (!(error instanceof EdgeFunctionError)) return undefined
  if (!isObjectRecord(error.details)) return undefined

  const errorBody = error.details.error
  if (!isObjectRecord(errorBody)) return undefined

  const code = errorBody.code
  return typeof code === 'string' ? code : undefined
}

export async function invokeEdge<TOut>(
  functionName: string,
  body?:
    | string
    | File
    | Blob
    | ArrayBuffer
    | FormData
    | ReadableStream<Uint8Array<ArrayBufferLike>>
    | Record<string, unknown>
    | undefined,
  opts: EdgeInvokeOptions = {},
  client?: SupabaseClient<Database>,
): Promise<TOut> {
  const supabase = client ?? supabaseBrowser()

  // Nota: algunas versiones/defs de @supabase/supabase-js no tipan `responseType`
  // aunque el runtime lo soporte. Usamos `any` para no bloquear el uso de Blob.
  const invoke: any = (supabase.functions as any).invoke.bind(
    supabase.functions,
  )
  const { data, error } = await invoke(functionName, {
    body,
    method: opts.method ?? 'POST',
    headers: opts.headers,
    responseType: opts.responseType,
  })

  if (error) {
    // Valores por defecto (por si falla el parseo o es otro tipo de error)
    let message = error.message // El genérico "returned a non-2xx status code"
    let status = undefined
    let details: unknown = error

    // 2. Verificamos si es un error HTTP (4xx o 5xx) que trae cuerpo JSON
    if (error instanceof FunctionsHttpError) {
      try {
        // Obtenemos el status real (ej. 404, 400)
        status = error.context.status

        // ¡LA CLAVE! Leemos el JSON que tu Edge Function envió
        const errorBody = await error.context.json()
        details = errorBody

        // Intentamos extraer el mensaje humano según tu estructura { error: { message: "..." } }
        // o la estructura simple { error: "..." }
        if (errorBody && typeof errorBody === 'object') {
          // Caso 1: Estructura anidada (la que definimos hace poco: { error: { message: "..." } })
          if (
            'error' in errorBody &&
            typeof errorBody.error === 'object' &&
            errorBody.error !== null &&
            'message' in errorBody.error
          ) {
            message = (errorBody.error as { message: string }).message
          }
          // Caso 2: Estructura simple ({ error: "Mensaje de error" })
          else if (
            'error' in errorBody &&
            typeof errorBody.error === 'string'
          ) {
            message = errorBody.error
          }
          // Caso 3: Propiedad message directa ({ message: "..." })
          else if (
            'message' in errorBody &&
            typeof errorBody.message === 'string'
          ) {
            message = errorBody.message
          }
        }
      } catch (e) {
        console.warn('No se pudo parsear el error JSON de la Edge Function', e)
      }
    } else if (error instanceof FunctionsRelayError) {
      message = `Error de Relay Supabase: ${error.message}`
    } else if (error instanceof FunctionsFetchError) {
      message = `Error de conexión (Fetch): ${error.message}`
    }

    // 3. Lanzamos tu error personalizado con los datos reales extraídos
    throw new EdgeFunctionError(message, functionName, status, details)
  }

  if (opts.responseType === 'blob') {
    const anyData: unknown = data

    if (anyData instanceof Blob) {
      return anyData as TOut
    }

    throw new EdgeFunctionError(
      'La Edge Function no devolvió un binario (Blob) válido.',
      functionName,
      undefined,
      { receivedType: typeof anyData, received: anyData },
    )
  }

  return data as TOut
}
