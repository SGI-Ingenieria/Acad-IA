// ./plan_mensajes_ia/index.ts
import type { OpenAI } from 'openai'

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

async function assertAsignaturaMessageStillAllowsIA(mensajeId: string) {
  const { data: messageRow, error: messageError } = await supabase
    .from('asignatura_mensajes_ia')
    .select('conversacion_asignatura_id')
    .eq('id', mensajeId)
    .single()

  if (messageError || !messageRow?.conversacion_asignatura_id) {
    throw messageError ?? new Error('Mensaje de asignatura no encontrado')
  }

  const { data: conversationRow, error: conversationError } = await supabase
    .from('conversaciones_asignatura')
    .select('asignatura_id')
    .eq('id', messageRow.conversacion_asignatura_id)
    .single()

  if (conversationError || !conversationRow?.asignatura_id) {
    throw (
      conversationError ?? new Error('Conversacion de asignatura no encontrada')
    )
  }

  const { data: subjectRow, error: subjectError } = await supabase
    .from('asignaturas')
    .select('planes_estudio(estados_plan(clave))')
    .eq('id', conversationRow.asignatura_id)
    .single()

  if (subjectError) throw subjectError

  const plan = (subjectRow as any)?.planes_estudio
  const clave = String(plan?.estados_plan?.clave ?? '')
  if (IA_DISABLED_PLAN_STATES.has(clave)) {
    throw new Error(
      'La IA de esta asignatura no esta disponible en la etapa actual.',
    )
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
    await assertAsignaturaMessageStillAllowsIA(String(mensajeId))
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
      .update({
        estado: 'ERROR',
        respuesta: 'No se pudo procesar la respuesta de la IA.',
        propuesta: { recommendations: [] },
        is_refusal: false,
      })
      .eq('id', mensajeId)
  }
}

export async function handleAsignaturaMensajesUnsuccessfulResponse(
  response: OpenAI.Responses.Response,
): Promise<void> {
  const metadata = response.metadata as any
  const mensajeId = metadata?.mensaje_id
  if (!mensajeId) {
    console.warn('No se recibió mensaje_id en respuesta fallida de asignatura')
    return
  }

  const isCancelled = String(response.status ?? '') === 'cancelled'

  const { error } = await supabase
    .from('asignatura_mensajes_ia')
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

export async function maybeUpdateAsignaturaConversationTitle(
  mensajeId: string,
  assistantMessage: string,
) {
  try {
    if (!assistantMessage) return

    const { data: messageRow, error: messageError } = await supabase
      .from('asignatura_mensajes_ia')
      .select('id,conversacion_asignatura_id')
      .eq('id', mensajeId)
      .single()

    if (messageError || !messageRow?.conversacion_asignatura_id) return

    const conversationId = String(messageRow.conversacion_asignatura_id)
    const { data: firstMessage, error: firstMessageError } = await supabase
      .from('asignatura_mensajes_ia')
      .select('id,mensaje')
      .eq('conversacion_asignatura_id', conversationId)
      .order('fecha_creacion', { ascending: true })
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (
      firstMessageError ||
      !firstMessage ||
      String(firstMessage.id) !== String(messageRow.id)
    ) {
      return
    }

    const userMessage = String(firstMessage.mensaje ?? '')
    const { data: conversationRow, error: conversationError } = await supabase
      .from('conversaciones_asignatura')
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
      .from('conversaciones_asignatura')
      .update({ nombre: title })
      .eq('id', conversationId)
    const { error: updateError } =
      observedName === null
        ? await updateQuery.is('nombre', null)
        : await updateQuery.eq('nombre', observedName)

    if (updateError) throw updateError
  } catch (error) {
    console.warn('No se pudo generar título para el chat de asignatura:', error)
  }
}
