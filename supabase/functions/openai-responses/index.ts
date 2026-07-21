import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

import { canCancelOwnGeneration } from '../_shared/ai-cancellation-auth.ts'
import {
  claimChatGenerationAttempts,
  recoverChatGenerationAttempt,
  requeueChatGenerationAttempt,
} from '../_shared/chat-generation-attempts.ts'
import {
  claimGenerationBatch,
  finalizeGenerationJob,
  identityFromJob,
  inferGenerationIdentity,
  registerGenerationJob,
  requestGenerationCancellation,
} from '../_shared/ai-generation-jobs.ts'
import {
  processGenerationResponse,
  requeueClaimAfterError,
} from '../_shared/ai-response-finalizer.ts'
import {
  collectPaginated,
  mapWithConcurrency,
  recoveryHeadersAuthorized,
} from '../_shared/ai-recovery.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

import type { Database } from '../_shared/database.types.ts'
import type { ResponseMetadata } from '../_shared/utils.ts'
import type {
  AIGenerationJob,
  AIGenerationKind,
} from '../_shared/ai-generation-jobs.ts'

type EntityKind = 'plan' | 'subject' | 'plan-chat' | 'subject-chat'

type ControlPayload = {
  responseId?: unknown
  kind?: unknown
  entityId?: unknown
}

type Runtime = {
  openai: OpenAI
  supabaseAnon: ReturnType<typeof createClient<Database>>
  supabaseService: ReturnType<typeof createClient<Database>>
  userId: string
}

type AccessAssertion = {
  expectedTable: string
  responseId?: string | null
  initiatedBy?: string | null
  canUseAI?: boolean
}

const ACTIVE_STATUSES = new Set(['queued', 'in_progress'])

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new HttpError(
      500,
      'Configuración del servidor incompleta.',
      'MISSING_ENV',
      {
        missing: [name],
      },
    )
  }
  return value
}

function parsePayload(raw: ControlPayload): {
  responseId: string
  kind: EntityKind
  entityId: string
} {
  const responseId = typeof raw.responseId === 'string' ? raw.responseId : ''
  const kind =
    raw.kind === 'plan' ||
    raw.kind === 'subject' ||
    raw.kind === 'plan-chat' ||
    raw.kind === 'subject-chat'
      ? raw.kind
      : null
  const entityId = typeof raw.entityId === 'string' ? raw.entityId : ''

  if (!responseId || !kind || !entityId) {
    throw new HttpError(
      422,
      'responseId, kind y entityId son requeridos.',
      'VALIDATION_ERROR',
      { responseId, kind, entityId },
    )
  }

  return { responseId, kind, entityId }
}

async function buildRuntime(req: Request): Promise<Runtime> {
  const authHeaderRaw =
    req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!authHeaderRaw) {
    throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED', {
      reason: 'missing_authorization_header',
    })
  }

  const SUPABASE_URL = requireEnv('SUPABASE_URL')
  const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY')
  const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY')

  const supabaseAnon = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeaderRaw } },
  })
  const { data: userData, error: userErr } = await supabaseAnon.auth.getUser()
  if (userErr || !userData?.user) {
    throw new HttpError(401, 'Token inválido.', 'UNAUTHORIZED', {
      reason: userErr?.message ?? 'invalid_token',
    })
  }

  return {
    openai: new OpenAI({ apiKey: OPENAI_API_KEY }),
    supabaseAnon,
    supabaseService: createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY),
    userId: userData.user.id,
  }
}

async function assertEntityAccess(
  runtime: Runtime,
  kind: EntityKind,
  entityId: string,
): Promise<AccessAssertion> {
  if (kind === 'plan-chat') {
    return assertPlanChatAccess(runtime, entityId)
  }

  if (kind === 'subject-chat') {
    return assertSubjectChatAccess(runtime, entityId)
  }

  const rpcName =
    kind === 'plan' ? 'authz_can_access_plan' : 'authz_can_access_asignatura'
  const args =
    kind === 'plan' ? { p_plan_id: entityId } : { p_asignatura_id: entityId }

  const { data, error } = await runtime.supabaseAnon.rpc(rpcName, args)
  if (error || data !== true) {
    throw new HttpError(
      403,
      'No tienes acceso a esta generación.',
      'FORBIDDEN',
      {
        kind,
        entityId,
        userId: runtime.userId,
        error,
      },
    )
  }

  if (kind === 'subject') {
    const { data: canUseIa, error: iaError } = await runtime.supabaseAnon.rpc(
      'usuario_puede_usar_ia_asignatura',
      { p_usuario_id: runtime.userId, p_asignatura_id: entityId },
    )
    if (iaError || canUseIa !== true) {
      throw new HttpError(
        403,
        'La IA de esta asignatura no esta disponible en la etapa actual del plan.',
        'PLAN_IA_FROZEN',
        {
          kind,
          entityId,
          userId: runtime.userId,
          error: iaError,
        },
      )
    }
  }

  return {
    expectedTable: kind === 'plan' ? 'planes_estudio' : 'asignaturas',
    canUseAI: kind === 'subject',
  }
}

