import { parseAsignaturaAIOutputToUpdatePatch } from '../../_shared/asignaturas-ai.ts'
import { supabase } from '../supabase.ts'

import type { Database, Json } from '../../_shared/database.types.ts'
import type { ResponseMetadata } from '../../_shared/utils.ts'
import type { OpenAI } from 'openai'

type AsignaturaUpdate = Database['public']['Tables']['asignaturas']['Update']

function extractOutputText(response: OpenAI.Responses.Response): string {
  const direct = (response as unknown as { output_text?: unknown }).output_text
  if (typeof direct === 'string') return direct

  const output = (response as unknown as { output?: unknown }).output
  if (!Array.isArray(output)) return ''

  try {
    return output
      .filter((item) => (item as { type?: unknown }).type === 'message')
      .flatMap((item) => (item as { content?: unknown }).content ?? [])
      .filter((c) => (c as { type?: unknown }).type === 'output_text')
      .map((c) => String((c as { text?: unknown }).text ?? ''))
      .join('')
  } catch {
    return ''
  }
}

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

async function assertAsignaturaStillAllowsIA(asignaturaId: string) {
  const { data, error } = await supabase
    .from('asignaturas')
    .select('planes_estudio(estados_plan(clave))')
    .eq('id', asignaturaId)
    .maybeSingle()

  if (error) throw error

  const plan = (data as any)?.planes_estudio
  const clave = String(plan?.estados_plan?.clave ?? '')
  if (IA_DISABLED_PLAN_STATES.has(clave)) {
    throw new Error(
      'La IA de esta asignatura no esta disponible en la etapa actual.',
    )
  }
}

async function marcarFalloAsignatura(
  asignaturaId: string,
  reason: string,
  extra?: unknown,
): Promise<void> {
  try {
    const { data: existing, error: existingError } = await supabase
      .from('asignaturas')
      .select('meta_origen')
      .eq('id', asignaturaId)
      .maybeSingle()
    if (existingError) {
      console.warn('No se pudo leer meta_origen para marcar fallo', {
        asignaturaId,
        existingError,
      })
    }

    const baseMeta =
      existing?.meta_origen &&
      typeof existing.meta_origen === 'object' &&
      !Array.isArray(existing.meta_origen)
        ? (existing.meta_origen as Record<string, unknown>)
        : {}

    const nextMeta: Record<string, unknown> = {
      ...baseMeta,
      error: {
        code: reason,
        message: 'La generación de la asignatura falló.',
        extra: extra ?? null,
        at: new Date().toISOString(),
      },
    }

    const { error } = await supabase
      .from('asignaturas')
      .update({ estado: 'fallida', meta_origen: nextMeta as unknown as Json })
      .eq('id', asignaturaId)
    if (error) {
      console.warn('No se pudo marcar fallo en asignatura', {
        asignaturaId,
        error,
      })
    }
  } catch (e) {
    console.warn('Fallo inesperado marcando fallo en asignatura', {
      asignaturaId,
      e,
    })
  }
}

export async function handleCrearAsignaturaResponse(
  response: OpenAI.Responses.Response,
): Promise<void> {
  const metadata = response.metadata as ResponseMetadata | null
  const asignaturaId = metadata?.id
  const clonacionTradicional = metadata?.clonacionTradicional === 'true'
  if (!asignaturaId) {
    console.warn('No se recibió metadata.id para actualizar la asignatura')
    return
  }

  try {
    await assertAsignaturaStillAllowsIA(String(asignaturaId))
    const outputText = extractOutputText(response)
    if (!outputText) {
      console.warn('La respuesta no contiene output_text')
      await marcarFalloAsignatura(asignaturaId, 'MISSING_OUTPUT_TEXT', {
        responseId: response.id,
      })
      return
    }

    let aiOutput: unknown
    try {
      aiOutput = JSON.parse(outputText)
    } catch (e) {
      console.warn('No se pudo parsear JSON de la respuesta', e)
      await marcarFalloAsignatura(asignaturaId, 'INVALID_JSON', {
        responseId: response.id,
        outputText,
      })
      return
    }

    const parsed = parseAsignaturaAIOutputToUpdatePatch({
      aiOutput,
      clonacionTradicional,
    })

    if (!parsed.ok) {
      console.warn('El output de IA no cumple el shape esperado', parsed.error)
      await marcarFalloAsignatura(asignaturaId, parsed.error.code, {
        ...parsed.error,
        responseId: response.id,
      })
      return
    }

    if (
      clonacionTradicional &&
      parsed.value.gatekeeper &&
      parsed.value.gatekeeper.refusal.trim().length > 0
    ) {
      await marcarFalloAsignatura(asignaturaId, 'REFUSAL', {
        ...parsed.value.gatekeeper,
        responseId: response.id,
      })
      return
    }

    const { data: existing, error: existingError } = await supabase
      .from('asignaturas')
      .select('meta_origen')
      .eq('id', asignaturaId)
      .maybeSingle()

    if (existingError) {
      console.warn('No se pudo leer meta_origen existente', {
        asignaturaId,
        existingError,
      })
    }

    const baseMeta =
      existing?.meta_origen &&
      typeof existing.meta_origen === 'object' &&
      !Array.isArray(existing.meta_origen)
        ? (existing.meta_origen as Record<string, unknown>)
        : {}

    const nextMeta: Record<string, unknown> = {
      ...baseMeta,
      ai: {
        ...(typeof baseMeta.ai === 'object' &&
        baseMeta.ai &&
        !Array.isArray(baseMeta.ai)
          ? (baseMeta.ai as Record<string, unknown>)
          : {}),
        responseId: response.id,
        model: response.model,
      },
    }

    const updatePatch: AsignaturaUpdate = {
      ...parsed.value.patch,
      estado: 'borrador',
      meta_origen: nextMeta as unknown as Json,
    }

    const { error: updateError } = await supabase
      .from('asignaturas')
      .update(updatePatch)
      .eq('id', asignaturaId)

    if (updateError) {
      console.warn('No se pudo actualizar asignatura con datos', {
        asignaturaId,
        updateError,
      })
      await marcarFalloAsignatura(asignaturaId, 'SUPABASE_UPDATE_FAILED', {
        updateError,
      })
      return
    }
  } catch (e) {
    console.warn('Fallo inesperado procesando asignatura', {
      asignaturaId,
      e,
    })
    await marcarFalloAsignatura(asignaturaId, 'UNEXPECTED', { e })
    return
  }
}
