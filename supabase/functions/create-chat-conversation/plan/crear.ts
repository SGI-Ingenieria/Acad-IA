// ./plan_mensajes_ia/index.ts
import type { OpenAI } from 'openai'

import type { Json } from '../../_shared/database.types.ts'

import { supabase } from '../../openai-webhook-responses/supabase.ts'
import {
  generateChatTitle,
  shouldReplaceGeneratedChatName,
} from '../lib/chat-title.ts'

const IA_DISABLED_PLAN_STATES = new Set([
  'REV_PLANEACION',
  'CONSULTA_EXPERTOS',
  'REV_SEDES',
  'CONSEJO_FACULTAD',
  'CONSEJO_UNIVERSITARIO',
  'JUNTA_GOBIERNO',
  'ENVIADO_SEP',
  'APROBADO',
  'RECHAZADO',
])

function extractOutputText(response: OpenAI.Responses.Response): string {
  const direct = (response as unknown as { output_text?: unknown }).output_text
  if (typeof direct === 'string') return direct

  const output = (response as unknown as { output?: unknown }).output
  if (!Array.isArray(output)) return ''

  // Fallback similar al usado en index.ts
  try {
    return output
      .filter((item) => (item as { type?: unknown })?.type === 'message')
      .flatMap((item) => (item as { content?: unknown })?.content ?? [])
      .filter((c) => (c as { type?: unknown })?.type === 'output_text')
      .map((c) => String((c as { text?: unknown })?.text ?? ''))
      .join('')
  } catch {
    return ''
  }
}

async function assertPlanMessageStillAllowsIA(mensajeId: string) {
  const { data: messageRow, error: messageError } = await supabase
    .from('plan_mensajes_ia')
    .select('conversacion_plan_id')
    .eq('id', mensajeId)
    .single()

  if (messageError || !messageRow?.conversacion_plan_id) {
    throw messageError ?? new Error('Mensaje de plan no encontrado')
  }

  const { data: conversationRow, error: conversationError } = await supabase
    .from('conversaciones_plan')
    .select('plan_estudio_id')
    .eq('id', messageRow.conversacion_plan_id)
    .single()

  if (conversationError || !conversationRow?.plan_estudio_id) {
    throw conversationError ?? new Error('Conversacion de plan no encontrada')
  }

  const { data: planRow, error: planError } = await supabase
    .from('planes_estudio')
    .select('estados_plan(clave)')
    .eq('id', conversationRow.plan_estudio_id)
    .single()

  if (planError) throw planError

  const clave = String((planRow as any)?.estados_plan?.clave ?? '')
  if (IA_DISABLED_PLAN_STATES.has(clave)) {
    throw new Error('La IA del plan no esta disponible en la etapa actual.')
  }
}

export async function handlePlanMensajesResponse(
  response: OpenAI.Responses.Response,
): Promise<void> {
  const metadata = response.metadata as any
  const mensajeId = metadata?.mensaje_id
  console.log('ya entre aqui')

  const isStructured =
    metadata?.is_structured === 'true' || metadata?.is_structured === true
  if (!mensajeId) {
    console.warn('No se recibió mensaje_id en la metadata del webhook')
    return
  }

  try {
    await assertPlanMessageStillAllowsIA(String(mensajeId))
    const outputText = extractOutputText(response)
    if (!outputText) {
      throw new Error('La respuesta de OpenAI está vacía')
    }

    let respuestaJSON: any
    try {
      respuestaJSON = JSON.parse(outputText)
    } catch (e) {
      throw new Error(`Error parseando JSON de OpenAI: ${(e as Error).message}`)
    }

    const is_refusal =
      !!respuestaJSON.is_refusal || respuestaJSON['is-refusal'] === true

    let recommendations: Array<{
      campo_afectado: string
      texto_mejora: Json
      aplicada: boolean
    }> = []
    if (isStructured && !is_refusal) {
      recommendations = Object.entries(respuestaJSON)
        .filter(
          ([k]) =>
            k !== 'ai-message' && k !== 'is-refusal' && k !== 'is_refusal',
        )
        .map(([campo, valor]) => ({
          campo_afectado: campo,
          texto_mejora: valor as Json,
          aplicada: false,
        }))
    }

    const { error } = await supabase
      .from('plan_mensajes_ia')
      .update({
        respuesta: respuestaJSON['ai-message'] || '',
        propuesta: { recommendations },
        is_refusal,
        estado: 'COMPLETADO',
      })
      .eq('id', mensajeId)

    if (error) {
      throw error
    }

    await maybeUpdatePlanConversationTitle(
      String(mensajeId),
      respuestaJSON['ai-message'] || '',
    )
  } catch (e) {
    console.error('Error procesando handlePlanMensajesResponse:', {
      mensajeId,
      e,
    })
    // Opcional: Marcar el mensaje como fallido en la tabla si tienes ese estado
    await supabase
      .from('plan_mensajes_ia')
      .update({
        estado: 'ERROR',
        respuesta: 'No se pudo procesar la respuesta de la IA.',
        propuesta: { recommendations: [] },
        is_refusal: false,
      })
      .eq('id', mensajeId)
  }
}

