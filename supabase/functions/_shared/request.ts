import { HttpError } from './utils.ts'

type RequestErrorOptions = {
  message?: string
  code?: string
  details?: unknown
}

export function requireMethod(
  request: Request,
  method: string,
  options: RequestErrorOptions = {},
): void {
  if (request.method === method) return
  throw new HttpError(
    405,
    options.message ?? 'Método no permitido.',
    options.code ?? 'METHOD_NOT_ALLOWED',
    options.details ?? { method: request.method },
  )
}

export function requireJsonContentType(
  request: Request,
  options: RequestErrorOptions = {},
): void {
  requireContentType(request, 'application/json', options)
}

export function requireContentType(
  request: Request,
  expected: string,
  options: RequestErrorOptions = {},
): void {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase()
  if (contentType.includes(expected.toLowerCase())) return
  throw new HttpError(
    415,
    options.message ?? 'Content-Type no soportado.',
    options.code ?? 'UNSUPPORTED_MEDIA_TYPE',
    options.details ?? { contentType, expected },
  )
}

export async function readJsonBody(
  request: Request,
  options: RequestErrorOptions = {},
): Promise<unknown> {
  try {
    return await request.json()
  } catch (error) {
    throw new HttpError(
      400,
      options.message ?? 'Body JSON inválido.',
      options.code ?? 'INVALID_JSON',
      options.details ?? { cause: error },
    )
  }
}

export function getBearerToken(request: Request): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token || null
}

export function edgeFunctionName(
  request: Request,
  fallback = 'edge-function',
): string {
  return (
    new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? fallback
  )
}

export function logEdgeRequest(request: Request, fallback?: string): string {
  const functionName = edgeFunctionName(request, fallback)
  console.log(
    `[${new Date().toISOString()}][${functionName}]: Request received`,
  )
  return functionName
}
