import type { DocumentReferenceResolution } from '../_shared/documentos-referencias.ts'
import { HttpError } from '../_shared/utils.ts'
import { asRecord } from '../_shared/value.ts'

type RpcResult = { data: unknown; error: unknown }

export type LearningResourcePublicationClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>
}

type PublicationResolution =
  | 'applied'
  | 'already_applied'
  | 'active'
  | 'missing'
  | 'claimed_elsewhere'
  | 'incomplete'
  | 'stale'

type PublicationEnvelope = {
  resolution: PublicationResolution
  localJob: Record<string, unknown> | null
  globalJob: Record<string, unknown> | null
  winnerResponseId: string | null
  winnerAttemptId: string | null
}

export type PublishLearningResourceGenerationArgs = {
  supabase: LearningResourcePublicationClient
  cancelRemoteResponse: (responseId: string) => Promise<unknown>
  attemptId: string
  claimToken: string | null
  generationJobId: string
  userId: string
  responseId: string
  localState: 'queued' | 'running'
  openAIStatus: string
  startedAt: string
  metadata: Record<string, unknown>
  referenceMode: DocumentReferenceResolution['mode']
  referenceQuery: string
  references: DocumentReferenceResolution['references']
}

export class LearningResourcePublicationError extends HttpError {
  readonly shouldMarkLocalFailed: boolean
  readonly ambiguous: boolean

  constructor(args: {
    status: number
    message: string
    code: string
    details: unknown
    shouldMarkLocalFailed: boolean
    ambiguous: boolean
  }) {
    super(args.status, args.message, args.code, args.details)
    this.name = 'LearningResourcePublicationError'
    this.shouldMarkLocalFailed = args.shouldMarkLocalFailed
    this.ambiguous = args.ambiguous
  }
}

function parseEnvelope(value: unknown): PublicationEnvelope | null {
  const data = Array.isArray(value) ? value[0] : value
  const envelope = asRecord(data)
  if (!envelope) return null
  const resolution = envelope?.resolution
  if (
    resolution !== 'applied' &&
    resolution !== 'already_applied' &&
    resolution !== 'active' &&
    resolution !== 'missing' &&
    resolution !== 'claimed_elsewhere' &&
    resolution !== 'incomplete' &&
    resolution !== 'stale'
  ) {
    return null
  }
  return {
    resolution,
    localJob: asRecord(envelope.localJob),
    globalJob: asRecord(envelope.globalJob),
    winnerResponseId:
      typeof envelope.winnerResponseId === 'string'
        ? envelope.winnerResponseId
        : null,
    winnerAttemptId:
      typeof envelope.winnerAttemptId === 'string'
        ? envelope.winnerAttemptId
        : null,
  }
}

const DETERMINISTIC_SQLSTATES = new Set([
  '22023',
  '23503',
  '23505',
  '42501',
  '55000',
  'P0002',
])

export function isDeterministicPublicationError(error: unknown): boolean {
  const code = asRecord(error)?.code
  return typeof code === 'string' && DETERMINISTIC_SQLSTATES.has(code)
}

export function shouldMarkLearningResourceJobFailed(error: unknown): boolean {
  if (error instanceof LearningResourcePublicationError) {
    return error.shouldMarkLocalFailed
  }
  const explicit = asRecord(error)?.shouldMarkLocalFailed
  return typeof explicit === 'boolean' ? explicit : true
}

async function inspectPublication(
  args: PublishLearningResourceGenerationArgs,
): Promise<PublicationEnvelope | null> {
  try {
    const { data, error } = await args.supabase.rpc(
      'consultar_publicacion_intento_recursos_ia',
      {
        p_intento_id: args.attemptId,
        p_generation_job_id: args.generationJobId,
        p_openai_response_id: args.responseId,
      },
    )
    return error ? null : parseEnvelope(data)
  } catch {
    return null
  }
}

async function cancelBestEffort(
  args: PublishLearningResourceGenerationArgs,
  reason: string,
) {
  let cancellationError: unknown = null
  try {
    await args.cancelRemoteResponse(args.responseId)
  } catch (error) {
    cancellationError = error
  }
  console.warn('Se intentó cancelar una respuesta de recursos no publicada.', {
    generationJobId: args.generationJobId,
    responseId: args.responseId,
    reason,
    cancellationError,
  })
  return cancellationError
}

