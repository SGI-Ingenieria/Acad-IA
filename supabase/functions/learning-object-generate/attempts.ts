import {
  hydrateDirectDocumentReferences,
  type DocumentReferenceResolution,
} from '../_shared/documentos-referencias.ts'
import {
  asRecord as record,
  callGenerationRpc as callRpc,
  nonEmptyString as string,
  openAIResponseStartedAt,
  parseDocumentReferences as parseReferences,
} from '../_shared/generation-attempts.ts'
import type { ServiceRoleClient } from '../_shared/supabase.ts'
import type {
  StructuredResponseOptions,
  StructuredResponseResult,
  StructuredResponseSuccess,
} from '../_shared/openai-service.ts'
import type { OpenAIInputFile } from '../_shared/openai-file-input.ts'
import { HttpError } from '../_shared/utils.ts'
import { stableJson } from '../_shared/value.ts'
import {
  LearningResourcePublicationError,
  publishLearningResourceGenerationAtomically,
  type LearningResourcePublicationClient,
} from './publication.ts'

type AttemptState =
  | 'preparado'
  | 'reclamado'
  | 'respuesta_vinculada'
  | 'publicado'
  | 'fallido'
  | 'expirado'
  | 'obsoleto'

export type LearningResourceGenerationAttempt = {
  id: string
  tipo_entidad: 'recursos_aprendizaje'
  entidad_id: string
  handler: 'learning-resources'
  payload_version: 1
  contexto: Record<string, unknown>
  estado: AttemptState
  solicitud: Record<string, unknown>
  modo_referencias: DocumentReferenceResolution['mode']
  consulta_referencias: string
  referencias: DocumentReferenceResolution['references']
  openai_response_id: string | null
  estado_openai: string | null
  iniciado_en: string | null
  token_reclamacion: string | null
  reclamado_por: string | null
  reclamado_hasta: string | null
}

type AttemptEnvelope = {
  resolution:
    | 'prepared'
    | 'linked'
    | 'already_linked'
    | 'applied'
    | 'already_applied'
    | 'claimed_elsewhere'
    | 'stale'
    | 'active'
    | 'missing'
    | 'incomplete'
  attempt: LearningResourceGenerationAttempt | null
}

export type PrepareLearningResourceAttemptArgs = {
  supabase: LearningResourcePublicationClient
  attemptId: string
  generationJobId: string
  subjectId: string
  userId: string
  context?: Record<string, unknown>
  request: Record<string, unknown>
  referenceMode: DocumentReferenceResolution['mode']
  referenceQuery: string
  references: DocumentReferenceResolution['references']
  actor?: string
}

export class LearningResourceAttemptError extends HttpError {
  readonly shouldMarkLocalFailed: boolean
  readonly resolution: 'claimed_elsewhere' | 'stale' | 'unconfirmed'

  constructor(args: {
    status: number
    message: string
    code: string
    details: unknown
    shouldMarkLocalFailed: boolean
    resolution: 'claimed_elsewhere' | 'stale' | 'unconfirmed'
  }) {
    super(args.status, args.message, args.code, args.details)
    this.name = 'LearningResourceAttemptError'
    this.shouldMarkLocalFailed = args.shouldMarkLocalFailed
    this.resolution = args.resolution
  }
}

