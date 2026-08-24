import { corsHeaders } from './cors.ts'

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

export function jsonResponse<T>(
  data: T,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

export function sendSuccess<T>(data: T, status = 200): Response {
  return jsonResponse(data, status)
}

export function sendError(
  status: number,
  message: string,
  code: string,
): Response {
  return jsonResponse({ error: { message, code } }, status)
}

export function edgeErrorResponse(
  error: unknown,
  functionName: string,
  unexpectedMessage = 'Ocurrió un error inesperado en el servidor.',
  unexpectedCode = 'INTERNAL_SERVER_ERROR',
  unexpectedStatus = 500,
): Response {
  const prefix = `[${new Date().toISOString()}][${functionName}]`
  if (error instanceof HttpError) {
    console.error(`${prefix} ⚠️ Handled Error:`, {
      message: error.message,
      code: error.code,
      internalDetails: error.internalDetails || 'N/A',
    })
    return sendError(error.status, error.message, error.code)
  }

  const unexpectedError =
    error instanceof Error ? error : new Error(String(error))
  console.error(
    `${prefix} 💥 CRITICAL UNHANDLED ERROR:`,
    unexpectedError.stack || unexpectedError.message,
  )
  return sendError(unexpectedStatus, unexpectedMessage, unexpectedCode)
}

export interface ResponseMetadata extends Record<string, string | undefined> {
  tabla?: string
  accion?: string
  id?: string
}