function publicationParams(args: PublishLearningResourceGenerationArgs) {
  return {
    p_intento_id: args.attemptId,
    p_token_reclamacion: args.claimToken,
    p_generation_job_id: args.generationJobId,
    p_usuario_id: args.userId,
    p_openai_response_id: args.responseId,
    p_estado_local: args.localState,
    p_estado_openai: args.openAIStatus,
    p_iniciado_en: args.startedAt,
    p_metadata: args.metadata,
  }
}

async function failAttemptBestEffort(
  args: PublishLearningResourceGenerationArgs,
  publicationError: unknown,
): Promise<unknown> {
  if (!args.claimToken) return 'MISSING_CLAIM_TOKEN'
  try {
    const { data, error } = await args.supabase.rpc(
      'fallar_intento_recursos_ia',
      {
        p_intento_id: args.attemptId,
        p_token_reclamacion: args.claimToken,
        p_generation_job_id: args.generationJobId,
        p_openai_response_id: args.responseId,
        p_error: {
          code: 'LEARNING_PUBLICATION_FAILED',
          message: 'Postgres rechazó la publicación durable de recursos.',
          publicationError,
        },
      },
    )
    return error ?? data
  } catch (error) {
    return error
  }
}

/**
 * Reintenta únicamente una publicación idempotente. Después de cualquier
 * respuesta incierta consulta el estado durable; nunca cancela a ciegas.
 */
export async function publishLearningResourceGenerationAtomically(
  args: PublishLearningResourceGenerationArgs,
): Promise<PublicationEnvelope> {
  let lastFailure: unknown = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await args.supabase.rpc(
        'publicar_intento_recursos_ia',
        publicationParams(args),
      )
      const published = error ? null : parseEnvelope(data)
      if (
        published?.resolution === 'applied' ||
        published?.resolution === 'already_applied'
      ) {
        return published
      }
      lastFailure = error ?? 'RPC_WITHOUT_RESULT'
    } catch (error) {
      lastFailure = error
    }

    const inspected = await inspectPublication(args)
    if (inspected?.resolution === 'already_applied') return inspected

    if (inspected?.resolution === 'claimed_elsewhere') {
      const cancellationError = await cancelBestEffort(
        args,
        'otra respuesta ya ganó la publicación',
      )
      throw new LearningResourcePublicationError({
        status: 409,
        message: 'Otra respuesta de IA ya quedó asociada a esta generación.',
        code: 'LEARNING_PUBLICATION_CONFLICT',
        details: {
          winnerResponseId: inspected.winnerResponseId,
          winnerAttemptId: inspected.winnerAttemptId,
          publicationError: lastFailure,
          cancellationError,
        },
        shouldMarkLocalFailed: false,
        ambiguous: false,
      })
    }

    if (inspected?.resolution === 'stale') {
      const cancellationError = await cancelBestEffort(
        args,
        'el intento durable ya no puede publicar resultados',
      )
      throw new LearningResourcePublicationError({
        status: 409,
        message: 'Este intento de IA ya no es el vigente.',
        code: 'LEARNING_PUBLICATION_STALE',
        details: { publicationError: lastFailure, cancellationError },
        shouldMarkLocalFailed: false,
        ambiguous: false,
      })
    }

    if (
      (inspected?.resolution === 'active' ||
        inspected?.resolution === 'missing') &&
      isDeterministicPublicationError(lastFailure)
    ) {
      const cancellationError = await cancelBestEffort(
        args,
        'Postgres rechazó determinísticamente la publicación',
      )
      const failureResult = await failAttemptBestEffort(args, lastFailure)
      throw new LearningResourcePublicationError({
        status: 500,
        message:
          'No se pudo publicar la generación de recursos de forma segura.',
        code: 'LEARNING_PUBLICATION_FAILED',
        details: {
          publicationError: lastFailure,
          cancellationError,
          failureResult,
        },
        shouldMarkLocalFailed: false,
        ambiguous: false,
      })
    }
  }

  throw new LearningResourcePublicationError({
    status: 503,
    message:
      'La respuesta quedó pendiente de conciliación; todavía no se puede confirmar su publicación.',
    code: 'LEARNING_PUBLICATION_UNCONFIRMED',
    details: { publicationError: lastFailure },
    shouldMarkLocalFailed: false,
    ambiguous: true,
  })
}
