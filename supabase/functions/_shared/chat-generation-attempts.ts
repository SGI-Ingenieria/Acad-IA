import type OpenAI from 'npm:openai@6.16.0'

import {
  hydrateDirectDocumentReferences,
  type DocumentReferenceResolution,
} from './documentos-referencias.ts'
import { serviceClient } from './documentos-academicos.ts'
import type {
  StructuredResponseOptions,
  StructuredResponseSuccess,
} from './openai-service.ts'
import type { OpenAIInputFile } from './openai-file-input.ts'
import { HttpError } from './utils.ts'

type RpcResult = {
  data: unknown
  error: unknown
}

export type ChatAttemptClient = {
  rpc: unknown
}

export type ChatGenerationAttempt = {
  id: string
  tipo_conversacion: 'plan' | 'asignatura'
  conversacion_id: string
  mensaje_id: string
  usuario_id: string
  estado:
    | 'preparado'
    | 'reclamado'
    | 'respuesta_vinculada'
    | 'publicado'
    | 'fallido'
    | 'expirado'
  solicitud: StructuredResponseOptions
  modo_referencias: DocumentReferenceResolution['mode']
  consulta_referencias: string
  referencias: DocumentReferenceResolution['references']
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

type AttemptEnvelope = {
  resolution: string
  attempt: ChatGenerationAttempt | null
  job?: unknown
}

export type PrepareChatAttemptArgs = {
  supabase: ChatAttemptClient
  attemptId: string
  conversationType: 'plan' | 'asignatura'
  conversationId: string
  messageId: string
  userId: string
  request: StructuredResponseOptions
  referenceMode: DocumentReferenceResolution['mode']
  referenceQuery: string
  references: DocumentReferenceResolution['references']
  actor?: string
}

export type PublishDurableChatResponseArgs = {
  supabase: ChatAttemptClient
  attempt: ChatGenerationAttempt
  response: Pick<
    StructuredResponseSuccess,
    'responseId' | 'openaiRaw'
  >
  cancelDuplicateResponse?: (responseId: string) => Promise<unknown>
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
    parsed.push({
      fileId,
      fileVersionId,
      chunkIds: [...chunkIds] as Array<string>,
      scores: scores as Record<string, number>,
    })
  }
  return parsed
}

