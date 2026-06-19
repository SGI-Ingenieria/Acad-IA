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
  handlePlanesEstudioResponse,
  handlePlanesEstudioUnsuccesfulResponse,
} from '../openai-webhook-responses/planes_estudio/index.ts'

import type { Database } from '../_shared/database.types.ts'
import type { ResponseMetadata } from '../_shared/utils.ts'

type EntityKind = 'plan' | 'subject'

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
  const kind = raw.kind === 'plan' || raw.kind === 'subject' ? raw.kind : null
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
) {
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
}

function assertResponseMatchesEntity(
  response: OpenAI.Responses.Response,
  kind: EntityKind,
  entityId: string,
) {
  const metadata = response.metadata as ResponseMetadata | null
  const expectedTable = kind === 'plan' ? 'planes_estudio' : 'asignaturas'

  if (metadata?.tabla !== expectedTable || metadata.id !== entityId) {
    throw new HttpError(
      409,
      'La respuesta de OpenAI no corresponde a esta generación.',
      'RESPONSE_ENTITY_MISMATCH',
      { expectedTable, entityId, metadata },
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
    }
    return
  }

  if (metadata.tabla === 'planes_estudio') {
    await handlePlanesEstudioUnsuccesfulResponse(response)
  } else if (metadata.tabla === 'asignaturas') {
    await handleAsignaturasUnsuccesfulResponse(response)
  }
}

async function deleteProvisional(
  runtime: Runtime,
  kind: EntityKind,
  entityId: string,
) {
  if (kind === 'plan') {
    const { data, error } = await runtime.supabaseService
      .from('planes_estudio')
      .select('id,estados_plan(clave)')
      .eq('id', entityId)
      .maybeSingle()

    if (error)
      throw new HttpError(500, error.message, 'SUPABASE_QUERY_FAILED', error)
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

  if (error)
    throw new HttpError(500, error.message, 'SUPABASE_QUERY_FAILED', error)
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
  await assertEntityAccess(runtime, payload.kind, payload.entityId)

  const response = await runtime.openai.responses.retrieve(payload.responseId)
  assertResponseMatchesEntity(response, payload.kind, payload.entityId)
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
  await assertEntityAccess(runtime, payload.kind, payload.entityId)

  const current = await runtime.openai.responses.retrieve(payload.responseId)
  assertResponseMatchesEntity(current, payload.kind, payload.entityId)

  let response = current
  if (ACTIVE_STATUSES.has(String(current.status ?? ''))) {
    const responses = runtime.openai.responses as unknown as {
      cancel: (responseId: string) => Promise<OpenAI.Responses.Response>
    }
    response = await responses.cancel(payload.responseId)
  }

  if (String(response.status ?? '') === 'completed') {
    await applyTerminalResponse(response)
  }

  const deleted = await deleteProvisional(
    runtime,
    payload.kind,
    payload.entityId,
  )

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
