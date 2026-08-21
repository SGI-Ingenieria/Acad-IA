// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment

import '@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'openai'

import { processGenerationResponse } from '../_shared/ai-response-finalizer.ts'
import { adoptAndPublishChatAttemptFromWebhook } from '../_shared/chat-generation-attempts.ts'
import { preflightResponse } from '../_shared/cors.ts'
import { adoptAndPublishEntityAttemptFromWebhook } from '../_shared/entity-generation-attempts.ts'
import {
  hasWebhookRelayHeaders,
  InvalidWebhookRelayError,
  verifyWebhookRelay,
} from '../_shared/webhook-relay-auth.ts'
import { requireEnv } from '../_shared/env.ts'
import { openAIResponseStartedAt } from '../_shared/generation-attempts.ts'
import { logEdgeRequest } from '../_shared/request.ts'
import { getServiceRoleClient } from '../_shared/supabase.ts'
import {
  InvalidOpenAIWebhookRequestError,
  requireOpenAIWebhookHeaders,
} from '../_shared/openai-webhook-auth.ts'
import { adoptLearningResourceGenerationWebhook } from '../learning-object-generate/attempts.ts'

import type { ResponseMetadata } from '../_shared/utils.ts'

const supabase = getServiceRoleClient()
const observabilityDb = supabase as any

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void
}

type ObservabilityMetadata = ResponseMetadata & {
  accion?: string
  observability_test_run_id?: string
  generation_attempt_id?: string
}

type WebhookEvent =
  | OpenAI.Webhooks.ResponseCompletedWebhookEvent
  | OpenAI.Webhooks.ResponseCancelledWebhookEvent
  | OpenAI.Webhooks.ResponseFailedWebhookEvent
  | OpenAI.Webhooks.ResponseIncompleteWebhookEvent
  | OpenAI.Webhooks.UnwrapWebhookEvent

function parseRelayedWebhookEvent(payload: string): WebhookEvent {
  const value = JSON.parse(payload) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidWebhookRelayError('Invalid relayed webhook payload.')
  }

  const event = value as Record<string, unknown>
  const data = event.data
  if (
    typeof event.id !== 'string' ||
    typeof event.type !== 'string' ||
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    typeof (data as Record<string, unknown>).id !== 'string'
  ) {
    throw new InvalidWebhookRelayError('Invalid relayed webhook event.')
  }

  return value as WebhookEvent
}

console.log('Starting OpenAI webhook responses function')
const client = new OpenAI({
  webhookSecret: requireEnv('OPENAI_WEBHOOK_SECRET'),
})

function nowIso() {
  return new Date().toISOString()
}

function getEventResponseId(event: WebhookEvent) {
  const data = (event as { data?: { id?: unknown } }).data
  return typeof data?.id === 'string' ? data.id : null
}

function getEventId(event: WebhookEvent) {
  return typeof event.id === 'string'
    ? event.id
    : `evt_local_${crypto.randomUUID()}`
}

async function recordWebhookEvent(event: WebhookEvent) {
  const responseId = getEventResponseId(event)
  let testRunId: string | null = null

  if (responseId) {
    const { data } = await observabilityDb
      .from('observability_test_runs')
      .select('id')
      .eq('openai_response_id', responseId)
      .maybeSingle()

    testRunId = data && typeof data.id === 'string' ? String(data.id) : null
  }

  const { error } = await observabilityDb.rpc('registrar_entrega_webhook_ia', {
    p_event_id: getEventId(event),
    p_event_type: event.type,
    p_openai_response_id: responseId,
    p_test_run_id: testRunId,
    p_payload: event,
  })

  if (error) {
    console.warn('No se pudo registrar evento de observabilidad:', error)
  }
}

async function markWebhookEvent(
  event: WebhookEvent,
  status: 'processed' | 'ignored' | 'failed',
  errorMessage?: string,
) {
  const { error } = await observabilityDb
    .from('observability_webhook_events')
    .update({
      processing_status: status,
      processing_error: errorMessage ?? null,
    })
    .eq('event_id', getEventId(event))

  if (error) {
    console.warn('No se pudo actualizar evento de observabilidad:', error)
  }
}

async function retrieveResponseOrMarkSample(
  event: WebhookEvent,
  responseId: string,
) {
  try {
    return await client.responses.retrieve(responseId)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo recuperar la respuesta de OpenAI.'

    await markWebhookEvent(event, 'ignored', message)
    console.warn('Webhook registrado sin recuperar response:', message)
    return null
  }
}