async function assertPlanChatAccess(
  runtime: Runtime,
  messageId: string,
): Promise<AccessAssertion> {
  const { data: message, error: messageError } = await runtime.supabaseService
    .from('plan_mensajes_ia')
    .select('id,conversacion_plan_id,openai_response_id,enviado_por')
    .eq('id', messageId)
    .maybeSingle()

  if (messageError) {
    throw new HttpError(
      500,
      messageError.message,
      'SUPABASE_QUERY_FAILED',
      messageError,
    )
  }

  if (!message?.conversacion_plan_id) {
    throw new HttpError(404, 'Mensaje no encontrado.', 'NOT_FOUND', {
      messageId,
    })
  }

  const { data: conversation, error: conversationError } =
    await runtime.supabaseService
      .from('conversaciones_plan')
      .select('plan_estudio_id')
      .eq('id', message.conversacion_plan_id)
      .maybeSingle()

  if (conversationError) {
    throw new HttpError(
      500,
      conversationError.message,
      'SUPABASE_QUERY_FAILED',
      conversationError,
    )
  }

  const planId = conversation?.plan_estudio_id
  if (!planId) {
    throw new HttpError(404, 'Conversación no encontrada.', 'NOT_FOUND', {
      messageId,
    })
  }

  const { data, error } = await runtime.supabaseAnon.rpc(
    'authz_can_access_plan',
    { p_plan_id: planId },
  )
  if (error || data !== true) {
    throw new HttpError(
      403,
      'No tienes acceso a esta generación.',
      'FORBIDDEN',
      {
        kind: 'plan-chat',
        entityId: messageId,
        userId: runtime.userId,
        error,
      },
    )
  }

  const { data: canUseIa, error: iaError } = await runtime.supabaseAnon.rpc(
    'usuario_puede_usar_ia_plan',
    { p_usuario_id: runtime.userId, p_plan_id: planId },
  )
  if (iaError || canUseIa !== true) {
    throw new HttpError(
      403,
      'La IA del plan no esta disponible en la etapa actual.',
      'PLAN_IA_FROZEN',
      {
        kind: 'plan-chat',
        entityId: messageId,
        userId: runtime.userId,
        planId,
        error: iaError,
      },
    )
  }

  return {
    expectedTable: 'plan_mensajes_ia',
    responseId: message.openai_response_id,
    initiatedBy: message.enviado_por,
    canUseAI: true,
  }
}

async function assertSubjectChatAccess(
  runtime: Runtime,
  messageId: string,
): Promise<AccessAssertion> {
  const { data: message, error: messageError } = await runtime.supabaseService
    .from('asignatura_mensajes_ia')
    .select('id,conversacion_asignatura_id,openai_response_id,enviado_por')
    .eq('id', messageId)
    .maybeSingle()

  if (messageError) {
    throw new HttpError(
      500,
      messageError.message,
      'SUPABASE_QUERY_FAILED',
      messageError,
    )
  }

  if (!message?.conversacion_asignatura_id) {
    throw new HttpError(404, 'Mensaje no encontrado.', 'NOT_FOUND', {
      messageId,
    })
  }

  const { data: conversation, error: conversationError } =
    await runtime.supabaseService
      .from('conversaciones_asignatura')
      .select('asignatura_id')
      .eq('id', message.conversacion_asignatura_id)
      .maybeSingle()

  if (conversationError) {
    throw new HttpError(
      500,
      conversationError.message,
      'SUPABASE_QUERY_FAILED',
      conversationError,
    )
  }

  const subjectId = conversation?.asignatura_id
  if (!subjectId) {
    throw new HttpError(404, 'Conversación no encontrada.', 'NOT_FOUND', {
      messageId,
    })
  }

  const { data, error } = await runtime.supabaseAnon.rpc(
    'authz_can_access_asignatura',
    { p_asignatura_id: subjectId },
  )
  if (error || data !== true) {
    throw new HttpError(
      403,
      'No tienes acceso a esta generación.',
      'FORBIDDEN',
      {
        kind: 'subject-chat',
        entityId: messageId,
        userId: runtime.userId,
        error,
      },
    )
  }

  const { data: canUseIa, error: iaError } = await runtime.supabaseAnon.rpc(
    'usuario_puede_usar_ia_asignatura',
    { p_usuario_id: runtime.userId, p_asignatura_id: subjectId },
  )
  if (iaError || canUseIa !== true) {
    throw new HttpError(
      403,
      'La IA de esta asignatura no esta disponible en la etapa actual del plan.',
      'PLAN_IA_FROZEN',
      {
        kind: 'subject-chat',
        entityId: messageId,
        userId: runtime.userId,
        subjectId,
        error: iaError,
      },
    )
  }

  return {
    expectedTable: 'asignatura_mensajes_ia',
    responseId: message.openai_response_id,
    initiatedBy: message.enviado_por,
    canUseAI: true,
  }
}