export async function handlePlanMensajesUnsuccessfulResponse(
  response: OpenAI.Responses.Response,
): Promise<void> {
  const metadata = response.metadata as any
  const mensajeId = metadata?.mensaje_id
  if (!mensajeId) {
    console.warn('No se recibió mensaje_id en respuesta fallida de plan')
    return
  }

  const isCancelled = String(response.status ?? '') === 'cancelled'

  const { error } = await supabase
    .from('plan_mensajes_ia')
    .update({
      estado: isCancelled ? 'CANCELADO' : 'ERROR',
      respuesta: isCancelled
        ? 'Esta respuesta se ha cancelado.'
        : 'No se pudo generar la respuesta de la IA.',
      propuesta: { recommendations: [] },
      is_refusal: false,
    })
    .eq('id', mensajeId)

  if (error) throw error
}

export async function maybeUpdatePlanConversationTitle(
  mensajeId: string,
  assistantMessage: string,
) {
  try {
    if (!assistantMessage) return

    const { data: messageRow, error: messageError } = await supabase
      .from('plan_mensajes_ia')
      .select('id,conversacion_plan_id')
      .eq('id', mensajeId)
      .single()

    if (messageError || !messageRow?.conversacion_plan_id) return

    const conversationId = String(messageRow.conversacion_plan_id)
    const { data: firstMessage, error: firstMessageError } = await supabase
      .from('plan_mensajes_ia')
      .select('id,mensaje')
      .eq('conversacion_plan_id', conversationId)
      .order('fecha_creacion', { ascending: true })
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()

    // Sólo el primer turno puede nombrar la conversación. Esto mantiene el
    // resultado estable aunque varias respuestas terminen fuera de orden.
    if (
      firstMessageError ||
      !firstMessage ||
      String(firstMessage.id) !== String(messageRow.id)
    ) {
      return
    }

    const userMessage = String(firstMessage.mensaje ?? '')
    const { data: conversationRow, error: conversationError } = await supabase
      .from('conversaciones_plan')
      .select('nombre')
      .eq('id', conversationId)
      .single()

    if (
      conversationError ||
      !shouldReplaceGeneratedChatName(conversationRow?.nombre, userMessage)
    ) {
      return
    }

    const title = await generateChatTitle({
      userMessage,
      assistantMessage,
    })

    if (!title) return

    const observedName = conversationRow?.nombre ?? null
    const updateQuery = supabase
      .from('conversaciones_plan')
      .update({ nombre: title })
      .eq('id', conversationId)
    const { error: updateError } =
      observedName === null
        ? await updateQuery.is('nombre', null)
        : await updateQuery.eq('nombre', observedName)

    if (updateError) throw updateError
  } catch (error) {
    console.warn('No se pudo generar título para el chat de plan:', error)
  }
}