export function parseChatGenerationAttempt(
  value: unknown,
): ChatGenerationAttempt | null {
  const item = record(value)
  const references = parseReferences(item?.referencias)
  const request = record(item?.solicitud)
  const conversationType = item?.tipo_conversacion
  const mode = item?.modo_referencias
  const state = item?.estado
  if (
    !item ||
    !string(item.id) ||
    (conversationType !== 'plan' && conversationType !== 'asignatura') ||
    !string(item.conversacion_id) ||
    !string(item.mensaje_id) ||
    !string(item.usuario_id) ||
    !request ||
    (mode !== 'none' && mode !== 'direct' && mode !== 'retrieval') ||
    !references ||
    (state !== 'preparado' &&
      state !== 'reclamado' &&
      state !== 'respuesta_vinculada' &&
      state !== 'publicado' &&
      state !== 'fallido' &&
      state !== 'expirado') ||
    typeof item.consulta_referencias !== 'string' ||
    typeof item.intentos !== 'number' ||
    !string(item.siguiente_intento) ||
    !string(item.fecha_limite)
  ) {
    return null
  }

  return {
    id: String(item.id),
    tipo_conversacion: conversationType,
    conversacion_id: String(item.conversacion_id),
    mensaje_id: String(item.mensaje_id),
    usuario_id: String(item.usuario_id),
    estado: state,
    solicitud: request as StructuredResponseOptions,
    modo_referencias: mode,
    consulta_referencias: item.consulta_referencias,
    referencias: references,
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

function parseEnvelope(value: unknown): AttemptEnvelope | null {
  const envelope = record(value)
  const resolution = string(envelope?.resolution)
  if (!envelope || !resolution) return null
  return {
    resolution,
    attempt: parseChatGenerationAttempt(envelope.attempt),
    job: envelope.job,
  }
}

function rpcFailure(code: string, message: string, details: unknown) {
  return new HttpError(500, message, code, details)
}

function callRpc(
  client: ChatAttemptClient,
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

async function inspectAttempt(
  supabase: ChatAttemptClient,
  attemptId: string,
): Promise<ChatGenerationAttempt | null> {
  try {
    const { data, error } = await callRpc(supabase, 'consultar_intento_chat_ia', {
      p_intento_id: attemptId,
    })
    if (error) return null
    return parseChatGenerationAttempt(data)
  } catch {
    return null
  }
}

/**
 * La identidad la genera la Edge Function antes de la RPC. Repetir esta RPC
 * después de una respuesta de transporte incierta no crea otro outbox.
 */
export async function prepareChatGenerationAttempt(
  args: PrepareChatAttemptArgs,
): Promise<ChatGenerationAttempt> {
  const rpcArgs = {
    p_intento_id: args.attemptId,
    p_tipo_conversacion: args.conversationType,
    p_conversacion_id: args.conversationId,
    p_mensaje_id: args.messageId,
    p_usuario_id: args.userId,
    p_solicitud: args.request,
    p_modo_referencias: args.referenceMode,
    p_consulta_referencias: args.referenceQuery,
    p_referencias: args.references,
    p_actor: args.actor ?? 'create-chat-conversation',
  }
  let lastFailure: unknown = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await callRpc(
        args.supabase,
        'preparar_intento_chat_ia',
        rpcArgs,
      )
      const prepared = !error ? parseChatGenerationAttempt(data) : null
      if (prepared) return prepared
      lastFailure = error ?? 'RPC_WITHOUT_RESULT'
    } catch (error) {
      lastFailure = error
    }

    const committed = await inspectAttempt(args.supabase, args.attemptId)
    if (committed) return committed
  }

  throw rpcFailure(
    'CHAT_ATTEMPT_PREPARE_FAILED',
    'No se pudo preparar de forma durable la solicitud de IA.',
    lastFailure,
  )
}

async function linkResponseWithVerification(args: {
  supabase: ChatAttemptClient
  attempt: ChatGenerationAttempt
  responseId: string
  openAIStatus: string
  startedAt: string
}): Promise<AttemptEnvelope> {
  const token = args.attempt.token_reclamacion
  if (!token) {
    return {
      resolution: 'claimed_elsewhere',
      attempt: await inspectAttempt(args.supabase, args.attempt.id),
    }
  }
  const rpcArgs = {
    p_intento_id: args.attempt.id,
    p_token_reclamacion: token,
    p_openai_response_id: args.responseId,
    p_estado_openai: args.openAIStatus,
    p_iniciado_en: args.startedAt,
  }
  let lastFailure: unknown = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await callRpc(
        args.supabase,
        'vincular_respuesta_intento_chat_ia',
        rpcArgs,
      )
      const envelope = !error ? parseEnvelope(data) : null
      if (envelope) return envelope
      lastFailure = error ?? 'RPC_WITHOUT_RESULT'
    } catch (error) {
      lastFailure = error
    }

    const committed = await inspectAttempt(args.supabase, args.attempt.id)
    if (committed?.openai_response_id === args.responseId) {
      return {
        resolution:
          committed.estado === 'publicado' ? 'already_applied' : 'already_linked',
        attempt: committed,
      }
    }
    if (committed?.openai_response_id) {
      return { resolution: 'claimed_elsewhere', attempt: committed }
    }
  }

  throw rpcFailure(
    'CHAT_ATTEMPT_LINK_FAILED',
    'No se pudo confirmar de forma durable la respuesta de OpenAI.',
    lastFailure,
  )
}

async function publishWithVerification(args: {
  supabase: ChatAttemptClient
  attempt: ChatGenerationAttempt
}): Promise<AttemptEnvelope> {
  const token = args.attempt.token_reclamacion
  if (!token && args.attempt.estado !== 'publicado') {
    return { resolution: 'claimed_elsewhere', attempt: args.attempt }
  }
  const rpcArgs = {
    p_intento_id: args.attempt.id,
    p_token_reclamacion: token,
  }
  let lastFailure: unknown = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await callRpc(
        args.supabase,
        'publicar_intento_chat_ia',
        rpcArgs,
      )
      const envelope = !error ? parseEnvelope(data) : null
      if (envelope) return envelope
      lastFailure = error ?? 'RPC_WITHOUT_RESULT'
    } catch (error) {
      lastFailure = error
    }

    const committed = await inspectAttempt(args.supabase, args.attempt.id)
    if (committed?.estado === 'publicado') {
      return {
        resolution: 'already_applied',
        attempt: committed,
      }
    }
  }

  throw rpcFailure(
    'CHAT_ATTEMPT_PUBLICATION_FAILED',
    'La respuesta quedó resguardada, pero no se pudo confirmar su publicación.',
    lastFailure,
  )
}

/**
 * Vincula y publica usando operaciones idempotentes. Ante una respuesta de
 * transporte incierta consulta el estado durable antes de repetir. Sólo se
 * cancela una Response cuando Postgres demuestra que otro response_id ganó.
 */