export function parseLearningResourceGenerationAttempt(
  value: unknown,
): LearningResourceGenerationAttempt | null {
  const item = record(value)
  const context = record(item?.contexto)
  const request = record(item?.solicitud)
  const references = parseReferences(item?.referencias)
  const state = item?.estado
  const mode = item?.modo_referencias
  if (
    !item ||
    !string(item.id) ||
    item.tipo_entidad !== 'recursos_aprendizaje' ||
    !string(item.entidad_id) ||
    item.handler !== 'learning-resources' ||
    item.payload_version !== 1 ||
    !context ||
    !request ||
    !references ||
    (mode !== 'none' && mode !== 'direct' && mode !== 'retrieval') ||
    typeof item.consulta_referencias !== 'string' ||
    (state !== 'preparado' &&
      state !== 'reclamado' &&
      state !== 'respuesta_vinculada' &&
      state !== 'publicado' &&
      state !== 'fallido' &&
      state !== 'expirado' &&
      state !== 'obsoleto')
  ) {
    return null
  }
  return {
    id: String(item.id),
    tipo_entidad: 'recursos_aprendizaje',
    entidad_id: String(item.entidad_id),
    handler: 'learning-resources',
    payload_version: 1,
    contexto: context,
    estado: state,
    solicitud: request,
    modo_referencias: mode,
    consulta_referencias: item.consulta_referencias,
    referencias: references,
    openai_response_id: string(item.openai_response_id),
    estado_openai: string(item.estado_openai),
    iniciado_en: string(item.iniciado_en),
    token_reclamacion: string(item.token_reclamacion),
    reclamado_por: string(item.reclamado_por),
    reclamado_hasta: string(item.reclamado_hasta),
  }
}

function parseEnvelope(value: unknown): AttemptEnvelope | null {
  const item = record(Array.isArray(value) ? value[0] : value)
  const resolution = item?.resolution
  if (
    resolution !== 'prepared' &&
    resolution !== 'linked' &&
    resolution !== 'already_linked' &&
    resolution !== 'applied' &&
    resolution !== 'already_applied' &&
    resolution !== 'claimed_elsewhere' &&
    resolution !== 'stale' &&
    resolution !== 'active' &&
    resolution !== 'missing' &&
    resolution !== 'incomplete'
  ) {
    return null
  }
  return {
    resolution,
    attempt: parseLearningResourceGenerationAttempt(item?.attempt),
  }
}

async function inspectAttempt(
  supabase: LearningResourcePublicationClient,
  attemptId: string,
): Promise<LearningResourceGenerationAttempt | null> {
  try {
    const { data, error } = await callRpc(
      supabase,
      'consultar_intento_generacion_ia',
      { p_intento_id: attemptId },
    )
    return error ? null : parseLearningResourceGenerationAttempt(data)
  } catch {
    return null
  }
}

function matchesPreparation(
  attempt: LearningResourceGenerationAttempt,
  args: PrepareLearningResourceAttemptArgs,
  context: Record<string, unknown>,
) {
  return (
    attempt.id === args.attemptId &&
    attempt.entidad_id === args.generationJobId &&
    stableJson(attempt.contexto) === stableJson(context) &&
    stableJson(attempt.solicitud) === stableJson(args.request) &&
    attempt.modo_referencias === args.referenceMode &&
    attempt.consulta_referencias === args.referenceQuery &&
    stableJson(attempt.referencias) === stableJson(args.references)
  )
}

/** Elimina data URLs; el recovery vuelve a leer las versiones congeladas. */
export function buildDurableLearningResourceRequest(
  options: StructuredResponseOptions,
): Record<string, unknown> {
  const request = JSON.parse(JSON.stringify(options)) as Record<string, unknown>
  if (!Array.isArray(request.input)) return request
  request.input = request.input.map((candidate) => {
    const item = record(candidate)
    if (!item || !Array.isArray(item.content)) return candidate
    return {
      ...item,
      content: item.content.filter((part) => {
        const content = record(part)
        return content?.type !== 'input_file' && content?.type !== 'input_image'
      }),
    }
  })
  return request
}

