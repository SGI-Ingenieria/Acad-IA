import { HttpError as SharedHttpError } from '../../_shared/utils.ts'

export class HttpError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

export function httpErrorResponse(err: unknown): Response | null {
  if (err instanceof HttpError) {
    return jsonResponse(
      { error: err.code, message: err.message, details: err.details ?? null },
      err.status,
    )
  }

  if (err instanceof SharedHttpError) {
    return jsonResponse(
      {
        error: err.code,
        message: err.message,
        details: err.internalDetails ?? null,
      },
      err.status,
    )
  }

  return null
}