export async function publishDurableChatResponse(
  args: PublishDurableChatResponseArgs,
): Promise<AttemptEnvelope> {
  const responseId = args.response.responseId
  const raw = args.response.openaiRaw
  const linked = await linkResponseWithVerification({
    supabase: args.supabase,
    attempt: args.attempt,
    responseId,
    openAIStatus: String(raw.status ?? 'queued'),
    startedAt:
      typeof raw.created_at === 'number'
        ? new Date(raw.created_at * 1000).toISOString()
        : new Date().toISOString(),
  })

  if (
    linked.resolution === 'claimed_elsewhere' &&
    Boolean(linked.attempt?.openai_response_id) &&
    linked.attempt?.openai_response_id !== responseId
  ) {
    if (args.cancelDuplicateResponse) {
      try {
        await args.cancelDuplicateResponse(responseId)
      } catch (error) {
        console.warn('No se pudo cancelar una respuesta duplicada de chat.', {
          attemptId: args.attempt.id,
          responseId,
          winnerResponseId: linked.attempt?.openai_response_id,
          error,
        })
      }
    }
    return linked
  }

  const durableAttempt = linked.attempt ?? args.attempt
  return await publishWithVerification({
    supabase: args.supabase,
    attempt: durableAttempt,
  })
}

function userInputIndex(input: unknown): number {
  if (!Array.isArray(input)) return -1
  return input.findIndex(
    (item) => record(item)?.role === 'user' && typeof record(item)?.content === 'string',
  )
}

export async function buildChatAttemptOpenAIRequest(args: {
  attempt: ChatGenerationAttempt
  supabase: ReturnType<typeof serviceClient>
  directInputFiles?: Array<OpenAIInputFile>
}): Promise<StructuredResponseOptions> {
  const request = structuredClone(args.attempt.solicitud)
  const index = userInputIndex(request.input)
  if (!Array.isArray(request.input) || index < 0) {
    throw new HttpError(
      500,
      'El snapshot durable del chat no conserva la entrada de usuario.',
      'CHAT_ATTEMPT_SNAPSHOT_INVALID',
    )
  }

  const input = [...request.input]
  const userItem = record(input[index])
  const userText = typeof userItem?.content === 'string' ? userItem.content : ''
  if (args.attempt.modo_referencias === 'direct') {
    const inputFiles =
      args.directInputFiles ??
      (await hydrateDirectDocumentReferences({
        supabase: args.supabase,
        userId: args.attempt.usuario_id,
        references: args.attempt.referencias,
      }))
    input[index] = {
      ...userItem,
      content: [
        ...inputFiles,
        { type: 'input_text' as const, text: userText },
      ],
    } as (typeof input)[number]
  }

  return {
    ...request,
    metadata: {
      ...(request.metadata ?? {}),
      generation_attempt_id: args.attempt.id,
    },
    input,
  }
}

export async function claimChatGenerationAttempts(args: {
  supabase: ChatAttemptClient
  actor: string
  limit?: number
}): Promise<Array<ChatGenerationAttempt>> {
  const { data, error } = await callRpc(
    args.supabase,
    'reclamar_intentos_chat_ia',
    {
      p_actor: args.actor,
      p_limite: args.limit ?? 5,
    },
  )
  if (error || !Array.isArray(data)) {
    throw rpcFailure(
      'CHAT_ATTEMPT_CLAIM_FAILED',
      'No se pudieron reclamar los intentos de chat pendientes.',
      error ?? data,
    )
  }
  return data.map(parseChatGenerationAttempt).filter(
    (attempt): attempt is ChatGenerationAttempt => attempt !== null,
  )
}

export async function requeueChatGenerationAttempt(args: {
  supabase: ChatAttemptClient
  attempt: ChatGenerationAttempt
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
      'reprogramar_intento_chat_ia',
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

export async function recoverChatGenerationAttempt(args: {
  supabase: ChatAttemptClient
  openai: OpenAI
  attempt: ChatGenerationAttempt
}): Promise<AttemptEnvelope> {
  if (args.attempt.openai_response_id) {
    return await publishWithVerification({
      supabase: args.supabase,
      attempt: args.attempt,
    })
  }

  const request = await buildChatAttemptOpenAIRequest({
    attempt: args.attempt,
    supabase: args.supabase as unknown as ReturnType<typeof serviceClient>,
  })
  const response = await args.openai.responses.create(request)
  return await publishDurableChatResponse({
    supabase: args.supabase,
    attempt: args.attempt,
    response: {
      responseId: response.id,
      openaiRaw: response,
    },
    cancelDuplicateResponse: async (responseId) => {
      await args.openai.responses.cancel(responseId)
    },
  })
}

export async function adoptAndPublishChatAttemptFromWebhook(args: {
  supabase: ChatAttemptClient
  attemptId: string
  response: OpenAI.Responses.Response
}): Promise<AttemptEnvelope> {
  const { data, error } = await callRpc(
    args.supabase,
    'adoptar_publicar_intento_chat_ia_webhook',
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
      'CHAT_ATTEMPT_WEBHOOK_ADOPTION_FAILED',
      'No se pudo adoptar el intento durable desde el webhook.',
      error ?? data,
    )
  }
  return envelope
}
