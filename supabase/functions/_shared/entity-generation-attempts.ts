import type OpenAI from 'npm:openai@6.16.0'

import type { DocumentReferenceResolution } from './documentos-referencias.ts'
import {
  adoptGenerationAttemptFromWebhook,
  asRecord as record,
  callGenerationRpc as callRpc,
  claimGenerationAttempts,
  durableGenerationAttemptCoreValue,
  generationRpcFailure as rpcFailure,
  hydrateGenerationAttemptRequest,
  nonEmptyString as string,
  parseDurableGenerationAttemptCore,
  requeueGenerationAttempt,
  type DurableGenerationAttemptCore,
  type GenerationAttemptClient,
} from './generation-attempts.ts'
import type { ServiceRoleClient } from './supabase.ts'
import type {
  StructuredResponseOptions,
  StructuredResponseSuccess,
} from './openai-service.ts'
import { withOpenAIWebhookRouting } from './openai-webhook-routing.ts'
import { HttpError } from './utils.ts'

export type EntityAttemptClient = GenerationAttemptClient
export type EntityGenerationHandler = 'plan' | 'subject'
export type EntityGenerationKind = 'plan' | 'asignatura'
type EntityAttemptState =
  | 'preparado'
  | 'reclamado'
  | 'respuesta_vinculada'
  | 'publicado'
  | 'fallido'
  | 'expirado'
  | 'obsoleto'

const ENTITY_ATTEMPT_STATES: ReadonlyArray<EntityAttemptState> = [
  'preparado',
  'reclamado',
  'respuesta_vinculada',
  'publicado',
  'fallido',
  'expirado',
  'obsoleto',
]

export type EntityGenerationAttempt = Omit<
  DurableGenerationAttemptCore<EntityAttemptState>,
  'raw'
> & {
  tipo_entidad: EntityGenerationKind
  entidad_id: string
  handler: EntityGenerationHandler
  payload_version: number
  contexto: Record<string, unknown>
}

export type EntityAttemptEnvelope = {
  resolution: string
  attempt: EntityGenerationAttempt | null
  job?: unknown
  entity?: Record<string, unknown> | null
}

type PrepareEntityAttemptArgs = {
  supabase: EntityAttemptClient
  attemptId: string
  kind: EntityGenerationKind
  entityId: string
  userId: string
  request: StructuredResponseOptions
  referenceMode: DocumentReferenceResolution['mode']
  referenceQuery: string
  references: DocumentReferenceResolution['references']
  context?: Record<string, unknown>
  actor?: string
}

export function parseEntityGenerationAttempt(
  value: unknown,
): EntityGenerationAttempt | null {
  const core = parseDurableGenerationAttemptCore(value, ENTITY_ATTEMPT_STATES)
  const item = core?.raw
  const context = record(item?.contexto)
  const kind = item?.tipo_entidad
  const handler = item?.handler
  if (
    !core ||
    !item ||
    (kind !== 'plan' && kind !== 'asignatura') ||
    (handler !== 'plan' && handler !== 'subject') ||
    !string(item.entidad_id) ||
    typeof item.payload_version !== 'number' ||
    !context
  ) {
    return null
  }
  return {
    ...durableGenerationAttemptCoreValue(core),
    tipo_entidad: kind,
    entidad_id: String(item.entidad_id),
    handler,
    payload_version: item.payload_version,
    contexto: context,
  }
}

function parseEnvelope(value: unknown): EntityAttemptEnvelope | null {
  const envelope = record(value)
  const resolution = string(envelope?.resolution)
  if (!envelope || !resolution) return null
  return {
    resolution,
    attempt: parseEntityGenerationAttempt(envelope.attempt),
    job: envelope.job,
    entity: record(envelope.entity),
  }
}