export async function prepareLearningResourceGenerationAttempt(
  args: PrepareLearningResourceAttemptArgs,
): Promise<LearningResourceGenerationAttempt> {
  const context = {
    ...args.context,
    jobId: args.generationJobId,
    asignaturaId: args.subjectId,
    userId: args.userId,
  }
  const values = {
    p_intento_id: args.attemptId,
    p_generation_job_id: args.generationJobId,
    p_usuario_id: args.userId,
    p_contexto: context,
    p_solicitud: args.request,
    p_modo_referencias: args.referenceMode,
    p_consulta_referencias: args.referenceQuery,
    p_referencias: args.references,
    p_actor: args.actor ?? 'learning-object-generate',
  }
  let lastFailure: unknown = null
  for (let retry = 0; retry < 2; retry += 1) {
    try {
      const { data, error } = await callRpc(
        args.supabase,
        'preparar_intento_recursos_ia',
        values,
      )
      const prepared = !error
        ? parseLearningResourceGenerationAttempt(data)
        : null
      if (prepared && matchesPreparation(prepared, args, context)) {
        return prepared
      }
      lastFailure = error ?? 'PREPARE_WITHOUT_MATCHING_RESULT'
    } catch (error) {
      lastFailure = error
    }
    const committed = await inspectAttempt(args.supabase, args.attemptId)
    if (committed && matchesPreparation(committed, args, context)) {
      return committed
    }
  }
  throw new LearningResourceAttemptError({
    status: 503,
    message: 'No se pudo confirmar el intento durable de recursos.',
    code: 'LEARNING_ATTEMPT_PREPARE_UNCONFIRMED',
    details: lastFailure,
    shouldMarkLocalFailed: false,
    resolution: 'unconfirmed',
  })
}

async function cancelBestEffort(
  responseId: string,
  cancelRemoteResponse: (responseId: string) => Promise<unknown>,
) {
  try {
    return await cancelRemoteResponse(responseId)
  } catch (error) {
    return error
  }
}

export async function linkLearningResourceGenerationResponse(args: {
  supabase: LearningResourcePublicationClient
  attempt: LearningResourceGenerationAttempt
  response: Pick<StructuredResponseSuccess, 'responseId' | 'openaiRaw'>
  cancelRemoteResponse: (responseId: string) => Promise<unknown>
}): Promise<LearningResourceGenerationAttempt> {
  const token = args.attempt.token_reclamacion
  if (!token) {
    const latest = await inspectAttempt(args.supabase, args.attempt.id)
    if (latest?.openai_response_id === args.response.responseId) return latest
    throw new LearningResourceAttemptError({
      status: 409,
      message: 'El intento durable ya no tiene un lease vigente.',
      code: 'LEARNING_ATTEMPT_CLAIM_LOST',
      details: { attemptId: args.attempt.id },
      shouldMarkLocalFailed: false,
      resolution: 'claimed_elsewhere',
    })
  }
  const status = String(args.response.openaiRaw.status ?? 'queued')
  const values = {
    p_intento_id: args.attempt.id,
    p_token_reclamacion: token,
    p_openai_response_id: args.response.responseId,
    p_estado_openai: status,
    p_iniciado_en: openAIResponseStartedAt(args.response.openaiRaw),
  }
  let lastFailure: unknown = null
  for (let retry = 0; retry < 2; retry += 1) {
    try {
      const { data, error } = await callRpc(
        args.supabase,
        'vincular_respuesta_intento_generacion_ia',
        values,
      )
      const envelope = !error ? parseEnvelope(data) : null
      if (
        envelope?.attempt?.openai_response_id === args.response.responseId &&
        (envelope.resolution === 'linked' ||
          envelope.resolution === 'already_linked')
      ) {
        return envelope.attempt
      }
      lastFailure = error ?? envelope ?? 'LINK_WITHOUT_RESULT'
    } catch (error) {
      lastFailure = error
    }
    const committed = await inspectAttempt(args.supabase, args.attempt.id)
    if (committed?.openai_response_id === args.response.responseId) {
      return committed
    }
    if (committed?.openai_response_id) {
      const cancellationError = await cancelBestEffort(
        args.response.responseId,
        args.cancelRemoteResponse,
      )
      throw new LearningResourceAttemptError({
        status: 409,
        message: 'Otra respuesta ya ganó el intento durable.',
        code: 'LEARNING_ATTEMPT_RESPONSE_CONFLICT',
        details: {
          winnerResponseId: committed.openai_response_id,
          linkError: lastFailure,
          cancellationError,
        },
        shouldMarkLocalFailed: false,
        resolution: 'claimed_elsewhere',
      })
    }
    if (
      committed?.estado === 'obsoleto' ||
      committed?.estado === 'fallido' ||
      committed?.estado === 'expirado'
    ) {
      const cancellationError = await cancelBestEffort(
        args.response.responseId,
        args.cancelRemoteResponse,
      )
      throw new LearningResourceAttemptError({
        status: 409,
        message: 'El intento durable ya no está vigente.',
        code: 'LEARNING_ATTEMPT_STALE',
        details: { linkError: lastFailure, cancellationError },
        shouldMarkLocalFailed: false,
        resolution: 'stale',
      })
    }
  }
  throw new LearningResourceAttemptError({
    status: 503,
    message: 'No se pudo confirmar el vínculo con la respuesta de OpenAI.',
    code: 'LEARNING_ATTEMPT_LINK_UNCONFIRMED',
    details: lastFailure,
    shouldMarkLocalFailed: false,
    resolution: 'unconfirmed',
  })
}

