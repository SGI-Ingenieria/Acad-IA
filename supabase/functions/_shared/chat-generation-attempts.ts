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
import type { OpenAIInputFile } from './openai-file-input.ts'
import { withOpenAIWebhookRouting } from './openai-webhook-routing.ts'
import { HttpError } from './utils.ts'

export type ChatAttemptClient = GenerationAttemptClient

type ChatAttemptState =
  | 'preparado'
  | 'reclamado'
  | 'respuesta_vinculada'
  | 'publicado'
  | 'fallido'
  | 'expirado'

const CHAT_ATTEMPT_STATES: ReadonlyArray<ChatAttemptState> = [
  'preparado',
  'reclamado',
  'respuesta_vinculada',
  'publicado',
  'fallido',
  'expirado',
]

export type ChatGenerationAttempt = Omit<
  DurableGenerationAttemptCore<ChatAttemptState>,
  'raw'
> & {
  tipo_conversacion: 'plan' | 'asignatura'
  conversacion_id: string
  mensaje_id: string
  usuario_id: string
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
  response: Pick<StructuredResponseSuccess, 'responseId' | 'openaiRaw'>
  cancelDuplicateResponse?: (responseId: string) => Promise<unknown>
}

export function parseChatGenerationAttempt(
  value: unknown,
): ChatGenerationAttempt | null {
  const core = parseDurableGenerationAttemptCore(value, CHAT_ATTEMPT_STATES)
  const item = core?.raw
  const conversationType = item?.tipo_conversacion
  if (
    !core ||
    !item ||
    (conversationType !== 'plan' && conversationType !== 'asignatura') ||
    !string(item.conversacion_id) ||
    !string(item.mensaje_id) ||
    !string(item.usuario_id)
  ) {
    return null
  }

  return {
    ...durableGenerationAttemptCoreValue(core),
    tipo_conversacion: conversationType,
    conversacion_id: String(item.conversacion_id),
    mensaje_id: String(item.mensaje_id),
    usuario_id: String(item.usuario_id),
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

async function inspectAttempt(
  supabase: ChatAttemptClient,
  attemptId: string,
): Promise<ChatGenerationAttempt | null> {
  try {
    const { data, error } = await callRpc(
      supabase,
      'consultar_intento_chat_ia',
      {
        p_intento_id: attemptId,
      },
    )
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
          committed.estado === 'publicado'
            ? 'already_applied'
            : 'already_linked',
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

export async function buildChatAttemptOpenAIRequest(args: {
  attempt: ChatGenerationAttempt
  supabase: ServiceRoleClient
  directInputFiles?: Array<OpenAIInputFile>
}): Promise<StructuredResponseOptions> {
  return await hydrateGenerationAttemptRequest({
    request: args.attempt.solicitud,
    attemptId: args.attempt.id,
    referenceMode: args.attempt.modo_referencias,
    references: args.attempt.referencias,
    userId: args.attempt.usuario_id,
    supabase: args.supabase,
    directInputFiles: args.directInputFiles,
    invalidSnapshotMessage:
      'El snapshot durable del chat no conserva la entrada de usuario.',
    invalidSnapshotCode: 'CHAT_ATTEMPT_SNAPSHOT_INVALID',
  })
}

export async function claimChatGenerationAttempts(args: {
  supabase: ChatAttemptClient
  actor: string
  limit?: number
}): Promise<Array<ChatGenerationAttempt>> {
  return await claimGenerationAttempts({
    client: args.supabase,
    rpcName: 'reclamar_intentos_chat_ia',
    rpcArgs: {
      p_actor: args.actor,
      p_limite: args.limit ?? 5,
    },
    parse: parseChatGenerationAttempt,
    errorCode: 'CHAT_ATTEMPT_CLAIM_FAILED',
    errorMessage: 'No se pudieron reclamar los intentos de chat pendientes.',
  })
}

export async function requeueChatGenerationAttempt(args: {
  supabase: ChatAttemptClient
  attempt: ChatGenerationAttempt
  error: unknown
}): Promise<boolean> {
  return await requeueGenerationAttempt({
    client: args.supabase,
    rpcName: 'reprogramar_intento_chat_ia',
    attemptId: args.attempt.id,
    claimToken: args.attempt.token_reclamacion,
    error: args.error,
  })
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
    supabase: args.supabase as unknown as ServiceRoleClient,
  })
  const response = await args.openai.responses.create(
    withOpenAIWebhookRouting(request),
  )
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
  return await adoptGenerationAttemptFromWebhook({
    client: args.supabase,
    rpcName: 'adoptar_publicar_intento_chat_ia_webhook',
    attemptId: args.attemptId,
    response: args.response,
    parseEnvelope,
    errorCode: 'CHAT_ATTEMPT_WEBHOOK_ADOPTION_FAILED',
    errorMessage: 'No se pudo adoptar el intento durable desde el webhook.',
  })
}