async function assertCancellationAccess(
  runtime: Runtime,
  kind: EntityKind,
  entityId: string,
  responseId: string,
  access: AccessAssertion,
) {
  let initiatedBy = access.initiatedBy
  let canUseAI = access.canUseAI === true

  if (kind === 'plan' || kind === 'subject') {
    const { data: job, error: jobError } = await runtime.supabaseService
      .from('trabajos_generacion_ia')
      .select('metadata')
      .eq('openai_response_id', responseId)
      .maybeSingle()
    if (jobError) {
      throw new HttpError(
        500,
        'No se pudo validar al iniciador de la generación.',
        'SUPABASE_QUERY_FAILED',
        jobError,
      )
    }
    const metadata =
      job?.metadata &&
      typeof job.metadata === 'object' &&
      !Array.isArray(job.metadata)
        ? (job.metadata as Record<string, unknown>)
        : null
    if (typeof metadata?.initiatedBy === 'string') {
      initiatedBy = metadata.initiatedBy
    }
  }

  if (kind === 'plan') {
    const [{ data: plan, error: planError }, { data, error }] =
      await Promise.all([
        runtime.supabaseService
          .from('planes_estudio')
          .select('creado_por')
          .eq('id', entityId)
          .maybeSingle(),
        runtime.supabaseAnon.rpc('usuario_tiene_permiso', {
          p_usuario_id: runtime.userId,
          p_permiso: 'ia.usar',
        }),
      ])
    if (planError || error) {
      throw new HttpError(
        500,
        'No se pudo validar la cancelación del plan.',
        'SUPABASE_QUERY_FAILED',
        { planError, error },
      )
    }
    initiatedBy ??= plan?.creado_por
    canUseAI = data === true
  } else if (kind === 'subject') {
    const [{ data: subject, error: subjectError }, { data, error }] =
      await Promise.all([
        runtime.supabaseService
          .from('asignaturas')
          .select('creado_por')
          .eq('id', entityId)
          .maybeSingle(),
        runtime.supabaseAnon.rpc('usuario_puede_usar_ia_asignatura', {
          p_usuario_id: runtime.userId,
          p_asignatura_id: entityId,
        }),
      ])
    if (subjectError || error) {
      throw new HttpError(
        500,
        'No se pudo validar la cancelación de la asignatura.',
        'SUPABASE_QUERY_FAILED',
        { subjectError, error },
      )
    }
    initiatedBy ??= subject?.creado_por
    canUseAI = data === true
  }

  if (
    !canCancelOwnGeneration({
      userId: runtime.userId,
      initiatedBy,
      canUseAI,
    })
  ) {
    throw new HttpError(
      403,
      'Sólo quien inició la generación y todavía puede usar IA puede cancelarla.',
      'CANCELLATION_FORBIDDEN',
      { kind, entityId },
    )
  }
}

function assertResponseMatchesEntity(
  response: OpenAI.Responses.Response,
  kind: EntityKind,
  entityId: string,
  access: AccessAssertion,
) {
  const metadata = response.metadata as
    | (ResponseMetadata & { mensaje_id?: unknown })
    | null
  const expectedEntityId =
    kind === 'plan-chat' || kind === 'subject-chat'
      ? metadata?.mensaje_id
      : metadata?.id

  if (
    metadata?.tabla !== access.expectedTable ||
    String(expectedEntityId ?? '') !== entityId ||
    (access.responseId && access.responseId !== response.id)
  ) {
    throw new HttpError(
      409,
      'La respuesta de OpenAI no corresponde a esta generación.',
      'RESPONSE_ENTITY_MISMATCH',
      {
        expectedTable: access.expectedTable,
        entityId,
        responseId: response.id,
        storedResponseId: access.responseId,
        metadata,
      },
    )
  }
}

