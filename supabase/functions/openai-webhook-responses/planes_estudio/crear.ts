import { supabase } from '../supabase.ts'

import { getEstadoId, marcarFallido } from './index.ts'

import type { Json } from '../../_shared/database.types.ts'
import type { ResponseMetadata } from '../../_shared/utils.ts'
import type { OpenAI } from 'openai'

// Escapa caracteres de control literales que estén dentro de strings JSON.
// JSON.parse acepta whitespace entre tokens pero falla si hay 0x00-0x1F
// literales dentro de un valor de string.
function sanitizeJsonControlChars(raw: string): string {
  let inString = false
  let escaped = false
  let result = ''
  for (const char of raw) {
    if (escaped) {
      result += char
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      result += char
      continue
    }
    if (char === '"') {
      inString = !inString
      result += char
      continue
    }
    if (inString && char.charCodeAt(0) < 0x20) {
      switch (char) {
        case '\n':
          result += '\\n'
          break
        case '\r':
          result += '\\r'
          break
        case '\t':
          result += '\\t'
          break
        default:
          result += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
      }
    } else {
      result += char
    }
  }
  return result
}

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
    } catch {
      // Retry after escaping literal control characters inside JSON strings
      try {
        datos = JSON.parse(sanitizeJsonControlChars(outputText)) as Json
      } catch (e2) {
        console.warn('No se pudo parsear JSON de la respuesta', e2)
        await marcarFallido(planId)
        return
      }
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
