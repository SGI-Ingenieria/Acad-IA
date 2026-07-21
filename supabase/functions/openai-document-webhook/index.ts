import '@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'npm:openai@6.16.0'

import { corsHeaders } from '../_shared/cors.ts'
import { requireEnv, serviceClient } from '../_shared/documentos-academicos.ts'
import { finalizeOpenAIExtraction } from '../_shared/documentos-extraccion.ts'
import { wakeDocumentWorker } from '../_shared/documentos-worker.ts'
import { sendError, sendSuccess } from '../_shared/utils.ts'

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void }

type WebhookEvent = {
  id?: unknown
  type?: unknown
  data?: { id?: unknown }
}

async function processEvent(event: WebhookEvent) {
  const responseId = typeof event.data?.id === 'string' ? event.data.id : null
  const eventId = typeof event.id === 'string' ? event.id : null
  if (!responseId || !eventId) return
  const supabase = serviceClient()
  try {
    if (
      ![
        'response.completed',
        'response.failed',
        'response.incomplete',
        'response.cancelled',
      ].includes(String(event.type))
    )
      return
    const client = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
    const response = await client.responses.retrieve(responseId)
    const result = await finalizeOpenAIExtraction({ supabase, response })
    if (result.applied && result.reason === 'completed') {
      await wakeDocumentWorker('openai-document-webhook').catch((error) =>
        console.warn('No se pudo continuar la ingesta documental:', error),
      )
    }
    await supabase
      .from('document_webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        processing_error: result.applied ? null : result.reason,
      })
      .eq('event_id', eventId)
  } catch (error) {
    console.error('openai-document-webhook failed', error)
    await supabase
      .from('document_webhook_events')
      .update({
        processing_error:
          error instanceof Error ? error.message : String(error),
      })
      .eq('event_id', eventId)
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST')
    return sendError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
  try {
    const raw = await request.text()
    const client = new OpenAI({
      apiKey: requireEnv('OPENAI_API_KEY'),
      webhookSecret: requireEnv('OPENAI_DOCUMENT_WEBHOOK_SECRET'),
    })
    const event = (await client.webhooks.unwrap(
      raw,
      request.headers,
    )) as WebhookEvent
    const eventId = typeof event.id === 'string' ? event.id : null
    const responseId = typeof event.data?.id === 'string' ? event.data.id : null
    if (!eventId || !responseId || typeof event.type !== 'string') {
      return sendError(
        400,
        'Evento de OpenAI incompleto.',
        'INVALID_WEBHOOK_EVENT',
      )
    }
    const supabase = serviceClient()
    const { error: eventError } = await supabase.rpc(
      'registrar_webhook_documental',
      {
        p_event_id: eventId,
        p_event_type: event.type,
        p_response_id: responseId,
        p_payload: JSON.parse(raw),
      },
    )
    if (eventError)
      return sendError(
        500,
        'No se pudo registrar el webhook.',
        'WEBHOOK_EVENT_SAVE_FAILED',
      )
    EdgeRuntime.waitUntil(processEvent(event))
    return sendSuccess({ received: true }, 200)
  } catch (error) {
    console.error('openai-document-webhook signature failed', error)
    return sendError(
      400,
      'Firma de webhook no válida.',
      'INVALID_WEBHOOK_SIGNATURE',
    )
  }
})