export async function failLearningResourceGenerationAttempt(args: {
  supabase: LearningResourcePublicationClient
  attempt: LearningResourceGenerationAttempt
  responseId?: string | null
  error: Record<string, unknown>
}): Promise<boolean> {
  if (!args.attempt.token_reclamacion) return false
  try {
    const { data, error } = await callRpc(
      args.supabase,
      'fallar_intento_recursos_ia',
      {
        p_intento_id: args.attempt.id,
        p_token_reclamacion: args.attempt.token_reclamacion,
        p_generation_job_id: args.attempt.entidad_id,
        p_openai_response_id: args.responseId ?? null,
        p_error: args.error,
      },
    )
    if (!error && data === true) return true
  } catch {
    // El estado se confirma abajo; nunca se sobrescribe el job a ciegas.
  }
  const committed = await inspectAttempt(args.supabase, args.attempt.id)
  if (committed?.estado === 'fallido') return true
  throw new LearningResourceAttemptError({
    status: 503,
    message: 'No se pudo confirmar el cierre del intento durable.',
    code: 'LEARNING_ATTEMPT_FAILURE_UNCONFIRMED',
    details: { attemptId: args.attempt.id },
    shouldMarkLocalFailed: false,
    resolution: 'unconfirmed',
  })
}

function injectFiles(
  request: Record<string, unknown>,
  files: Array<OpenAIInputFile>,
): StructuredResponseOptions {
  const copy = JSON.parse(JSON.stringify(request)) as Record<string, unknown>
  if (!files.length || !Array.isArray(copy.input)) {
    return copy as StructuredResponseOptions
  }
  let injected = false
  copy.input = copy.input.map((candidate) => {
    const item = record(candidate)
    if (injected || item?.role !== 'user' || !Array.isArray(item.content)) {
      return candidate
    }
    injected = true
    return { ...item, content: [...files, ...item.content] }
  })
  if (!injected) {
    throw new HttpError(
      500,
      'El payload durable no contiene una entrada de usuario.',
      'LEARNING_ATTEMPT_INPUT_INVALID',
    )
  }
  return copy as StructuredResponseOptions
}

