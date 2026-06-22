// ./plan_mensajes_ia/index.ts
import type { OpenAI } from 'openai'

import { supabase } from '../../openai-webhook-responses/supabase.ts'
import {
  generateChatTitle,
  shouldReplaceGeneratedChatName,
} from '../lib/chat-title.ts'

function extractOutputText(response: OpenAI.Responses.Response): string {
  const direct = (response as any).output_text
  if (typeof direct === 'string') return direct

  const output = (response as any).output
  if (!Array.isArray(output)) return ''

  try {
    return output
      .filter((item) => item?.type === 'message')
      .flatMap((item) => item?.content ?? [])
      .filter((c) => c?.type === 'output_text')
      .map((c) => String(c?.text ?? ''))
      .join('')
  } catch {
    return ''
  }
}

export async function handleAsignaturaMensajesResponse(
  response: OpenAI.Responses.Response,
): Promise<void> {
  const metadata = response.metadata as any
  const mensajeId = metadata?.mensaje_id

  console.log('Procesando Webhook para Asignatura. Mensaje ID:', mensajeId)

  const isStructured =
    metadata?.is_structured === 'true' || metadata?.is_structured === true

  if (!mensajeId) {
    console.warn(
      'No se recibió mensaje_id en la metadata del webhook de asignatura',
    )
    return
  }

  try {
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

    // Normalización de campos de la IA
    const aiMessage =
      respuestaJSON['ai-message'] || respuestaJSON['ai_message'] || ''
    const is_refusal =
      !!respuestaJSON.is_refusal || respuestaJSON['is-refusal'] === true

    let recommendations: any[] = []

    // Si es estructurado y no es un rechazo de la IA, generamos las recomendaciones
    if (isStructured && !is_refusal) {
      recommendations = Object.entries(respuestaJSON)
        .filter(
          ([k]) =>
            !['ai-message', 'ai_message', 'is-refusal', 'is_refusal'].includes(
              k,
            ),
        )
        .map(([campo, valor]) => ({
          campo_afectado: campo,
          texto_mejora: valor,
          aplicada: false,
        }))
    }

    // --- CAMBIO CLAVE: TABLA 'asignatura_mensajes_ia' ---
    const { error } = await supabase
      .from('asignatura_mensajes_ia')
      .update({
        respuesta: aiMessage,
        // Guardamos la propuesta completa para mantener historial
        propuesta: {
          respuesta: aiMessage,
          recommendations,
        },
        is_refusal,
        estado: 'COMPLETADO',
      })
      .eq('id', mensajeId)

    if (error) throw error

    await maybeUpdateAsignaturaConversationTitle(String(mensajeId), aiMessage)

    console.log(`Mensaje de asignatura ${mensajeId} actualizado con éxito.`)
  } catch (e) {
    console.error('Error en handleAsignaturaMensajesResponse:', {
      mensajeId,
      error: (e as Error).message,
    })

    // Marcamos como error en la tabla correcta para que el front deje de mostrar el spinner
    await supabase
      .from('asignatura_mensajes_ia')
      .update({ estado: 'ERROR' })
      .eq('id', mensajeId)
  }
}

async function maybeUpdateAsignaturaConversationTitle(
  mensajeId: string,
  assistantMessage: string,
) {
  try {
    if (!assistantMessage) return

    const { data: messageRow, error: messageError } = await supabase
      .from('asignatura_mensajes_ia')
      .select('conversacion_asignatura_id,mensaje')
      .eq('id', mensajeId)
      .single()

    if (messageError || !messageRow?.conversacion_asignatura_id) return

    const conversationId = String(messageRow.conversacion_asignatura_id)
    const { data: conversationRow, error: conversationError } = await supabase
      .from('conversaciones_asignatura')
      .select('nombre')
      .eq('id', conversationId)
      .single()

    if (
      conversationError ||
      !shouldReplaceGeneratedChatName(
        conversationRow?.nombre,
        String(messageRow.mensaje ?? ''),
      )
    ) {
      return
    }

    const title = await generateChatTitle({
      userMessage: String(messageRow.mensaje ?? ''),
      assistantMessage,
    })

    if (!title) return

    await supabase
      .from('conversaciones_asignatura')
      .update({ nombre: title })
      .eq('id', conversationId)
  } catch (error) {
    console.warn('No se pudo generar titulo para el chat de asignatura:', error)
  }
}
