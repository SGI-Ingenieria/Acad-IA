// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import '@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'openai'

import { handleAsignaturaMensajesResponse } from '../create-chat-conversation/asignatura/crear.ts'
import { handlePlanMensajesResponse } from '../create-chat-conversation/plan/crear.ts'

import { handleAsignaturasResponse } from './asignaturas/index.ts'
import {
  handlePlanesEstudioResponse,
  handlePlanesEstudioUnsuccesfulResponse,
} from './planes_estudio/index.ts'

import type { ResponseMetadata } from '../_shared/utils.ts'

console.log('Starting OpenAI webhook responses function')
const client = new OpenAI({
  webhookSecret: Deno.env.get('OPENAI_WEBHOOK_SECRET'),
})

async function handleCompletedResponse(
  event: OpenAI.Webhooks.ResponseCompletedWebhookEvent,
) {
  const response_id = event.data.id
  const response = await client.responses.retrieve(response_id)
  const metadata = response.metadata as ResponseMetadata | null
  console.log('entre')

  if (!metadata || !metadata.tabla) {
    console.warn('No se recibió metadata o tabla en la respuesta')
    return
  }

  switch (metadata.tabla) {
    case 'planes_estudio':
      await handlePlanesEstudioResponse(response)
      break
    case 'asignaturas':
      await handleAsignaturasResponse(response)
      break
    case 'plan_mensajes_ia':
      await handlePlanMensajesResponse(response)
      break
    case 'asignatura_mensajes_ia':
      console.log('modificando asignatura')

      await handleAsignaturaMensajesResponse(response)
      break
    default:
      console.warn('Tabla no reconocida:', metadata.tabla)
  }

  const direct = (response as unknown as { output_text?: unknown }).output_text
  if (typeof direct === 'string' && direct.length) {
    console.log('Response output:', direct)
    return
  }

  const output = (response as unknown as { output?: unknown }).output
  if (!Array.isArray(output)) {
    console.log('Response output: (no output)')
    return
  }

  const outputText = output
    .filter((item) => (item as { type?: unknown })?.type === 'message')
    .flatMap((item) => (item as { content?: unknown })?.content ?? [])
    .filter((c) => (c as { type?: unknown })?.type === 'output_text')
    .map((c) => String((c as { text?: unknown })?.text ?? ''))
    .join('')

  console.log('Response output:', outputText)
}

async function handleUnsuccesfulResponse(
  event:
    | OpenAI.Webhooks.ResponseCancelledWebhookEvent
    | OpenAI.Webhooks.ResponseFailedWebhookEvent
    | OpenAI.Webhooks.ResponseIncompleteWebhookEvent,
): Promise<void> {
  try {
    const response_id = event.data.id
    const response = await client.responses.retrieve(response_id)
    const metadata = response.metadata as ResponseMetadata | null

    if (!metadata || !metadata.tabla) {
      console.warn(
        'No se recibió metadata o tabla en la respuesta UNSUCCESSFUL',
      )
      return
    }

    switch (metadata.tabla) {
      case 'planes_estudio':
        await handlePlanesEstudioUnsuccesfulResponse(response)
        break
      default:
        console.warn('Tabla no reconocida en UNSUCCESSFUL:', metadata.tabla)
    }
  } catch (e) {
    console.error('Error procesando respuesta UNSUCCESSFUL:', e)
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const functionName = url.pathname.split('/').pop()
  console.log(
    `[${new Date().toISOString()}][${functionName}]: Request received`,
  )

  // Opcional: Solo permitir POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    // OpenAI requiere el body como texto crudo (string) para verificar la firma criptográfica
    const payload = await req.text()

    // Validar firma y parsear el evento. Deno maneja req.headers compatiblemente
    const event = await client.webhooks.unwrap(payload, req.headers)

    switch (event.type) {
      case 'response.completed': {
        EdgeRuntime.waitUntil(handleCompletedResponse(event))
        break
      }
      case 'response.cancelled': {
        EdgeRuntime.waitUntil(handleUnsuccesfulResponse(event))
        break
      }
      case 'response.failed': {
        EdgeRuntime.waitUntil(handleUnsuccesfulResponse(event))
        break
      }
      case 'response.incomplete': {
        EdgeRuntime.waitUntil(handleUnsuccesfulResponse(event))
        break
      }
      default: {
        throw new Error(`Unhandled event type: ${event.type}`)
      }
    }

    console.log(
      `[${new Date().toISOString()}][${functionName}]: Request processed successfully`,
    )
    return new Response('OK', { status: 200 })
  } catch (error) {
    if (error instanceof OpenAI.InvalidWebhookSignatureError) {
      console.error('Invalid signature:', error.message)
      return new Response('Invalid signature', { status: 400 })
    } else {
      console.error('Internal Error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }
})
