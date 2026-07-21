import { parseAsignaturaAIOutputToUpdatePatch } from './asignaturas-ai.ts'
import {
  adoptGenerationResponse,
  claimGenerationJob,
  finalizeGenerationJob,
  finalizeProvisionalCancellation,
  getGenerationJob,
  releaseGenerationJob,
  resolutionForJob,
  retryDelayMs,
} from './ai-generation-jobs.ts'
import { maybeUpdateAsignaturaConversationTitle } from '../create-chat-conversation/asignatura/crear.ts'
import { maybeUpdatePlanConversationTitle } from '../create-chat-conversation/plan/crear.ts'

import type {
  AIGenerationJob,
  AIGenerationResolution,
} from './ai-generation-jobs.ts'
import type OpenAI from 'openai'

type SupabaseClientAny = any

export type ProcessGenerationResult = {
  responseId: string
  status: string
  applied: boolean
  resolution: AIGenerationResolution
  jobState: AIGenerationJob['estado'] | null
}

const ACTIVE_STATUSES = new Set(['queued', 'in_progress'])
const TERMINAL_STATUSES = new Set([
  'completed',
  'failed',
  'cancelled',
  'incomplete',
])

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function isAtomicLearningResourcesCompletion(args: {
  payload: unknown
  localJobId: string
  responseId: string
}): boolean {
  const payload = record(args.payload)
  const localJob = record(payload?.job)
  return (
    payload?.atomicApplied === true &&
    localJob?.id === args.localJobId &&
    localJob?.estado === 'completed' &&
    localJob?.openai_response_id === args.responseId
  )
}

function extractOutputText(response: OpenAI.Responses.Response): string {
  const direct = (response as unknown as { output_text?: unknown }).output_text
  if (typeof direct === 'string') return direct

  const output = (response as unknown as { output?: unknown }).output
  if (!Array.isArray(output)) return ''
  return output
    .filter((item) => record(item)?.type === 'message')
    .flatMap((item) => {
      const content = record(item)?.content
      return Array.isArray(content) ? content : []
    })
    .filter((item) => record(item)?.type === 'output_text')
    .map((item) => String(record(item)?.text ?? ''))
    .join('')
}

