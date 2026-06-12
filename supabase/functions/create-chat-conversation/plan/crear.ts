// ./plan_mensajes_ia/index.ts
import type { OpenAI } from 'openai'

import type { Json } from '../../_shared/database.types.ts'
import { ResponseMetadata } from '../../_shared/utils.ts'
import { supabase } from '../../openai-webhook-responses/supabase.ts'

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
    const outputText = extractOutputText(response)
    if (!outputText) {
      throw new Error('La respuesta de OpenAI está vacía')
    }

    let respuestaJSON: any
    try {
      respuestaJSON = JSON.parse(outputText)
    } catch (e) {
      throw new Error(`Error parseando JSON de OpenAI: ${e.message}`)
    }

    const is_refusal =
      !!respuestaJSON.is_refusal || respuestaJSON['is-refusal'] === true

    let recommendations = []
    if (isStructured && !is_refusal) {
      recommendations = Object.entries(respuestaJSON)
        .filter(
          ([k]) =>
            k !== 'ai-message' && k !== 'is-refusal' && k !== 'is_refusal',
        )
        .map(([campo, valor]) => ({
          campo_afectado: campo,
          texto_mejora: valor,
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
  } catch (e) {
    console.error('Error procesando handlePlanMensajesResponse:', {
      mensajeId,
      e,
    })
    // Opcional: Marcar el mensaje como fallido en la tabla si tienes ese estado
    await supabase
      .from('plan_mensajes_ia')
      .update({ estado: 'ERROR' })
      .eq('id', mensajeId)
  }
}