export async function recoverLearningResourceGenerationAttempt(args: {
  supabase: ServiceRoleClient
  attempt: unknown
  createResponse: (
    request: StructuredResponseOptions,
  ) => Promise<StructuredResponseResult<unknown>>
  cancelRemoteResponse: (responseId: string) => Promise<unknown>
}): Promise<AttemptEnvelope> {
  let attempt = parseLearningResourceGenerationAttempt(args.attempt)
  if (!attempt) {
    throw new HttpError(
      422,
      'El intento durable de recursos no es compatible.',
      'LEARNING_ATTEMPT_UNSUPPORTED',
    )
  }
  if (attempt.estado === 'publicado') {
    return { resolution: 'already_applied', attempt }
  }
  if (
    attempt.estado === 'fallido' ||
    attempt.estado === 'expirado' ||
    attempt.estado === 'obsoleto'
  ) {
    return { resolution: 'stale', attempt }
  }

  if (!attempt.openai_response_id) {
    const userId = string(attempt.contexto.userId)
    if (!userId) {
      throw new HttpError(
        422,
        'El intento durable no contiene usuario.',
        'LEARNING_ATTEMPT_CONTEXT_INVALID',
      )
    }
    const files =
      attempt.modo_referencias === 'direct'
        ? await hydrateDirectDocumentReferences({
            supabase: args.supabase,
            userId,
            references: attempt.referencias,
          })
        : []
    const result = await args.createResponse(
      injectFiles(attempt.solicitud, files),
    )
    if (!result.ok) {
      throw new HttpError(
        result.code === 'MissingEnv' ? 500 : 502,
        'No se pudo recuperar la solicitud durable de recursos.',
        'LEARNING_ATTEMPT_OPENAI_FAILED',
        result,
      )
    }
    attempt = await linkLearningResourceGenerationResponse({
      supabase: args.supabase,
      attempt,
      response: result,
      cancelRemoteResponse: args.cancelRemoteResponse,
    })
  }

  const userId = string(attempt.contexto.userId)
  if (!userId || !attempt.openai_response_id) {
    throw new HttpError(
      422,
      'El intento durable no contiene identidad suficiente.',
      'LEARNING_ATTEMPT_CONTEXT_INVALID',
    )
  }
  try {
    const publication = await publishLearningResourceGenerationAtomically({
      supabase: args.supabase,
      cancelRemoteResponse: args.cancelRemoteResponse,
      attemptId: attempt.id,
      claimToken: attempt.token_reclamacion,
      generationJobId: attempt.entidad_id,
      userId,
      responseId: attempt.openai_response_id,
      localState: attempt.estado_openai === 'queued' ? 'queued' : 'running',
      openAIStatus: attempt.estado_openai ?? 'queued',
      startedAt: attempt.iniciado_en ?? new Date().toISOString(),
      metadata: { source: 'learning-resource-outbox-recovery' },
      referenceMode: attempt.modo_referencias,
      referenceQuery: attempt.consulta_referencias,
      references: attempt.referencias,
    })
    return {
      resolution: publication.resolution,
      attempt: await inspectAttempt(args.supabase, attempt.id),
    }
  } catch (error) {
    if (error instanceof LearningResourcePublicationError) {
      if (error.code === 'LEARNING_PUBLICATION_CONFLICT') {
        return {
          resolution: 'claimed_elsewhere',
          attempt: await inspectAttempt(args.supabase, attempt.id),
        }
      }
      if (error.code === 'LEARNING_PUBLICATION_STALE') {
        return {
          resolution: 'stale',
          attempt: await inspectAttempt(args.supabase, attempt.id),
        }
      }
    }
    throw error
  }
}

export async function adoptLearningResourceGenerationWebhook(args: {
  supabase: LearningResourcePublicationClient
  attemptId: string
  responseId: string
  openAIStatus: string
  startedAt: string
}): Promise<AttemptEnvelope> {
  const { data, error } = await callRpc(
    args.supabase,
    'adoptar_publicar_intento_recursos_ia_webhook',
    {
      p_intento_id: args.attemptId,
      p_openai_response_id: args.responseId,
      p_estado_openai: args.openAIStatus,
      p_iniciado_en: args.startedAt,
    },
  )
  const envelope = error ? null : parseEnvelope(data)
  if (!envelope) {
    throw new HttpError(
      500,
      'No se pudo adoptar el intento durable de recursos.',
      'LEARNING_ATTEMPT_ADOPTION_FAILED',
      error,
    )
  }
  return envelope
}