async function getDurableAttemptHandler(attemptId: string) {
  const { data, error } = await observabilityDb.rpc(
    'consultar_intento_generacion_ia',
    { p_intento_id: attemptId },
  )
  if (error) {
    throw new Error(
      `No se pudo consultar el intento durable ${attemptId}: ${error.message}`,
    )
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const handler = (data as Record<string, unknown>).handler
  return typeof handler === 'string' ? handler : null
}

async function publishDurableAttemptIfPresent(
  response: OpenAI.Responses.Response,
): Promise<'continue' | 'ignore'> {
  const metadata = response.metadata as ObservabilityMetadata | null
  const attemptId = metadata?.generation_attempt_id
  if (!attemptId) return 'continue'

  const handler = await getDurableAttemptHandler(attemptId)
  if (!handler) return 'continue'

  const adoption =
    handler === 'chat'
      ? await adoptAndPublishChatAttemptFromWebhook({
          supabase,
          attemptId,
          response,
        })
      : handler === 'plan' || handler === 'subject'
        ? await adoptAndPublishEntityAttemptFromWebhook({
            supabase,
            attemptId,
            response,
          })
        : handler === 'learning-resources'
          ? await adoptLearningResourceGenerationWebhook({
              supabase,
              attemptId,
              responseId: response.id,
              openAIStatus: String(response.status ?? 'unknown'),
              startedAt: openAIResponseStartedAt(response),
            })
          : null

  if (!adoption) {
    console.warn('Handler durable sin adaptador de webhook:', {
      attemptId,
      handler,
    })
    return 'continue'
  }
  if (
    adoption.resolution === 'claimed_elsewhere' ||
    adoption.resolution === 'stale'
  ) {
    return 'ignore'
  }
  return 'continue'
}

type ResponseLifecycleEvent =
  | OpenAI.Webhooks.ResponseCompletedWebhookEvent
  | OpenAI.Webhooks.ResponseCancelledWebhookEvent
  | OpenAI.Webhooks.ResponseFailedWebhookEvent
  | OpenAI.Webhooks.ResponseIncompleteWebhookEvent

async function handleResponseLifecycleEvent(
  event: ResponseLifecycleEvent,
  unsuccessful: boolean,
): Promise<void> {
  try {
    const responseId = event.data.id
    const response = await retrieveResponseOrMarkSample(event, responseId)
    if (!response) return

    const metadata = response.metadata as ObservabilityMetadata | null
    if (!metadata?.tabla) {
      const message = unsuccessful
        ? 'Respuesta no exitosa sin metadata tabla.'
        : 'Respuesta sin metadata tabla.'
      await markWebhookEvent(event, 'ignored', message)
      if (unsuccessful) {
        console.warn(
          'No se recibio metadata o tabla en la respuesta UNSUCCESSFUL',
        )
      }
      return
    }
    if ((await publishDurableAttemptIfPresent(response)) === 'ignore') {
      await markWebhookEvent(
        event,
        'ignored',
        'Otro response_id ya ganó el intento durable de chat.',
      )
      return
    }
    const result = await processGenerationResponse({
      supabase,
      response,
      actor: `webhook:${getEventId(event)}`,
    })
    await markWebhookEvent(event, 'processed')
    console.log(
      unsuccessful
        ? 'Respuesta no exitosa reconciliada por webhook:'
        : 'Respuesta de OpenAI reconciliada por webhook:',
      result,
    )
  } catch (error) {
    await markWebhookEvent(
      event,
      'failed',
      error instanceof Error ? error.message : String(error),
    )
    console.error(
      unsuccessful
        ? 'Error procesando respuesta UNSUCCESSFUL:'
        : 'Error procesando respuesta completed:',
      error,
    )
  }
}

async function handleCompletedResponse(
  event: OpenAI.Webhooks.ResponseCompletedWebhookEvent,
) {
  await handleResponseLifecycleEvent(event, false)
}

async function handleUnsuccesfulResponse(
  event:
    | OpenAI.Webhooks.ResponseCancelledWebhookEvent
    | OpenAI.Webhooks.ResponseFailedWebhookEvent
    | OpenAI.Webhooks.ResponseIncompleteWebhookEvent,
): Promise<void> {
  await handleResponseLifecycleEvent(event, true)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }

  const functionName = logEdgeRequest(req, 'openai-webhook-responses')

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const payload = await req.text()
    const event = hasWebhookRelayHeaders(req.headers)
      ? await (async () => {
          await verifyWebhookRelay({
            rawBody: payload,
            headers: req.headers,
            supabaseUrl: Deno.env.get('SUPABASE_URL'),
          })
          return parseRelayedWebhookEvent(payload)
        })()
      : await (async () => {
          requireOpenAIWebhookHeaders(req.headers)
          return await client.webhooks.unwrap(payload, req.headers)
        })()
    await recordWebhookEvent(event)

    switch (event.type) {
      case 'response.completed': {
        EdgeRuntime.waitUntil(handleCompletedResponse(event))
        break
      }
      case 'response.cancelled':
      case 'response.failed':
      case 'response.incomplete': {
        EdgeRuntime.waitUntil(handleUnsuccesfulResponse(event))
        break
      }
      default: {
        EdgeRuntime.waitUntil(
          markWebhookEvent(
            event,
            'ignored',
            `Evento no procesado: ${event.type}`,
          ),
        )
      }
    }

    console.log(
      `[${new Date().toISOString()}][${functionName}]: Request processed successfully`,
    )
    return new Response('OK', { status: 200 })
  } catch (error) {
    if (error instanceof InvalidWebhookRelayError) {
      console.error('Invalid webhook relay:', error.message)
      return new Response('Invalid webhook relay', { status: 401 })
    }
    if (error instanceof InvalidOpenAIWebhookRequestError) {
      console.error('Invalid OpenAI webhook request:', error.message)
      return new Response('Invalid webhook request', { status: 400 })
    }
    if (error instanceof OpenAI.InvalidWebhookSignatureError) {
      const signatureError = error as Error
      console.error('Invalid signature:', signatureError.message)
      return new Response('Invalid signature', { status: 400 })
    }

    console.error('Internal Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
})
