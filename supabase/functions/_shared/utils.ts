import { corsHeaders } from './cors.ts'

// --- CLASE DE ERROR ---
export class HttpError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly internalDetails: unknown

  constructor(
    status: number,
    message: string,
    code = 'API_ERROR',
    internalDetails?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.internalDetails = internalDetails
  }
}

// --- HELPER DE ÉXITO ---
export function sendSuccess<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// --- HELPER DE ERROR ---
export function sendError(
  status: number,
  message: string,
  code: string,
): Response {
  return new Response(
    JSON.stringify({
      error: { message, code },
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
}

export interface ResponseMetadata extends Record<string, string | undefined> {
  tabla?: string
  accion?: string
  id?: string
}
