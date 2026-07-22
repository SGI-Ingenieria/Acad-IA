import type OpenAI from 'npm:openai@6.16.0'

import {
  type DocumentReferenceResolution,
  hydrateDirectDocumentReferences,
  hydrateRetrievalDocumentReferences,
} from './documentos-referencias.ts'
import { serviceClient } from './documentos-academicos.ts'
import type {
  StructuredResponseOptions,
  StructuredResponseSuccess,
} from './openai-service.ts'
import { HttpError } from './utils.ts'

type RpcResult = { data: unknown; error: unknown }

export type EntityAttemptClient = { rpc: unknown }
export type EntityGenerationHandler = 'plan' | 'subject'
export type EntityGenerationKind = 'plan' | 'asignatura'

export type EntityGenerationAttempt = {
  id: string
  tipo_entidad: EntityGenerationKind
  entidad_id: string
  handler: EntityGenerationHandler
  payload_version: number
  contexto: Record<string, unknown>
  solicitud: StructuredResponseOptions
  modo_referencias: DocumentReferenceResolution['mode']
  consulta_referencias: string
  referencias: DocumentReferenceResolution['references']
  estado:
    | 'preparado'
    | 'reclamado'
    | 'respuesta_vinculada'
    | 'publicado'
    | 'fallido'
    | 'expirado'
    | 'obsoleto'
  openai_response_id: string | null
  estado_openai: string | null
  iniciado_en: string | null
  token_reclamacion: string | null
  reclamado_por: string | null
  reclamado_hasta: string | null
  intentos: number
  siguiente_intento: string
  fecha_limite: string
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

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function parseReferences(
  value: unknown,
): DocumentReferenceResolution['references'] | null {
  if (!Array.isArray(value)) return null
  const parsed: DocumentReferenceResolution['references'] = []
  for (const candidate of value) {
    const item = record(candidate)
    const fileId = string(item?.fileId)
    const fileVersionId = string(item?.fileVersionId)
    const chunkIds = item?.chunkIds
    const scores = record(item?.scores)
    if (
      !fileId ||
      !fileVersionId ||
      !Array.isArray(chunkIds) ||
      chunkIds.some((chunkId) => typeof chunkId !== 'string') ||
      !scores ||
      Object.values(scores).some(
        (score) => typeof score !== 'number' || !Number.isFinite(score),
      )
    ) {
      return null
    }
    const resolvedAs = string(item?.resolvedAs)
    parsed.push({
      fileId,
      fileVersionId,
      ...(resolvedAs === 'direct' || resolvedAs === 'retrieval'
        ? { resolvedAs }
        : {}),
      chunkIds: [...chunkIds] as Array<string>,
      scores: scores as Record<string, number>,
    })
  }
  return parsed
}

export function parseEntityGenerationAttempt(
  value: unknown,
): EntityGenerationAttempt | null {
  const item = record(value)
  const references = parseReferences(item?.referencias)
  const request = record(item?.solicitud)
  const context = record(item?.contexto)
  const kind = item?.tipo_entidad
  const handler = item?.handler
  const mode = item?.modo_referencias
  const state = item?.estado
  if (
    !item ||
    !string(item.id) ||
    (kind !== 'plan' && kind !== 'asignatura') ||
    (handler !== 'plan' && handler !== 'subject') ||
    !string(item.entidad_id) ||
    typeof item.payload_version !== 'number' ||
    !context ||
    !request ||
    (mode !== 'none' && mode !== 'direct' && mode !== 'retrieval') ||
    !references ||
    (state !== 'preparado' &&
      state !== 'reclamado' &&
      state !== 'respuesta_vinculada' &&
      state !== 'publicado' &&
      state !== 'fallido' &&
      state !== 'expirado' &&
      state !== 'obsoleto') ||
    typeof item.consulta_referencias !== 'string' ||
    typeof item.intentos !== 'number' ||
    !string(item.siguiente_intento) ||
    !string(item.fecha_limite)
  ) {
    return null
  }
  return {
    id: String(item.id),
    tipo_entidad: kind,
    entidad_id: String(item.entidad_id),
    handler,
    payload_version: item.payload_version,
    contexto: context,
    solicitud: request as StructuredResponseOptions,
    modo_referencias: mode,
    consulta_referencias: item.consulta_referencias,
    referencias: references,
    estado: state,
    openai_response_id: string(item.openai_response_id),
    estado_openai: string(item.estado_openai),
    iniciado_en: string(item.iniciado_en),
    token_reclamacion: string(item.token_reclamacion),
    reclamado_por: string(item.reclamado_por),
    reclamado_hasta: string(item.reclamado_hasta),
    intentos: item.intentos,
    siguiente_intento: String(item.siguiente_intento),
    fecha_limite: String(item.fecha_limite),
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

function callRpc(
  client: EntityAttemptClient,
  functionName: string,
  args: Record<string, unknown>,
): PromiseLike<RpcResult> {
  return (
    client.rpc as (
      name: string,
      values: Record<string, unknown>,
    ) => PromiseLike<RpcResult>
  )(functionName, args)
}

function rpcFailure(code: string, message: string, details: unknown) {
  return new HttpError(500, message, code, details)
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

function userInputIndex(input: unknown): number {
  if (!Array.isArray(input)) return -1
  return input.findIndex((item) => {
    const row = record(item)
    return row?.role === 'user' && typeof row.content === 'string'
  })
}

export async function buildEntityAttemptOpenAIRequest(args: {
  attempt: EntityGenerationAttempt
  supabase: ReturnType<typeof serviceClient>
}): Promise<StructuredResponseOptions> {
  if (args.attempt.payload_version !== 1) {
    throw new HttpError(
      500,
      'La versión del intento durable no es compatible.',
      'ENTITY_ATTEMPT_VERSION_UNSUPPORTED',
    )
  }
  const request = structuredClone(args.attempt.solicitud)
  const index = userInputIndex(request.input)
  if (!Array.isArray(request.input) || index < 0) {
    throw new HttpError(
      500,
      'El intento durable no conserva la entrada de usuario.',
      'ENTITY_ATTEMPT_SNAPSHOT_INVALID',
    )
  }

  const input = [...request.input]
  const userItem = record(input[index])
  const userText = typeof userItem?.content === 'string' ? userItem.content : ''
  let tools = request.tools
  if (args.attempt.modo_referencias === 'direct') {
    const userId = string(args.attempt.contexto.userId)
    if (!userId) {
      throw new HttpError(
        500,
        'El intento durable no conserva el usuario de las referencias.',
        'ENTITY_ATTEMPT_CONTEXT_INVALID',
      )
    }
    const inputFiles = await hydrateDirectDocumentReferences({
      supabase: args.supabase,
      userId,
      references: args.attempt.referencias,
    })
    input[index] = {
      ...userItem,
      content: [...inputFiles, { type: 'input_text' as const, text: userText }],
    } as (typeof input)[number]
  } else if (
    args.attempt.modo_referencias === 'retrieval' &&
    args.attempt.referencias.every(
      (reference) => reference.chunkIds.length === 0,
    )
  ) {
    // Cascada: el vector store original pudo expirar entre el intento y este
    // envío; se materializa uno vigente a partir de las versiones congeladas.
    const userId = string(args.attempt.contexto.userId)
    if (!userId) {
      throw new HttpError(
        500,
        'El intento durable no conserva el usuario de las referencias.',
        'ENTITY_ATTEMPT_CONTEXT_INVALID',
      )
    }
    const hydrated = await hydrateRetrievalDocumentReferences({
      supabase: args.supabase,
      userId,
      references: args.attempt.referencias,
    })
    input[index] = {
      ...userItem,
      content: [
        ...hydrated.inputFiles,
        { type: 'input_text' as const, text: userText },
      ],
    } as (typeof input)[number]
    const otherTools = (Array.isArray(tools) ? tools : []).filter(
      (tool) => record(tool)?.type !== 'file_search',
    )
    tools = hydrated.vectorStoreId
      ? ([
          ...otherTools,
          {
            type: 'file_search',
            vector_store_ids: [hydrated.vectorStoreId],
          },
        ] as typeof tools)
      : otherTools.length
        ? (otherTools as typeof tools)
        : undefined
  }

  return {
    ...request,
    metadata: {
      ...(request.metadata ?? {}),
      generation_attempt_id: args.attempt.id,
    },
    ...(tools !== request.tools ? { tools } : {}),
    input,
  }
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
  const { data, error } = await callRpc(
    args.supabase,
    'reclamar_intentos_generacion_ia',
    {
      p_handler: args.handler,
      p_actor: args.actor,
      p_limite: args.limit ?? 5,
    },
  )
  if (error || !Array.isArray(data)) {
    throw rpcFailure(
      'ENTITY_ATTEMPT_CLAIM_FAILED',
      'No se pudieron reclamar las generaciones durables.',
      error ?? data,
    )
  }
  return data
    .map(parseEntityGenerationAttempt)
    .filter((attempt): attempt is EntityGenerationAttempt => attempt !== null)
}

export async function requeueEntityGenerationAttempt(args: {
  supabase: EntityAttemptClient
  attempt: EntityGenerationAttempt
  error: unknown
}): Promise<boolean> {
  if (!args.attempt.token_reclamacion) return false
  const serialized =
    args.error instanceof Error
      ? { name: args.error.name, message: args.error.message }
      : { message: String(args.error) }
  try {
    const { data, error } = await callRpc(
      args.supabase,
      'reprogramar_intento_generacion_ia',
      {
        p_intento_id: args.attempt.id,
        p_token_reclamacion: args.attempt.token_reclamacion,
        p_error: serialized,
      },
    )
    return !error && data === true
  } catch {
    return false
  }
}

export async function recoverEntityGenerationAttempt(args: {
  supabase: EntityAttemptClient & ReturnType<typeof serviceClient>
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
  const response = await args.openai.responses.create(request)
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
  const { data, error } = await callRpc(
    args.supabase,
    'adoptar_publicar_intento_entidad_ia_webhook',
    {
      p_intento_id: args.attemptId,
      p_openai_response_id: args.response.id,
      p_estado_openai: String(args.response.status ?? 'unknown'),
      p_iniciado_en:
        typeof args.response.created_at === 'number'
          ? new Date(args.response.created_at * 1000).toISOString()
          : new Date().toISOString(),
    },
  )
  const envelope = !error ? parseEnvelope(data) : null
  if (!envelope) {
    throw rpcFailure(
      'ENTITY_ATTEMPT_WEBHOOK_ADOPTION_FAILED',
      'No se pudo adoptar la generación durable desde el webhook.',
      error ?? data,
    )
  }
  return envelope
}

export async function inspectEntityGenerationAttempt(
  supabase: EntityAttemptClient,
  attemptId: string,
): Promise<EntityGenerationAttempt | null> {
  return await inspectAttempt(supabase, attemptId)
}
