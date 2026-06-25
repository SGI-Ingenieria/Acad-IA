import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

import { corsHeaders } from '../_shared/cors.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'
import {
  handleAsignaturasResponse,
  handleAsignaturasUnsuccesfulResponse,
} from '../openai-webhook-responses/asignaturas/index.ts'
import {
  handleAsignaturaMensajesResponse,
  handleAsignaturaMensajesUnsuccessfulResponse,
} from '../create-chat-conversation/asignatura/crear.ts'
import {
  handlePlanMensajesResponse,
  handlePlanMensajesUnsuccessfulResponse,
} from '../create-chat-conversation/plan/crear.ts'
import {
  handlePlanesEstudioResponse,
  handlePlanesEstudioUnsuccesfulResponse,
} from '../openai-webhook-responses/planes_estudio/index.ts'

import type { Database } from '../_shared/database.types.ts'
import type { ResponseMetadata } from '../_shared/utils.ts'

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
}

const TERMINAL_STATUSES = new Set([
  'completed',
  'failed',
  'cancelled',
  'incomplete',
])
const ACTIVE_STATUSES = new Set(['queued', 'in_progress'])

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
  }
}

async function assertPlanChatAccess(
  runtime: Runtime,
  messageId: string,
): Promise<AccessAssertion> {
  const { data: message, error: messageError } = await runtime.supabaseService
    .from('plan_mensajes_ia')
    .select('id,conversacion_plan_id,openai_response_id')
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
  }
}

async function assertSubjectChatAccess(
  runtime: Runtime,
  messageId: string,
): Promise<AccessAssertion> {
  const { data: message, error: messageError } = await runtime.supabaseService
    .from('asignatura_mensajes_ia')
    .select('id,conversacion_asignatura_id,openai_response_id')
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

async function applyTerminalResponse(response: OpenAI.Responses.Response) {
  const metadata = response.metadata as ResponseMetadata | null
  if (!metadata?.tabla) return

  const status = String(response.status ?? '')
  if (!TERMINAL_STATUSES.has(status)) return

  if (status === 'completed') {
    if (metadata.tabla === 'planes_estudio') {
      await handlePlanesEstudioResponse(response)
    } else if (metadata.tabla === 'asignaturas') {
      await handleAsignaturasResponse(response)
    } else if (metadata.tabla === 'plan_mensajes_ia') {
      await handlePlanMensajesResponse(response)
    } else if (metadata.tabla === 'asignatura_mensajes_ia') {
      await handleAsignaturaMensajesResponse(response)
    }
    return
  }

  if (metadata.tabla === 'planes_estudio') {
    await handlePlanesEstudioUnsuccesfulResponse(response)
  } else if (metadata.tabla === 'asignaturas') {
    await handleAsignaturasUnsuccesfulResponse(response)
  } else if (metadata.tabla === 'plan_mensajes_ia') {
    await handlePlanMensajesUnsuccessfulResponse(response)
  } else if (metadata.tabla === 'asignatura_mensajes_ia') {
    await handleAsignaturaMensajesUnsuccessfulResponse(response)
  }
}

async function deleteProvisional(
  runtime: Runtime,
  kind: 'plan' | 'subject',
  entityId: string,
) {
  if (kind === 'plan') {
    const { data, error } = await runtime.supabaseService
      .from('planes_estudio')
      .select('id,estados_plan(clave)')
      .eq('id', entityId)
      .maybeSingle()

    if (error) {
      throw new HttpError(500, error.message, 'SUPABASE_QUERY_FAILED', error)
    }
    const clave = String((data as any)?.estados_plan?.clave ?? '').toUpperCase()
    if (!clave.startsWith('GENERANDO')) return false

    const { error: lineasDeleteError } = await runtime.supabaseService
      .from('lineas_plan')
      .delete()
      .eq('plan_estudio_id', entityId)
    if (lineasDeleteError) {
      throw new HttpError(
        500,
        lineasDeleteError.message,
        'SUPABASE_DELETE_FAILED',
        lineasDeleteError,
      )
    }

    const { error: deleteError } = await runtime.supabaseService
      .from('planes_estudio')
      .delete()
      .eq('id', entityId)
    if (deleteError) {
      throw new HttpError(
        500,
        deleteError.message,
        'SUPABASE_DELETE_FAILED',
        deleteError,
      )
    }
    return true
  }

  const { data, error } = await runtime.supabaseService
    .from('asignaturas')
    .select('id,estado')
    .eq('id', entityId)
    .maybeSingle()

  if (error) {
    throw new HttpError(500, error.message, 'SUPABASE_QUERY_FAILED', error)
  }
  if (String((data as any)?.estado ?? '').toLowerCase() !== 'generando') {
    return false
  }

  const { error: deleteError } = await runtime.supabaseService
    .from('asignaturas')
    .delete()
    .eq('id', entityId)
  if (deleteError) {
    throw new HttpError(
      500,
      deleteError.message,
      'SUPABASE_DELETE_FAILED',
      deleteError,
    )
  }
  return true
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
  await applyTerminalResponse(response)

  return sendSuccess({
    responseId: response.id,
    status: response.status,
    applied: TERMINAL_STATUSES.has(String(response.status ?? '')),
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

  const current = await runtime.openai.responses.retrieve(payload.responseId)
  assertResponseMatchesEntity(current, payload.kind, payload.entityId, access)

  let response = current
  if (ACTIVE_STATUSES.has(String(current.status ?? ''))) {
    const responses = runtime.openai.responses as unknown as {
      cancel: (responseId: string) => Promise<OpenAI.Responses.Response>
    }
    response = await responses.cancel(payload.responseId)
  }

  const status = String(response.status ?? '')

  // Cancelación efectiva: la entidad sigue provisional (GENERANDO). La borramos
  // SIN pasar por applyTerminalResponse, que la marcaría FALLIDO y dejaría el
  // registro huérfano (deleteProvisional solo borra entidades aún en GENERANDO).
  if (status === 'cancelled') {
    const deleted =
      payload.kind === 'plan' || payload.kind === 'subject'
        ? await deleteProvisional(runtime, payload.kind, payload.entityId)
        : false

    return sendSuccess({
      responseId: response.id,
      status: response.status,
      deleted,
    })
  }

  // Si la respuesta ya terminó por otra vía (completed / failed) mientras se
  // intentaba cancelar, aplicamos su resultado normal y conservamos la entidad.
  if (TERMINAL_STATUSES.has(status)) {
    await applyTerminalResponse(response)
  }

  const deleted =
    payload.kind === 'plan' || payload.kind === 'subject'
      ? await deleteProvisional(runtime, payload.kind, payload.entityId)
      : false

  return sendSuccess({
    responseId: response.id,
    status: response.status,
    deleted,
  })
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