async function handleStatus(req: Request) {
  const runtime = await buildRuntime(req)
  const payload = parsePayload((await req.json()) as ControlPayload)
  const access = await assertEntityAccess(
    runtime,
    payload.kind,
    payload.entityId,
  )

  const response = await runtime.openai.responses.retrieve(payload.responseId)
  assertResponseMatchesEntity(response, payload.kind, payload.entityId, access)
  const processing = await processGenerationResponse({
    supabase: runtime.supabaseService,
    response,
    actor: `frontend:${runtime.userId}`,
  })

  return sendSuccess({
    responseId: response.id,
    status: response.status,
    applied: processing.applied,
    resolution: processing.resolution,
  })
}

async function handleCancel(req: Request) {
  const runtime = await buildRuntime(req)
  const payload = parsePayload((await req.json()) as ControlPayload)
  const access = await assertEntityAccess(
    runtime,
    payload.kind,
    payload.entityId,
  )
  await assertCancellationAccess(
    runtime,
    payload.kind,
    payload.entityId,
    payload.responseId,
    access,
  )

  const current = await runtime.openai.responses.retrieve(payload.responseId)
  assertResponseMatchesEntity(current, payload.kind, payload.entityId, access)
  await processGenerationResponse({
    supabase: runtime.supabaseService,
    response: current,
    actor: `frontend:${runtime.userId}`,
  })
  await requestGenerationCancellation(
    runtime.supabaseService,
    payload.responseId,
  )

  let response = current
  if (ACTIVE_STATUSES.has(String(current.status ?? ''))) {
    const responses = runtime.openai.responses as unknown as {
      cancel: (responseId: string) => Promise<OpenAI.Responses.Response>
    }
    response = await responses.cancel(payload.responseId)
  }

  const status = String(response.status ?? '')

  const processing = await processGenerationResponse({
    supabase: runtime.supabaseService,
    response,
    actor: `frontend:${runtime.userId}:cancel`,
  })
  const deleted =
    status === 'cancelled' &&
    (payload.kind === 'plan' || payload.kind === 'subject') &&
    processing.applied

  return sendSuccess({
    responseId: response.id,
    status: response.status,
    deleted,
    applied: processing.applied,
    resolution: processing.resolution,
  })
}

type DiscoveryCandidate = {
  kind: AIGenerationKind
  entityId: string
  responseId: string
  startedAt: string | null
}

function responseIdFromMeta(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const ai = (value as Record<string, unknown>).ai
  if (!ai || typeof ai !== 'object' || Array.isArray(ai)) return null
  const responseId = (ai as Record<string, unknown>).responseId
  return typeof responseId === 'string' && responseId ? responseId : null
}