export async function prepareEntityGenerationAttempt(
  args: PrepareEntityAttemptArgs,
): Promise<EntityGenerationAttempt> {
  const rpcArgs = {
    p_intento_id: args.attemptId,
    p_tipo_entidad: args.kind,
    p_entidad_id: args.entityId,
    p_usuario_id: args.userId,
    p_contexto: args.context ?? {},
    p_solicitud: args.request,
    p_modo_referencias: args.referenceMode,
    p_consulta_referencias: args.referenceQuery,
    p_referencias: args.references,
    p_actor: args.actor ?? `edge:${args.kind}`,
  }
  let lastFailure: unknown = null

  for (let rpcAttempt = 0; rpcAttempt < 2; rpcAttempt += 1) {
    try {
      const { data, error } = await callRpc(
        args.supabase,
        'preparar_intento_entidad_ia',
        rpcArgs,
      )
      const envelope = !error ? parseEnvelope(data) : null
      if (envelope?.attempt) return envelope.attempt
      lastFailure = error ?? 'RPC_WITHOUT_RESULT'
    } catch (error) {
      lastFailure = error
    }
    const committed = await inspectAttempt(args.supabase, args.attemptId)
    if (committed) return committed
  }

  throw rpcFailure(
    'ENTITY_ATTEMPT_PREPARE_FAILED',
    'No se pudo preparar de forma durable la generación.',
    lastFailure,
  )
}

export async function buildEntityAttemptOpenAIRequest(args: {
  attempt: EntityGenerationAttempt
  supabase: ServiceRoleClient
}): Promise<StructuredResponseOptions> {
  if (args.attempt.payload_version !== 1) {
    throw new HttpError(
      500,
      'La versión del intento durable no es compatible.',
      'ENTITY_ATTEMPT_VERSION_UNSUPPORTED',
    )
  }
  const referencesNeedUser =
    args.attempt.modo_referencias === 'direct' ||
    (args.attempt.modo_referencias === 'retrieval' &&
      args.attempt.referencias.every(
        (reference) => reference.chunkIds.length === 0,
      ))
  const userId = string(args.attempt.contexto.userId)
  if (referencesNeedUser && !userId) {
    throw new HttpError(
      500,
      'El intento durable no conserva el usuario de las referencias.',
      'ENTITY_ATTEMPT_CONTEXT_INVALID',
    )
  }

  return await hydrateGenerationAttemptRequest({
    request: args.attempt.solicitud,
    attemptId: args.attempt.id,
    referenceMode: args.attempt.modo_referencias,
    references: args.attempt.referencias,
    userId: userId ?? '',
    supabase: args.supabase,
    invalidSnapshotMessage:
      'El intento durable no conserva la entrada de usuario.',
    invalidSnapshotCode: 'ENTITY_ATTEMPT_SNAPSHOT_INVALID',
  })
}

async function inspectAttempt(
  supabase: EntityAttemptClient,
  attemptId: string,
): Promise<EntityGenerationAttempt | null> {
  try {
    const { data, error } = await callRpc(
      supabase,
      'consultar_intento_generacion_ia',
      { p_intento_id: attemptId },
    )
    if (error) return null
    return parseEntityGenerationAttempt(data)
  } catch {
    return null
  }
}

async function publishLinkedAttempt(args: {
  supabase: EntityAttemptClient
  attempt: EntityGenerationAttempt
}): Promise<EntityAttemptEnvelope> {
  if (!args.attempt.token_reclamacion) {
    throw rpcFailure(
      'ENTITY_ATTEMPT_TOKEN_MISSING',
      'El intento durable no tiene un arrendamiento vigente.',
      args.attempt,
    )
  }
  const { data, error } = await callRpc(
    args.supabase,
    'publicar_intento_entidad_ia',
    {
      p_intento_id: args.attempt.id,
      p_token_reclamacion: args.attempt.token_reclamacion,
    },
  )
  const envelope = !error ? parseEnvelope(data) : null
  if (!envelope) {
    throw rpcFailure(
      'ENTITY_ATTEMPT_PUBLISH_FAILED',
      'No se pudo publicar la generación durable.',
      error ?? data,
    )
  }
  return envelope
}

