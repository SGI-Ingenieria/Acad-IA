import { supabase } from '../supabase.ts'

import { getEstadoId, marcarFallido } from './index.ts'

import type { Json } from '../../_shared/database.types.ts'
import type { ResponseMetadata } from '../../_shared/utils.ts'
import type { OpenAI } from 'openai'

function extractOutputText(response: OpenAI.Responses.Response): string {
  const direct = (response as unknown as { output_text?: unknown }).output_text
  if (typeof direct === 'string') return direct

  const output = (response as unknown as { output?: unknown }).output
  if (!Array.isArray(output)) return ''

  // Fallback similar al usado en index.ts
  try {
    return output
      .filter((item) => (item as { type: unknown }).type === 'message')
      .flatMap(
        (item) =>
          (item as { content: Array<unknown> | undefined }).content ?? [],
      )
      .filter((c) => (c as { type: unknown }).type === 'output_text')
      .map((c) => String((c as { text: unknown }).text ?? ''))
      .join('')
  } catch {
    return ''
  }
}

export async function handleCrearPlanEstudio(
  response: OpenAI.Responses.Response,
): Promise<void> {
  const metadata = response.metadata as ResponseMetadata | null
  const planId = metadata?.id
  if (!planId) {
    console.warn('No se recibió metadata.id para actualizar el plan')
    return
  }

  try {
    const borradorId = await getEstadoId('BORRADOR')
    if (!borradorId) {
      console.warn('No existe estado BORRADOR')
      await marcarFallido(planId)
      return
    }

    const outputText = extractOutputText(response)
    if (!outputText) {
      console.warn('La respuesta no contiene output_text')
      await marcarFallido(planId)
      return
    }

    let datos: Json
    try {
      datos = JSON.parse(outputText) as Json
    } catch (e) {
      console.warn('No se pudo parsear JSON de la respuesta', e)
      await marcarFallido(planId)
      return
    }

    const { error } = await supabase
      .from('planes_estudio')
      .update({ datos, estado_actual_id: borradorId })
      .eq('id', planId)

    if (error) {
      console.warn('No se pudo actualizar el plan con datos', {
        planId,
        error,
      })
      await marcarFallido(planId)
      return
    }
  } catch (e) {
    console.warn('Fallo inesperado procesando plan', { planId, e })
    await marcarFallido(planId)
    return
  }
}