async function discoverActiveGenerations(
  supabaseService: ReturnType<typeof createClient<any>>,
): Promise<number> {
  const page = async <T>(
    load: () => PromiseLike<{
      data: T[] | null
      error: { message: string } | null
    }>,
  ): Promise<Array<T>> => {
    const { data, error } = await load()
    if (error) {
      throw new Error(
        `No se pudieron descubrir generaciones activas: ${error.message}`,
      )
    }
    return data ?? []
  }

  const [plans, subjects, planChats, subjectChats, learning, observability] =
    await Promise.all([
      collectPaginated((from, to) =>
        page(() =>
          supabaseService
            .from('planes_estudio')
            .select('id,meta_origen,creado_en,estados_plan!inner(clave)')
            .eq('estados_plan.clave', 'GENERANDO')
            .order('creado_en', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ),
      collectPaginated((from, to) =>
        page(() =>
          supabaseService
            .from('asignaturas')
            .select('id,meta_origen,creado_en')
            .eq('estado', 'generando')
            .order('creado_en', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ),
      collectPaginated((from, to) =>
        page(() =>
          supabaseService
            .from('plan_mensajes_ia')
            .select('id,openai_response_id,fecha_creacion')
            .eq('estado', 'PROCESANDO')
            .order('fecha_creacion', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ),
      collectPaginated((from, to) =>
        page(() =>
          supabaseService
            .from('asignatura_mensajes_ia')
            .select('id,openai_response_id,fecha_creacion')
            .eq('estado', 'PROCESANDO')
            .order('fecha_creacion', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ),
      collectPaginated((from, to) =>
        page(() =>
          supabaseService
            .from('learning_generation_jobs')
            .select('id,openai_response_id,creado_en')
            .in('estado', ['queued', 'running', 'needs_review'])
            .order('creado_en', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ),
      collectPaginated((from, to) =>
        page(() =>
          supabaseService
            .from('observability_test_runs')
            .select('id,openai_response_id,started_at')
            .eq('estado', 'running')
            .order('started_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ),
    ])

  const candidates: Array<DiscoveryCandidate> = []
  const add = (
    kind: AIGenerationKind,
    row: Record<string, unknown>,
    responseId: string | null,
    startedAt: unknown,
  ) => {
    if (!responseId || typeof row.id !== 'string') return
    candidates.push({
      kind,
      entityId: row.id,
      responseId,
      startedAt: typeof startedAt === 'string' ? startedAt : null,
    })
  }

  for (const row of plans as Array<Record<string, unknown>>) {
    add('plan', row, responseIdFromMeta(row.meta_origen), row.creado_en)
  }
  for (const row of subjects as Array<Record<string, unknown>>) {
    add('subject', row, responseIdFromMeta(row.meta_origen), row.creado_en)
  }
  for (const row of planChats as Array<Record<string, unknown>>) {
    add(
      'plan-chat',
      row,
      typeof row.openai_response_id === 'string'
        ? row.openai_response_id
        : null,
      row.fecha_creacion,
    )
  }
  for (const row of subjectChats as Array<Record<string, unknown>>) {
    add(
      'subject-chat',
      row,
      typeof row.openai_response_id === 'string'
        ? row.openai_response_id
        : null,
      row.fecha_creacion,
    )
  }
  for (const row of learning as Array<Record<string, unknown>>) {
    add(
      'learning-resources',
      row,
      typeof row.openai_response_id === 'string'
        ? row.openai_response_id
        : null,
      row.creado_en,
    )
  }
  for (const row of observability as Array<Record<string, unknown>>) {
    add(
      'observability',
      row,
      typeof row.openai_response_id === 'string'
        ? row.openai_response_id
        : null,
      row.started_at,
    )
  }

  const unique = Array.from(
    new Map(
      candidates.map((candidate) => [candidate.responseId, candidate]),
    ).values(),
  )
  const registered = new Set<string>()
  for (let start = 0; start < unique.length; start += 100) {
    const responseIds = unique
      .slice(start, start + 100)
      .map((candidate) => candidate.responseId)
    const { data, error } = await supabaseService
      .from('trabajos_generacion_ia')
      .select('openai_response_id')
      .in('openai_response_id', responseIds)
    if (error) {
      throw new Error(
        `No se pudo verificar la bitácora de generaciones: ${error.message}`,
      )
    }
    for (const row of data ?? []) registered.add(row.openai_response_id)
  }

  const missing = unique.filter(
    (candidate) => !registered.has(candidate.responseId),
  )
  for (const candidate of missing) {
    await registerGenerationJob({
      supabase: supabaseService,
      ...candidate,
      openaiStatus: 'queued',
      metadata: { adoptedBy: 'reconcile-discovery' },
    })
  }
  return missing.length
}

async function runReconcileBatch(args: {
  executionId: string
  supabaseService: ReturnType<typeof createClient<any>>
  openai: OpenAI
}) {
  const counters = {
    descubiertos: 0,
    reclamados: 0,
    completados: 0,
    reprogramados: 0,
    fallidos: 0,
  }

  try {
    await args.supabaseService.rpc('expirar_intentos_chat_ia')
    await args.supabaseService.rpc('expirar_trabajos_generacion_ia')
    const chatAttempts = await claimChatGenerationAttempts({
      supabase: args.supabaseService,
      actor: `cron:${args.executionId}:chat-attempt`,
      limit: 5,
    })
    counters.descubiertos += chatAttempts.length
    counters.reclamados += chatAttempts.length

    await mapWithConcurrency(chatAttempts, 5, async (attempt) => {
      try {
        const result = await recoverChatGenerationAttempt({
          supabase: args.supabaseService,
          openai: args.openai,
          attempt,
        })
        if (
          result.resolution === 'applied' ||
          result.resolution === 'already_applied'
        ) {
          counters.reprogramados += 1
        } else if (result.resolution === 'claimed_elsewhere') {
          counters.reprogramados += 1
        } else {
          counters.fallidos += 1
        }
      } catch (error) {
        const requeued = await requeueChatGenerationAttempt({
          supabase: args.supabaseService,
          attempt,
          error,
        })
        if (requeued) counters.reprogramados += 1
        else counters.fallidos += 1
      }
    })

    counters.descubiertos = await discoverActiveGenerations(
      args.supabaseService,
    ) + counters.descubiertos
    const jobs = await claimGenerationBatch({
      supabase: args.supabaseService,
      actor: `cron:${args.executionId}`,
      limit: 20,
    })
    counters.reclamados += jobs.length

    await mapWithConcurrency(jobs, 5, async (job: AIGenerationJob) => {
      try {
        const response = await args.openai.responses.retrieve(
          job.openai_response_id,
        )
        const identity = inferGenerationIdentity(response.metadata)
        const expected = identityFromJob(job)
        if (
          !identity ||
          identity.kind !== expected.kind ||
          identity.entityId !== expected.entityId
        ) {
          const finalized = await finalizeGenerationJob({
            supabase: args.supabaseService,
            job,
            state: 'fallido',
            openaiStatus: String(response.status ?? 'metadata_mismatch'),
            error: {
              code: 'RESPONSE_ENTITY_MISMATCH',
              message: 'La metadata de OpenAI no corresponde al trabajo.',
            },
          })
          if (finalized) counters.fallidos += 1
          return
        }

        const result = await processGenerationResponse({
          supabase: args.supabaseService,
          response,
          actor: `cron:${args.executionId}`,
          claimedJob: job,
        })
        if (result.resolution === 'active') counters.reprogramados += 1
        else if (result.applied && result.jobState === 'completado') {
          counters.completados += 1
        } else if (result.applied) counters.fallidos += 1
      } catch (error) {
        const requeued = await requeueClaimAfterError({
          supabase: args.supabaseService,
          job,
          error,
        })
        if (requeued) counters.reprogramados += 1
        else counters.fallidos += 1
      }
    })

    await args.supabaseService
      .from('ejecuciones_recuperacion_ia')
      .update({
        ...counters,
        completado_en: new Date().toISOString(),
      })
      .eq('id', args.executionId)
  } catch (error) {
    console.error('Fallo el lote de reconciliación de IA:', error)
    await args.supabaseService
      .from('ejecuciones_recuperacion_ia')
      .update({
        ...counters,
        completado_en: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      })
      .eq('id', args.executionId)
  }
}

async function handleReconcile(req: Request): Promise<Response> {
  const expectedSecret = requireEnv('AI_RECOVERY_CRON_SECRET')
  const expectedPublishableKey = requireEnv('AI_RECOVERY_CRON_PUBLISHABLE_KEY')
  if (
    !(await recoveryHeadersAuthorized(
      req.headers,
      expectedPublishableKey,
      expectedSecret,
    ))
  ) {
    throw new HttpError(401, 'No autorizado.', 'INVALID_RECOVERY_CREDENTIALS')
  }

  const supabaseService = createClient<any>(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )
  const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const { data: execution, error } = await supabaseService
    .from('ejecuciones_recuperacion_ia')
    .insert({ metadata: { source: 'supabase-cron' } })
    .select('id')
    .single()
  if (error || !execution?.id) {
    throw new HttpError(
      500,
      'No se pudo registrar la reconciliación.',
      'SUPABASE_INSERT_FAILED',
      error,
    )
  }

  EdgeRuntime.waitUntil(
    runReconcileBatch({
      executionId: String(execution.id),
      supabaseService,
      openai,
    }),
  )

  return new Response(
    JSON.stringify({
      data: { accepted: true, executionId: String(execution.id) },
    }),
    {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
    }

    const action = new URL(req.url).pathname.split('/').filter(Boolean).pop()
    if (action === 'reconcile') return await handleReconcile(req)
    if (action === 'status') return await handleStatus(req)
    if (action === 'cancel') return await handleCancel(req)

    throw new HttpError(404, 'Acción no encontrada.', 'NOT_FOUND', { action })
  } catch (error) {
    if (error instanceof HttpError) {
      return sendError(error.status, error.message, error.code)
    }

    console.error('openai-responses unexpected error:', error)
    return sendError(
      500,
      error instanceof Error ? error.message : 'Error inesperado.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