function sanitizeJsonControlChars(raw: string): string {
  let inString = false
  let escaped = false
  let result = ''
  for (const character of raw) {
    if (escaped) {
      result += character
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      result += character
      continue
    }
    if (character === '"') {
      inString = !inString
      result += character
      continue
    }
    if (inString && character.charCodeAt(0) < 0x20) {
      if (character === '\n') result += '\\n'
      else if (character === '\r') result += '\\r'
      else if (character === '\t') result += '\\t'
      else {
        result += `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
      }
    } else {
      result += character
    }
  }
  return result
}

function parseJsonOutput(response: OpenAI.Responses.Response): unknown {
  const outputText = extractOutputText(response)
  if (!outputText) throw new Error('La respuesta de OpenAI está vacía.')
  try {
    return JSON.parse(outputText)
  } catch {
    return JSON.parse(sanitizeJsonControlChars(outputText))
  }
}

function normalizePlanResult(
  response: OpenAI.Responses.Response,
): Record<string, unknown> {
  const datos = parseJsonOutput(response)
  if (!record(datos)) {
    throw new Error('La respuesta del plan no es un objeto JSON.')
  }
  return { datos }
}

function normalizeSubjectResult(
  response: OpenAI.Responses.Response,
): Record<string, unknown> {
  const metadata = record(response.metadata)
  const parsed = parseAsignaturaAIOutputToUpdatePatch({
    aiOutput: parseJsonOutput(response),
    clonacionTradicional:
      metadata?.clonacionTradicional === 'true' ||
      metadata?.clonacionTradicional === true,
  })
  if (!parsed.ok)
    throw new Error(`${parsed.error.code}: ${parsed.error.message}`)
  if (parsed.value.gatekeeper?.refusal.trim()) {
    throw new Error(`REFUSAL: ${parsed.value.gatekeeper.refusal}`)
  }
  return { patch: parsed.value.patch }
}

function normalizeChatResult(
  response: OpenAI.Responses.Response,
  subject: boolean,
): Record<string, unknown> {
  const metadata = record(response.metadata)
  const output = record(parseJsonOutput(response))
  if (!output) throw new Error('La respuesta del chat no es un objeto JSON.')

  const isStructured =
    metadata?.is_structured === 'true' || metadata?.is_structured === true
  const isRefusal = output.is_refusal === true || output['is-refusal'] === true
  const responseText = String(output['ai-message'] ?? output.ai_message ?? '')
  const excluded = new Set([
    'ai-message',
    'ai_message',
    'is-refusal',
    'is_refusal',
  ])
  const recommendations =
    isStructured && !isRefusal
      ? Object.entries(output)
          .filter(([key]) => !excluded.has(key))
          .map(([key, value]) => ({
            campo_afectado: key,
            texto_mejora: value,
            aplicada: false,
          }))
      : []

  return {
    respuesta: responseText,
    propuesta: subject
      ? { respuesta: responseText, recommendations }
      : { recommendations },
    is_refusal: isRefusal,
  }
}

async function finalizeLearningResources(
  response: OpenAI.Responses.Response,
  job: AIGenerationJob,
): Promise<void> {
  const metadata = record(response.metadata)
  const jobId = typeof metadata?.id === 'string' ? metadata.id : null
  if (!jobId) throw new Error('Respuesta de recursos sin ID de trabajo.')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuración de Supabase incompleta para recursos.')
  }

  const result = await fetch(
    `${supabaseUrl}/functions/v1/learning-object-generate/finalize`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
        'x-ai-job-id': job.id,
        'x-ai-claim-token': job.token_reclamacion ?? '',
      },
      body: JSON.stringify({ jobId, responseId: response.id }),
    },
  )
  const responseBody = await result.text()
  if (!result.ok) {
    throw new Error(
      `No se pudieron finalizar los recursos (${result.status}): ${responseBody}`,
    )
  }
  let payload: unknown = null
  try {
    payload = JSON.parse(responseBody)
  } catch {
    // La respuesta interna tambien forma parte del contrato de atomicidad.
  }
  if (
    !isAtomicLearningResourcesCompletion({
      payload,
      localJobId: jobId,
      responseId: response.id,
    })
  ) {
    throw new Error(
      'El finalizador de recursos respondió sin confirmar la transición atómica.',
    )
  }
}

function terminalState(status: string) {
  if (status === 'completed') return 'completado' as const
  if (status === 'cancelled') return 'cancelado' as const
  if (status === 'incomplete') return 'incompleto' as const
  return 'fallido' as const
}

function openAIError(
  response: OpenAI.Responses.Response,
): Record<string, unknown> {
  const raw = response as unknown as Record<string, unknown>
  return {
    code: `OPENAI_${String(response.status ?? 'FAILED').toUpperCase()}`,
    message: `OpenAI terminó la respuesta con estado ${String(response.status ?? 'desconocido')}.`,
    error: raw.error ?? null,
    incomplete_details: raw.incomplete_details ?? null,
  }
}

async function postWinSideEffects(
  job: AIGenerationJob,
  result: Record<string, unknown> | null,
) {
  const assistantMessage = String(result?.respuesta ?? '')
  if (!assistantMessage) return
  if (job.tipo_entidad === 'chat_plan') {
    await maybeUpdatePlanConversationTitle(job.entidad_id, assistantMessage)
  } else if (job.tipo_entidad === 'chat_asignatura') {
    await maybeUpdateAsignaturaConversationTitle(
      job.entidad_id,
      assistantMessage,
    )
  }
}

async function applyClaimedResponse(args: {
  supabase: SupabaseClientAny
  response: OpenAI.Responses.Response
  job: AIGenerationJob
}): Promise<ProcessGenerationResult> {
  const status = String(args.response.status ?? '')
  const { job, supabase, response } = args

  if (ACTIVE_STATUSES.has(status)) {
    const released = await releaseGenerationJob({
      supabase,
      job,
      openaiStatus: status,
      nextReviewAt: new Date(Date.now() + 30_000).toISOString(),
    })
    return {
      responseId: response.id,
      status,
      applied: false,
      resolution: released ? 'active' : 'claimed_elsewhere',
      jobState: released ? 'pendiente' : 'reclamado',
    }
  }

  if (!TERMINAL_STATUSES.has(status)) {
    const released = await releaseGenerationJob({
      supabase,
      job,
      openaiStatus: status || null,
      nextReviewAt: new Date(
        Date.now() + retryDelayMs(job.intentos),
      ).toISOString(),
      error: {
        code: 'UNKNOWN_OPENAI_STATUS',
        message: `Estado no reconocido: ${status || '(vacío)'}`,
      },
    })
    return {
      responseId: response.id,
      status,
      applied: false,
      resolution: released ? 'active' : 'claimed_elsewhere',
      jobState: released ? 'pendiente' : 'reclamado',
    }
  }

  if (
    status === 'cancelled' &&
    job.cancelacion_solicitada_en &&
    (job.tipo_entidad === 'plan' || job.tipo_entidad === 'asignatura')
  ) {
    const deleted = await finalizeProvisionalCancellation({ supabase, job })
    if (deleted) {
      return {
        responseId: response.id,
        status,
        applied: true,
        resolution: 'applied',
        jobState: 'cancelado',
      }
    }
  }

  let result: Record<string, unknown> | null = null
  let requestedState = terminalState(status)
  let error = status === 'completed' ? null : openAIError(response)

  if (status === 'completed') {
    try {
      if (job.tipo_entidad === 'plan') result = normalizePlanResult(response)
      else if (job.tipo_entidad === 'asignatura') {
        result = normalizeSubjectResult(response)
      } else if (job.tipo_entidad === 'chat_plan') {
        result = normalizeChatResult(response, false)
      } else if (job.tipo_entidad === 'chat_asignatura') {
        result = normalizeChatResult(response, true)
      } else if (job.tipo_entidad === 'observabilidad') {
        result = {
          openai_status: status,
          output_text: extractOutputText(response),
        }
      } else if (job.tipo_entidad === 'recursos_aprendizaje') {
        await finalizeLearningResources(response, job)
        return {
          responseId: response.id,
          status,
          applied: true,
          resolution: 'applied',
          jobState: 'completado',
        }
      }
    } catch (cause) {
      requestedState = 'fallido'
      error = {
        code:
          job.tipo_entidad === 'recursos_aprendizaje'
            ? 'LEARNING_RESOURCES_FINALIZE_FAILED'
            : 'AI_OUTPUT_INVALID',
        message:
          cause instanceof Error
            ? cause.message
            : 'La salida de OpenAI no cumple el contrato esperado.',
      }
      result = null
    }
  }

  const finalized = await finalizeGenerationJob({
    supabase,
    job,
    state: requestedState,
    openaiStatus: status,
    result,
    error,
  })
  if (!finalized) {
    return {
      responseId: response.id,
      status,
      applied: false,
      resolution: 'claimed_elsewhere',
      jobState: null,
    }
  }
  if (finalized.estado === 'obsoleto') {
    return {
      responseId: response.id,
      status,
      applied: false,
      resolution: 'stale',
      jobState: finalized.estado,
    }
  }

  if (finalized.estado === 'completado') {
    await postWinSideEffects(finalized, result)
  }

  return {
    responseId: response.id,
    status,
    applied: true,
    resolution: 'applied',
    jobState: finalized.estado,
  }
}

export async function processGenerationResponse(args: {
  supabase: SupabaseClientAny
  response: OpenAI.Responses.Response
  actor: string
  claimedJob?: AIGenerationJob | null
}): Promise<ProcessGenerationResult> {
  const status = String(args.response.status ?? '')
  const adopted = await adoptGenerationResponse({
    supabase: args.supabase,
    response: args.response,
  })
  if (!adopted) {
    return {
      responseId: args.response.id,
      status,
      applied: false,
      resolution: 'stale',
      jobState: null,
    }
  }

  const claim =
    args.claimedJob ??
    (await claimGenerationJob({
      supabase: args.supabase,
      responseId: args.response.id,
      actor: args.actor,
    }))

  if (!claim) {
    const current = await getGenerationJob(args.supabase, args.response.id)
    const resolution = resolutionForJob(current)
    return {
      responseId: args.response.id,
      status,
      applied: false,
      resolution:
        resolution === 'already_applied' ? 'already_applied' : resolution,
      jobState: current?.estado ?? null,
    }
  }

  return await applyClaimedResponse({
    supabase: args.supabase,
    response: args.response,
    job: claim,
  })
}

export async function requeueClaimAfterError(args: {
  supabase: SupabaseClientAny
  job: AIGenerationJob
  error: unknown
}): Promise<boolean> {
  return await releaseGenerationJob({
    supabase: args.supabase,
    job: args.job,
    openaiStatus: args.job.estado_openai,
    nextReviewAt: new Date(
      Date.now() + retryDelayMs(args.job.intentos),
    ).toISOString(),
    error: {
      code: 'TRANSIENT_PROCESSING_ERROR',
      message:
        args.error instanceof Error ? args.error.message : String(args.error),
    },
  })
}
