import { HttpError as SharedHttpError } from '../../_shared/utils.ts'

export class HttpError extends SharedHttpError {
  readonly details?: unknown
  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(status, message, code, details)
    this.details = details
  }
}

export function httpErrorResponse(err: unknown): Response | null {
  if (err instanceof HttpError) {
    return Response.json(
      { error: err.code, message: err.message, details: err.details ?? null },
      { status: err.status },
    )
  }

  if (err instanceof SharedHttpError) {
    return Response.json(
      {
        error: err.code,
        message: err.message,
        details: err.internalDetails ?? null,
      },
      { status: err.status },
    )
  }

  return null
}