export async function publishDurableEntityResponse(args: {
  supabase: EntityAttemptClient
  attempt: EntityGenerationAttempt
  response: Pick<StructuredResponseSuccess, 'responseId' | 'openaiRaw'>
  cancelDuplicateResponse?: (responseId: string) => Promise<unknown>
}): Promise<EntityAttemptEnvelope> {
  const { data, error } = await callRpc(
    args.supabase,
    'vincular_respuesta_intento_generacion_ia',
    {
      p_intento_id: args.attempt.id,
      p_token_reclamacion: args.attempt.token_reclamacion,
      p_openai_response_id: args.response.responseId,
      p_estado_openai: String(args.response.openaiRaw.status ?? 'queued'),
      p_iniciado_en:
        typeof args.response.openaiRaw.created_at === 'number'
          ? new Date(args.response.openaiRaw.created_at * 1000).toISOString()
          : new Date().toISOString(),
    },
  )
  const linked = !error ? parseEnvelope(data) : null
  if (!linked?.attempt) {
    throw rpcFailure(
      'ENTITY_ATTEMPT_LINK_FAILED',
      'No se pudo vincular la respuesta a la generación durable.',
      error ?? data,
    )
  }
  if (linked.resolution === 'stale') return linked

  if (
    linked.attempt.openai_response_id &&
    linked.attempt.openai_response_id !== args.response.responseId
  ) {
    try {
      await args.cancelDuplicateResponse?.(args.response.responseId)
    } catch {
      // El ganador local ya está protegido por CAS; cancelar es best-effort.
    }
    return await publishLinkedAttempt({
      supabase: args.supabase,
      attempt: linked.attempt,
    })
  }
  if (linked.resolution === 'claimed_elsewhere') return linked

  return await publishLinkedAttempt({
    supabase: args.supabase,
    attempt: linked.attempt,
  })
}

export async function claimEntityGenerationAttempts(args: {
  supabase: EntityAttemptClient
  handler: EntityGenerationHandler
  actor: string
  limit?: number
}): Promise<Array<EntityGenerationAttempt>> {
  return await claimGenerationAttempts({
    client: args.supabase,
    rpcName: 'reclamar_intentos_generacion_ia',
    rpcArgs: {
      p_handler: args.handler,
      p_actor: args.actor,
      p_limite: args.limit ?? 5,
    },
    parse: parseEntityGenerationAttempt,
    errorCode: 'ENTITY_ATTEMPT_CLAIM_FAILED',
    errorMessage: 'No se pudieron reclamar las generaciones durables.',
  })
}

export async function requeueEntityGenerationAttempt(args: {
  supabase: EntityAttemptClient
  attempt: EntityGenerationAttempt
  error: unknown
}): Promise<boolean> {
  return await requeueGenerationAttempt({
    client: args.supabase,
    rpcName: 'reprogramar_intento_generacion_ia',
    attemptId: args.attempt.id,
    claimToken: args.attempt.token_reclamacion,
    error: args.error,
  })
}

export async function recoverEntityGenerationAttempt(args: {
  supabase: EntityAttemptClient & ServiceRoleClient
  openai: OpenAI
  attempt: EntityGenerationAttempt
}): Promise<EntityAttemptEnvelope> {
  if (args.attempt.openai_response_id) {
    return await publishLinkedAttempt({
      supabase: args.supabase,
      attempt: args.attempt,
    })
  }
  const request = await buildEntityAttemptOpenAIRequest({
    attempt: args.attempt,
    supabase: args.supabase,
  })
  const response = await args.openai.responses.create(
    withOpenAIWebhookRouting(request),
  )
  return await publishDurableEntityResponse({
    supabase: args.supabase,
    attempt: args.attempt,
    response: { responseId: response.id, openaiRaw: response },
    cancelDuplicateResponse: async (responseId) => {
      await args.openai.responses.cancel(responseId)
    },
  })
}

export async function adoptAndPublishEntityAttemptFromWebhook(args: {
  supabase: EntityAttemptClient
  attemptId: string
  response: OpenAI.Responses.Response
}): Promise<EntityAttemptEnvelope> {
  return await adoptGenerationAttemptFromWebhook({
    client: args.supabase,
    rpcName: 'adoptar_publicar_intento_entidad_ia_webhook',
    attemptId: args.attemptId,
    response: args.response,
    parseEnvelope,
    errorCode: 'ENTITY_ATTEMPT_WEBHOOK_ADOPTION_FAILED',
    errorMessage: 'No se pudo adoptar la generación durable desde el webhook.',
  })
}

export async function inspectEntityGenerationAttempt(
  supabase: EntityAttemptClient,
  attemptId: string,
): Promise<EntityGenerationAttempt | null> {
  return await inspectAttempt(supabase, attemptId)
}
