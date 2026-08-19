import '@supabase/functions-js/edge-runtime.d.ts'
// @ts-ignore Deno resolves npm imports at runtime.
import jwt from 'jsonwebtoken'
import OpenAI from 'openai'

import { registerGenerationJob } from '../_shared/ai-generation-jobs.ts'
import { withOpenAIWebhookRouting } from '../_shared/openai-webhook-routing.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getBearerToken } from '../_shared/request.ts'
import {
  createAnonClient as createSharedAnonClient,
  createServiceRoleClient,
} from '../_shared/supabase.ts'
import {
  HttpError as SharedHttpError,
  jsonResponse as sharedJsonResponse,
} from '../_shared/utils.ts'
import { classifyAIGenerationRecoveryHealth } from './ai-generation-health.ts'
import {
  classifyEdgeProbeResult,
  type EdgeProbeOutcome,
  type HealthStatus,
  summarizeStatuses,
} from './edge-health.ts'
import { compareMigrations, migrationVersionFromPath } from './migrations.ts'

type JsonRecord = Record<string, unknown>
type SupabaseClientAny = any

const DEFAULT_EDGE_FUNCTIONS = [
  'ai-generate-plan',
  'create-chat-conversation',
  'ai-generate-subject',
  'ai-improve-field',
  'generate-subject-suggestions',
  'openai-webhook-responses',
  'buscar-bibliografia',
  'carbone-io-wrapper',
  'prueba',
  'openai-files',
  'openai-responses',
  'plans_transition_state',
  'subjects_transition_state',
  'usuarios-alta-directa',
  'usuarios',
  'external-auth',
  'internal-auth-login',
  'learning-object-generate',
  'learning-package-export',
]

class HttpError extends SharedHttpError {
  constructor(
    status: number,
    code: string,
    message: string,
    public readonly details?: JsonRecord,
  ) {
    super(status, message, code, details)
    this.name = 'HttpError'
  }
}

function nowIso() {
  return new Date().toISOString()
}

function jsonResponse(body: unknown, status = 200) {
  return sharedJsonResponse(body, status, { 'Cache-Control': 'no-store' })
}

function errorResponse(error: HttpError | Error, fallbackStatus = 500) {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
        checkedAt: nowIso(),
      },
      error.status,
    )
  }

  return jsonResponse(
    {
      ok: false,
      error: {
        code: 'OBSERVABILITY_INTERNAL_ERROR',
        message: error.message || 'No se pudo completar el diagnostico.',
      },
      checkedAt: nowIso(),
    },
    fallbackStatus,
  )
}

function readEnv(name: string) {
  return Deno.env.get(name)?.trim() ?? ''
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n')
}

function environmentPresence(names: Array<string>) {
  return names.map((name) => ({
    name,
    present: Boolean(readEnv(name)),
  }))
}

function supabaseUrl() {
  return readEnv('SUPABASE_URL')
}

function supabaseAnonKey() {
  return readEnv('SUPABASE_ANON_KEY')
}

function supabaseServiceRoleKey() {
  return readEnv('SUPABASE_SERVICE_ROLE_KEY')
}

function requireSupabaseUrl() {
  const url = supabaseUrl()
  if (!url) {
    throw new HttpError(
      500,
      'SUPABASE_ENV_MISSING',
      'Faltan variables de conexion con Supabase.',
    )
  }
  return url
}

function createAnonClient(accessToken?: string) {
  const anonKey = supabaseAnonKey()
  if (!anonKey) {
    throw new HttpError(
      500,
      'SUPABASE_ENV_MISSING',
      'Faltan variables de conexion con Supabase.',
    )
  }
  return createSharedAnonClient(
    accessToken ? `Bearer ${accessToken}` : undefined,
    { supabaseUrl: requireSupabaseUrl(), anonKey },
  )
}

function createServiceClient() {
  const serviceKey = supabaseServiceRoleKey()
  if (!serviceKey) {
    throw new HttpError(
      500,
      'SUPABASE_SERVICE_ROLE_MISSING',
      'No esta configurado el token de servicio de Supabase.',
    )
  }

  return createServiceRoleClient({
    supabaseUrl: requireSupabaseUrl(),
    serviceRoleKey: serviceKey,
  })
}

async function safeParseJson(req: Request): Promise<JsonRecord> {
  if (req.method === 'GET' || req.method === 'OPTIONS') return {}

  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as JsonRecord)
      : {}
  } catch {
    return {}
  }
}

function getAction(req: Request, body: JsonRecord) {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const ownIndex = segments.lastIndexOf('observability-health')
  const pathAction =
    ownIndex >= 0 && segments[ownIndex + 1] ? segments[ownIndex + 1] : null
  const bodyAction = typeof body.action === 'string' ? body.action : null

  return pathAction ?? bodyAction ?? 'public-status'
}

async function checkSupabaseConnectivity(client: SupabaseClientAny) {
  const started = performance.now()

  try {
    const { data, error } = await client.rpc('observability_public_ping')
    if (error) throw error

    return {
      status: 'ok' as HealthStatus,
      latencyMs: Math.round(performance.now() - started),
      serverTime:
        data && typeof data === 'object' && 'server_time' in data
          ? String((data as JsonRecord).server_time)
          : null,
      message: 'Supabase respondio correctamente.',
    }
  } catch (error) {
    return {
      status: 'error' as HealthStatus,
      latencyMs: Math.round(performance.now() - started),
      message:
        error instanceof Error
          ? error.message
          : 'No se pudo consultar Supabase.',
    }
  }
}

async function validateAccessToken(req: Request) {
  const token = getBearerToken(req)
  const started = performance.now()

  if (!token) {
    return {
      status: 'error' as HealthStatus,
      present: false,
      valid: false,
      latencyMs: 0,
      userId: null,
      message: 'No se recibio token de acceso.',
    }
  }

  try {
    const client = createAnonClient(token)
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user) throw error ?? new Error('Usuario no disponible.')

    return {
      status: 'ok' as HealthStatus,
      present: true,
      valid: true,
      latencyMs: Math.round(performance.now() - started),
      userId: data.user.id,
      email: data.user.email ?? null,
      message: 'Token de acceso valido.',
      token,
      client,
      user: data.user,
    }
  } catch (error) {
    return {
      status: 'error' as HealthStatus,
      present: true,
      valid: false,
      latencyMs: Math.round(performance.now() - started),
      userId: null,
      message:
        error instanceof Error
          ? error.message
          : 'El token de acceso no pudo validarse.',
    }
  }
}

async function requireUser(req: Request) {
  const auth = await validateAccessToken(req)
  if (!auth.valid || !auth.token || !auth.client || !auth.user) {
    throw new HttpError(
      401,
      'ACCESS_TOKEN_INVALID',
      auth.message || 'Token de acceso invalido.',
    )
  }

  return auth as typeof auth & {
    token: string
    client: SupabaseClientAny
    user: { id: string; email?: string | null }
  }
}

async function requireAdmin(req: Request) {
  const auth = await requireUser(req)
  const { data, error } = await auth.client.rpc('authz_is_admin')

  if (error) {
    throw new HttpError(
      500,
      'ADMIN_CHECK_FAILED',
      'No se pudo validar el rol de administrador.',
      { reason: error.message },
    )
  }

  if (data !== true) {
    throw new HttpError(
      403,
      'ADMIN_REQUIRED',
      'Esta seccion esta disponible solo para administradores.',
    )
  }

  return auth
}

function getConfiguredEdgeFunctions() {
  const configured = readEnv('OBSERVABILITY_EDGE_FUNCTIONS')
  const names = configured
    ? configured.split(',').map((item) => item.trim())
    : DEFAULT_EDGE_FUNCTIONS

  return Array.from(new Set(names.filter(Boolean))).filter(
    (name) => name !== 'observability-health',
  )
}

async function probeEdgeFunction(args: {
  name: string
  accessToken?: string
  treatAuthFailureAsError?: boolean
}): Promise<EdgeProbeOutcome> {
  const url = supabaseUrl()
  const anonKey = supabaseAnonKey()

  if (!url || !anonKey) {
    return classifyEdgeProbeResult({
      functionName: args.name,
      fetchError: 'Faltan variables de conexion para consultar Edge Functions.',
    })
  }

  const endpoint = `${url.replace(/\/+$/, '')}/functions/v1/${args.name}`
  const controller = new AbortController()
  const timeoutMs = Number(readEnv('OBSERVABILITY_EDGE_TIMEOUT_MS') || 6000)
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const started = performance.now()

  try {
    const response = await fetch(endpoint, {
      method: 'OPTIONS',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${args.accessToken || anonKey}`,
        'content-type': 'application/json',
      },
      signal: controller.signal,
    })
    const bodyText = await response.text().catch(() => '')
    const latencyMs = Math.round(performance.now() - started)

    return classifyEdgeProbeResult({
      functionName: args.name,
      status: response.status,
      latencyMs,
      bodyText,
      errorCode:
        response.headers.get('sb-error-code') ??
        response.headers.get('x-sb-error-code'),
      treatAuthFailureAsError: args.treatAuthFailureAsError,
    })
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started)
    const timedOut =
      error instanceof DOMException && error.name === 'AbortError'

    return classifyEdgeProbeResult({
      functionName: args.name,
      latencyMs,
      fetchError:
        error instanceof Error
          ? error.message
          : 'No se pudo consultar la Edge Function.',
      timedOut,
      treatAuthFailureAsError: args.treatAuthFailureAsError,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function buildEdgeFunctionsHealth(accessToken?: string) {
  const items = await Promise.all(
    getConfiguredEdgeFunctions().map((name) =>
      probeEdgeFunction({
        name,
        accessToken,
        treatAuthFailureAsError: Boolean(accessToken),
      }),
    ),
  )
  const summary = summarizeStatuses(items)

  return {
    ...summary,
    items,
  }
}

/**
 * Estado ligero para comprobaciones automáticas. Si esta función está
 * respondiendo, el gateway y el runtime de Edge ya demostraron conectividad;
 * arrancar todos los demás workers desde aquí sólo para comprobarlos termina
 * compitiendo con las peticiones reales de la aplicación.
 */
function buildCurrentEdgeFunctionHealth() {
  const items: Array<EdgeProbeOutcome> = [
    {
      name: 'observability-health',
      status: 'ok',
      latencyMs: 0,
      message: 'El gateway y el runtime de Edge respondieron correctamente.',
    },
  ]

  return {
    ...summarizeStatuses(items),
    items,
  }
}

async function deepEdgeFunctionsHealth(req: Request) {
  const auth = await requireAdmin(req)
  const edgeFunctions = await buildEdgeFunctionsHealth(auth.token)

  return jsonResponse({
    ok: edgeFunctions.status !== 'error',
    status: edgeFunctions.status,
    checkedAt: nowIso(),
    edgeFunctions,
  })
}

function aggregateStatus(statuses: Array<HealthStatus>) {
  if (statuses.includes('error')) return 'error' as HealthStatus
  if (statuses.includes('warning')) return 'warning' as HealthStatus
  return 'ok' as HealthStatus
}

function openAIWebhookUrl() {
  const projectId = readEnv('OPENAI_PROJECT_ID')
  if (!projectId) return null

  return `https://platform.openai.com/settings/${encodeURIComponent(
    projectId,
  )}/webhooks`
}

function openAIHeaders(options: { includeProjectContext?: boolean } = {}) {
  const includeProjectContext = options.includeProjectContext ?? true
  const headers: Record<string, string> = {
    Authorization: `Bearer ${readEnv('OPENAI_API_KEY')}`,
  }
  const project = readEnv('OPENAI_PROJECT_ID')
  const organization = readEnv('OPENAI_ORG_ID')

  if (includeProjectContext && project) headers['OpenAI-Project'] = project
  if (includeProjectContext && organization) {
    headers['OpenAI-Organization'] = organization
  }

  return headers
}

async function fetchOpenAIEndpoint(
  path: string,
  headers: Record<string, string>,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  const started = performance.now()

  try {
    const response = await fetch(`https://api.openai.com${path}`, {
      headers,
      signal: controller.signal,
    })
    const latencyMs = Math.round(performance.now() - started)
    const body = response.ok ? '' : await response.text().catch(() => '')

    return { response, latencyMs, body }
  } finally {
    clearTimeout(timeout)
  }
}

async function checkOpenAIHealth() {
  const env = {
    apiKey: Boolean(readEnv('OPENAI_API_KEY')),
    projectId: Boolean(readEnv('OPENAI_PROJECT_ID')),
    webhookSecret: Boolean(readEnv('OPENAI_WEBHOOK_SECRET')),
    organizationId: Boolean(readEnv('OPENAI_ORG_ID')),
    healthcheckModel: readEnv('OPENAI_HEALTHCHECK_MODEL') || 'gpt-5.6-luna',
  }

  if (!env.apiKey) {
    return {
      status: 'error' as HealthStatus,
      env,
      latencyMs: null,
      keyValid: false,
      identity: {
        status: 'error' as HealthStatus,
        latencyMs: null,
        valid: false,
        message: 'Falta OPENAI_API_KEY.',
      },
      models: {
        status: 'error' as HealthStatus,
        latencyMs: null,
        reachable: false,
        message: 'No se consulto el catalogo de modelos.',
      },
      projectContextValid: false,
      connectivityValid: false,
      webhookUrl: openAIWebhookUrl(),
      message: 'Falta OPENAI_API_KEY.',
    }
  }

  let keyValid = false
  let identityLatencyMs: number | null = null

  try {
    const identity = await fetchOpenAIEndpoint(
      '/v1/me',
      openAIHeaders({ includeProjectContext: false }),
    )
    identityLatencyMs = identity.latencyMs

    if (identity.response.status === 401 || identity.response.status === 403) {
      return {
        status: 'error' as HealthStatus,
        env,
        latencyMs: identity.latencyMs,
        keyValid: false,
        identity: {
          status: 'error' as HealthStatus,
          latencyMs: identity.latencyMs,
          valid: false,
          message: 'La llave no fue aceptada por /v1/me.',
        },
        models: {
          status: 'warning' as HealthStatus,
          latencyMs: null,
          reachable: false,
          message: 'No se consulto el catalogo de modelos.',
        },
        projectContextValid: false,
        connectivityValid: false,
        webhookUrl: openAIWebhookUrl(),
        message: 'La llave de OpenAI no fue aceptada.',
      }
    }

    if (!identity.response.ok) {
      return {
        status: 'warning' as HealthStatus,
        env,
        latencyMs: identity.latencyMs,
        keyValid: false,
        identity: {
          status: 'warning' as HealthStatus,
          latencyMs: identity.latencyMs,
          valid: false,
          message:
            identity.body.slice(0, 220) ||
            `OpenAI /v1/me respondio con estado ${identity.response.status}.`,
        },
        models: {
          status: 'warning' as HealthStatus,
          latencyMs: null,
          reachable: false,
          message: 'No se consulto el catalogo de modelos.',
        },
        projectContextValid: false,
        connectivityValid: false,
        webhookUrl: openAIWebhookUrl(),
        message:
          identity.body.slice(0, 220) ||
          `OpenAI /v1/me respondio con estado ${identity.response.status}.`,
      }
    }

    keyValid = true
    const models = await fetchOpenAIEndpoint('/v1/models', openAIHeaders())
    const latencyMs = identity.latencyMs + models.latencyMs

    if (models.response.status === 401 || models.response.status === 403) {
      return {
        status: 'error' as HealthStatus,
        env,
        latencyMs,
        keyValid,
        identity: {
          status: 'ok' as HealthStatus,
          latencyMs: identity.latencyMs,
          valid: true,
          message: 'La llave fue aceptada por /v1/me.',
        },
        models: {
          status: 'error' as HealthStatus,
          latencyMs: models.latencyMs,
          reachable: false,
          message: 'El contexto de proyecto u organizacion no fue aceptado.',
        },
        projectContextValid: false,
        connectivityValid: false,
        webhookUrl: openAIWebhookUrl(),
        message:
          'OpenAI acepto la llave, pero rechazo el proyecto u organizacion configurados.',
      }
    }

    if (!models.response.ok) {
      return {
        status: 'warning' as HealthStatus,
        env,
        latencyMs,
        keyValid,
        identity: {
          status: 'ok' as HealthStatus,
          latencyMs: identity.latencyMs,
          valid: true,
          message: 'La llave fue aceptada por /v1/me.',
        },
        models: {
          status: 'warning' as HealthStatus,
          latencyMs: models.latencyMs,
          reachable: false,
          message:
            models.body.slice(0, 220) ||
            `OpenAI /v1/models respondio con estado ${models.response.status}.`,
        },
        projectContextValid: true,
        connectivityValid: false,
        webhookUrl: openAIWebhookUrl(),
        message:
          models.body.slice(0, 220) ||
          `OpenAI /v1/models respondio con estado ${models.response.status}.`,
      }
    }

    return {
      status: 'ok' as HealthStatus,
      env,
      latencyMs,
      keyValid,
      identity: {
        status: 'ok' as HealthStatus,
        latencyMs: identity.latencyMs,
        valid: true,
        message: 'La llave fue aceptada por /v1/me.',
      },
      models: {
        status: 'ok' as HealthStatus,
        latencyMs: models.latencyMs,
        reachable: true,
        message: 'El catalogo de modelos respondio correctamente.',
      },
      projectContextValid: true,
      connectivityValid: true,
      webhookUrl: openAIWebhookUrl(),
      message: 'OpenAI respondio correctamente.',
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo conectar con OpenAI.'

    return {
      status: 'error' as HealthStatus,
      env,
      latencyMs: identityLatencyMs,
      keyValid,
      identity: {
        status: keyValid ? ('ok' as HealthStatus) : ('error' as HealthStatus),
        latencyMs: identityLatencyMs,
        valid: keyValid,
        message: keyValid
          ? 'La llave fue aceptada por /v1/me.'
          : 'No se pudo validar la llave con /v1/me.',
      },
      models: {
        status: 'error' as HealthStatus,
        latencyMs: null,
        reachable: false,
        message,
      },
      projectContextValid: false,
      connectivityValid: false,
      webhookUrl: openAIWebhookUrl(),
      message,
    }
  }
}

function createOpenAIClient() {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (!apiKey) {
    throw new HttpError(500, 'OPENAI_API_KEY_MISSING', 'Falta OPENAI_API_KEY.')
  }

  return new OpenAI({
    apiKey,
    organization: readEnv('OPENAI_ORG_ID') || undefined,
    project: readEnv('OPENAI_PROJECT_ID') || undefined,
  } as ConstructorParameters<typeof OpenAI>[0])
}

function getHealthcheckModel() {
  return (
    readEnv('OPENAI_HEALTHCHECK_MODEL') ||
    readEnv('AI_IMPROVE_FIELD_MODELO') ||
    'gpt-5.6-luna'
  )
}

async function insertTestRun(args: {
  client: SupabaseClientAny
  tipo: 'openai_foreground' | 'openai_background'
  userId: string
  metadata?: JsonRecord
}) {
  const { data, error } = await args.client
    .from('observability_test_runs')
    .insert({
      tipo: args.tipo,
      estado: 'running',
      created_by: args.userId,
      metadata: args.metadata ?? {},
    })
    .select('id,started_at')
    .single()

  if (error || !data) {
    throw new HttpError(
      500,
      'OBSERVABILITY_TEST_RUN_INSERT_FAILED',
      'No se pudo registrar la prueba de observabilidad.',
      { reason: error?.message },
    )
  }

  return data as { id: string; started_at: string }
}

async function updateTestRun(
  client: SupabaseClientAny,
  id: string,
  patch: JsonRecord,
) {
  await client.from('observability_test_runs').update(patch).eq('id', id)
}

async function runOpenAIForegroundTest(req: Request) {
  const auth = await requireAdmin(req)
  const serviceClient = createServiceClient()
  const run = await insertTestRun({
    client: serviceClient,
    tipo: 'openai_foreground',
    userId: auth.user.id,
    metadata: { source: 'observability-dashboard' },
  })

  const started = performance.now()

  try {
    const client = createOpenAIClient()
    const response = await client.responses.create(
      {
        model: getHealthcheckModel(),
        input: 'Responde exactamente: OK',
        max_output_tokens: 16,
      },
      { timeout: 10_000 } as never,
    )
    const latencyMs = Math.round(performance.now() - started)
    const outputText =
      typeof response.output_text === 'string'
        ? response.output_text.trim()
        : ''

    await updateTestRun(serviceClient, run.id, {
      estado: 'completed',
      openai_response_id: response.id,
      completed_at: new Date().toISOString(),
      latency_ms: latencyMs,
      metadata: {
        source: 'observability-dashboard',
        output_text: outputText,
      },
    })

    return jsonResponse({
      ok: true,
      checkedAt: nowIso(),
      testRun: {
        id: run.id,
        status: 'completed',
        responseId: response.id,
        latencyMs,
        outputText,
      },
    })
  } catch (error) {
    await updateTestRun(serviceClient, run.id, {
      estado: 'failed',
      completed_at: new Date().toISOString(),
      latency_ms: Math.round(performance.now() - started),
      error_code:
        error instanceof HttpError ? error.code : 'OPENAI_TEST_FAILED',
      error_message:
        error instanceof Error
          ? error.message
          : 'No se pudo completar la prueba.',
    })

    throw error instanceof HttpError
      ? error
      : new HttpError(
          502,
          'OPENAI_TEST_FAILED',
          error instanceof Error
            ? error.message
            : 'No se pudo completar la prueba.',
        )
  }
}

async function runOpenAIBackgroundTest(req: Request) {
  const auth = await requireAdmin(req)
  const serviceClient = createServiceClient()
  const run = await insertTestRun({
    client: serviceClient,
    tipo: 'openai_background',
    userId: auth.user.id,
    metadata: { source: 'observability-dashboard' },
  })

  const started = performance.now()

  try {
    const client = createOpenAIClient()
    const response = await client.responses.create(
      withOpenAIWebhookRouting({
        model: getHealthcheckModel(),
        input: 'Responde exactamente: OK',
        background: true,
        max_output_tokens: 16,
        metadata: {
          tabla: 'observability',
          accion: 'background_test',
          observability_test_run_id: run.id,
        },
      }),
      { timeout: 10_000 } as never,
    )
    const latencyMs = Math.round(performance.now() - started)

    await updateTestRun(serviceClient, run.id, {
      estado: 'running',
      openai_response_id: response.id,
      latency_ms: latencyMs,
      metadata: {
        source: 'observability-dashboard',
        openai_status:
          typeof response.status === 'string' ? response.status : 'queued',
      },
    })

    try {
      await registerGenerationJob({
        supabase: serviceClient,
        kind: 'observability',
        entityId: run.id,
        responseId: response.id,
        openaiStatus:
          typeof response.status === 'string' ? response.status : 'queued',
        startedAt: run.started_at,
        metadata: { source: 'observability-dashboard' },
      })
    } catch (jobError) {
      console.warn(
        'No se pudo registrar la bitácora de observabilidad:',
        jobError,
      )
    }

    return jsonResponse({
      ok: true,
      checkedAt: nowIso(),
      testRun: {
        id: run.id,
        status: 'running',
        responseId: response.id,
        latencyMs,
      },
    })
  } catch (error) {
    await updateTestRun(serviceClient, run.id, {
      estado: 'failed',
      completed_at: new Date().toISOString(),
      latency_ms: Math.round(performance.now() - started),
      error_code:
        error instanceof HttpError ? error.code : 'OPENAI_TEST_FAILED',
      error_message:
        error instanceof Error
          ? error.message
          : 'No se pudo iniciar la prueba.',
    })

    throw error instanceof HttpError
      ? error
      : new HttpError(
          502,
          'OPENAI_BACKGROUND_TEST_FAILED',
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar la prueba.',
        )
  }
}

async function clearRecentObservability(req: Request, body: JsonRecord) {
  await requireAdmin(req)
  const serviceClient = createServiceClient()
  const scope = typeof body.scope === 'string' ? body.scope : 'all'

  const cleared: Array<string> = []

  // Los eventos referencian a las corridas (FK on delete set null), asi que da
  // igual el orden; usamos un filtro siempre-verdadero (id nunca es null) porque
  // PostgREST exige un filtro para un delete masivo.
  if (scope === 'webhook_events' || scope === 'all') {
    const { error } = await serviceClient
      .from('observability_webhook_events')
      .delete()
      .not('id', 'is', null)
    if (error) {
      throw new HttpError(500, 'OBSERVABILITY_CLEAR_FAILED', error.message)
    }
    cleared.push('webhook_events')
  }

  if (scope === 'test_runs' || scope === 'all') {
    const { error } = await serviceClient
      .from('observability_test_runs')
      .delete()
      .not('id', 'is', null)
    if (error) {
      throw new HttpError(500, 'OBSERVABILITY_CLEAR_FAILED', error.message)
    }
    cleared.push('test_runs')
  }

  return jsonResponse({ ok: true, checkedAt: nowIso(), scope, cleared })
}

async function readAppliedMigrations(client: SupabaseClientAny) {
  const { data, error } = await (client as any).rpc(
    'observability_applied_migrations',
  )
  if (error) throw error

  return (data ?? [])
    .map((row: JsonRecord) => String(row.version ?? '').trim())
    .filter(Boolean)
}

function githubConfig() {
  const appId = readEnv('GITHUB_APP_ID')
  const installationId = readEnv('GITHUB_APP_INSTALLATION_ID')
  const privateKey = readEnv('GITHUB_APP_PRIVATE_KEY')
  const owner = readEnv('GITHUB_OWNER')
  const repo = readEnv('GITHUB_REPO')
  const ref = readEnv('GITHUB_REF') || 'main'
  const path = readEnv('GITHUB_MIGRATIONS_PATH') || 'supabase/migrations'

  return {
    appId,
    installationId,
    privateKey,
    owner,
    repo,
    ref,
    path,
    configured: Boolean(appId && installationId && privateKey && owner && repo),
  }
}

async function getGitHubInstallationToken(
  config: ReturnType<typeof githubConfig>,
) {
  const issuedAt = Math.floor(Date.now() / 1000) - 60
  const token = jwt.sign(
    {
      iat: issuedAt,
      exp: issuedAt + 9 * 60,
      iss: config.appId,
    },
    normalizePrivateKey(config.privateKey),
    { algorithm: 'RS256' },
  )

  const response = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(
      config.installationId,
    )}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'acad-ia-observability',
      },
    },
  )

  if (!response.ok) {
    throw new Error(
      `GitHub App no entrego token de instalacion (${response.status}).`,
    )
  }

  const body = await response.json()
  if (!body?.token || typeof body.token !== 'string') {
    throw new Error('GitHub no devolvio un token de instalacion valido.')
  }

  return body.token as string
}

async function readExpectedMigrationsFromGitHub() {
  const config = githubConfig()

  if (!config.configured) {
    return {
      configured: false,
      status: 'warning' as HealthStatus,
      ref: config.ref,
      path: config.path,
      versions: [] as Array<string>,
      message: 'Configura el GitHub App para comparar contra main.',
    }
  }

  const token = await getGitHubInstallationToken(config)
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(
      config.owner,
    )}/${encodeURIComponent(config.repo)}/git/trees/${encodeURIComponent(
      config.ref,
    )}?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'acad-ia-observability',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`No se pudo leer el arbol de GitHub (${response.status}).`)
  }

  const body = await response.json()
  if (body.truncated === true) {
    throw new Error('GitHub devolvio el arbol truncado.')
  }

  const prefix = `${config.path.replace(/\/+$/, '')}/`
  const versions = (Array.isArray(body.tree) ? body.tree : [])
    .filter(
      (item: JsonRecord) =>
        item.type === 'blob' &&
        typeof item.path === 'string' &&
        item.path.startsWith(prefix),
    )
    .map((item: JsonRecord) => migrationVersionFromPath(String(item.path)))
    .filter((version: string | null): version is string => Boolean(version))

  return {
    configured: true,
    status: 'ok' as HealthStatus,
    ref: config.ref,
    path: config.path,
    versions,
    message: 'Migraciones esperadas leidas desde GitHub.',
  }
}

async function buildMigrationsHealth(client: SupabaseClientAny) {
  try {
    const [applied, expectedResult] = await Promise.all([
      readAppliedMigrations(client),
      readExpectedMigrationsFromGitHub().catch((error) => ({
        configured: githubConfig().configured,
        status: 'warning' as HealthStatus,
        ref: githubConfig().ref,
        path: githubConfig().path,
        versions: [] as Array<string>,
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo consultar GitHub.',
      })),
    ])
    const comparison = compareMigrations({
      applied,
      expected: expectedResult.versions,
    })
    const status: HealthStatus = !expectedResult.configured
      ? 'warning'
      : comparison.missing.length > 0
        ? 'error'
        : comparison.extra.length > 0 || expectedResult.status === 'warning'
          ? 'warning'
          : 'ok'

    return {
      status,
      ...comparison,
      github: {
        configured: expectedResult.configured,
        status: expectedResult.status,
        ref: expectedResult.ref,
        path: expectedResult.path,
        message: expectedResult.message,
      },
    }
  } catch (error) {
    return {
      status: 'error' as HealthStatus,
      applied: [],
      expected: [],
      missing: [],
      extra: [],
      latestApplied: null,
      latestExpected: null,
      github: {
        configured: githubConfig().configured,
        status: 'warning' as HealthStatus,
        ref: githubConfig().ref,
        path: githubConfig().path,
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo verificar migraciones.',
      },
    }
  }
}

async function readRecentObservabilityRows(client: SupabaseClientAny) {
  const [eventsResult, runsResult] = await Promise.all([
    client
      .from('observability_webhook_events')
      .select(
        'id,event_id,event_type,openai_response_id,test_run_id,received_at,last_received_at,delivery_count,signature_valid,processing_status,processing_error',
      )
      .order('received_at', { ascending: false })
      .limit(20),
    client
      .from('observability_test_runs')
      .select(
        'id,tipo,estado,openai_response_id,started_at,completed_at,latency_ms,error_code,error_message,metadata',
      )
      .order('started_at', { ascending: false })
      .limit(20),
  ])

  return {
    webhookEvents: eventsResult.error ? [] : (eventsResult.data ?? []),
    testRuns: runsResult.error ? [] : (runsResult.data ?? []),
    status:
      eventsResult.error || runsResult.error
        ? ('warning' as HealthStatus)
        : ('ok' as HealthStatus),
    message:
      eventsResult.error?.message ??
      runsResult.error?.message ??
      'Eventos recientes leidos correctamente.',
  }
}

async function buildAIGenerationsHealth(client: SupabaseClientAny) {
  const [summaryResult, executionsResult] = await Promise.all([
    client.rpc('resumen_trabajos_generacion_ia'),
    client
      .from('ejecuciones_recuperacion_ia')
      .select(
        'id,iniciado_en,completado_en,descubiertos,reclamados,completados,reprogramados,fallidos,error',
      )
      .order('iniciado_en', { ascending: false })
      .limit(20),
  ])
  const summary = summaryResult.data ?? {}
  const readError =
    summaryResult.error?.message ?? executionsResult.error?.message
  const health = readError
    ? {
        status: 'warning' as HealthStatus,
        message: readError,
      }
    : classifyAIGenerationRecoveryHealth(summary)

  return {
    status: health.status,
    summary,
    executions: executionsResult.data ?? [],
    message: health.message,
  }
}

function serviceRoleUnavailableMigrations(message: string) {
  return {
    status: 'error' as HealthStatus,
    applied: [],
    expected: [],
    missing: [],
    extra: [],
    latestApplied: null,
    latestExpected: null,
    github: {
      configured: githubConfig().configured,
      status: 'warning' as HealthStatus,
      ref: githubConfig().ref,
      path: githubConfig().path,
      message,
    },
  }
}

function serviceRoleUnavailableRecentRows(message: string) {
  return {
    webhookEvents: [],
    testRuns: [],
    status: 'error' as HealthStatus,
    message,
  }
}

async function publicStatus() {
  const client = createAnonClient()
  const [supabase, edgeFunctions] = await Promise.all([
    checkSupabaseConnectivity(client),
    Promise.resolve(buildCurrentEdgeFunctionHealth()),
  ])
  const status = aggregateStatus([supabase.status, edgeFunctions.status])

  return jsonResponse({
    ok: status !== 'error',
    status,
    checkedAt: nowIso(),
    supabase,
    edgeFunctions: {
      status: edgeFunctions.status,
      ok: edgeFunctions.ok,
      warning: edgeFunctions.warning,
      error: edgeFunctions.error,
      total: edgeFunctions.total,
      items: edgeFunctions.items.filter((item) => item.status !== 'ok'),
    },
  })
}

async function sessionGate(req: Request) {
  const auth = await validateAccessToken(req)

  if (!auth.valid || !auth.token) {
    return jsonResponse({
      ok: false,
      allowed: false,
      status: 'error',
      checkedAt: nowIso(),
      authToken: {
        status: auth.status,
        present: auth.present,
        valid: auth.valid,
        latencyMs: auth.latencyMs,
        message: auth.message,
      },
      message: 'No se pudo validar el acceso.',
    })
  }

  const [supabase, edgeFunctions] = await Promise.all([
    checkSupabaseConnectivity(createAnonClient(auth.token)),
    Promise.resolve(buildCurrentEdgeFunctionHealth()),
  ])
  const status = aggregateStatus([
    auth.status,
    supabase.status,
    edgeFunctions.status,
  ])

  return jsonResponse({
    ok: status !== 'error',
    allowed: status !== 'error',
    status,
    checkedAt: nowIso(),
    authToken: {
      status: auth.status,
      present: auth.present,
      valid: auth.valid,
      latencyMs: auth.latencyMs,
      userId: auth.userId,
      message: auth.message,
    },
    supabase,
    edgeFunctions,
    message:
      status === 'error'
        ? 'La plataforma esta teniendo problemas de conectividad.'
        : 'Diagnostico de acceso completado.',
  })
}

async function snapshot(req: Request) {
  const auth = await requireAdmin(req)
  const serviceEnv = environmentPresence([
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ])
  let serviceClient: SupabaseClientAny | null = null
  let serviceClientError: string | null = null

  try {
    serviceClient = createServiceClient()
  } catch (error) {
    serviceClientError =
      error instanceof Error
        ? error.message
        : 'No esta configurado el token de servicio de Supabase.'
  }

  const [supabase, edgeFunctions, openai, migrations, recent, aiGenerations] =
    await Promise.all([
      checkSupabaseConnectivity(createAnonClient(auth.token)),
      Promise.resolve(buildCurrentEdgeFunctionHealth()),
      checkOpenAIHealth(),
      serviceClient
        ? buildMigrationsHealth(serviceClient)
        : serviceRoleUnavailableMigrations(
            serviceClientError ??
              'No esta configurado el token de servicio de Supabase.',
          ),
      serviceClient
        ? readRecentObservabilityRows(serviceClient)
        : serviceRoleUnavailableRecentRows(
            serviceClientError ??
              'No esta configurado el token de servicio de Supabase.',
          ),
      serviceClient
        ? buildAIGenerationsHealth(serviceClient)
        : {
            status: 'error' as HealthStatus,
            summary: {},
            executions: [],
            message:
              serviceClientError ??
              'No esta configurado el token de servicio de Supabase.',
          },
    ])
  const status = aggregateStatus([
    supabase.status,
    edgeFunctions.status,
    openai.status,
    migrations.status,
    recent.status,
    aiGenerations.status,
  ])

  return jsonResponse({
    ok: status !== 'error',
    status,
    checkedAt: nowIso(),
    authToken: {
      status: 'ok',
      present: true,
      valid: true,
      latencyMs: auth.latencyMs,
      userId: auth.user.id,
      message: 'Token de acceso valido.',
    },
    supabase,
    serviceEnv,
    edgeFunctions,
    openai,
    migrations,
    aiGenerations,
    webhooks: {
      status: recent.status,
      message: recent.message,
      directUrl: openAIWebhookUrl(),
      events: recent.webhookEvents,
      testRuns: recent.testRuns,
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await safeParseJson(req)
    const action = getAction(req, body)

    switch (action) {
      case 'public-status':
        return await publicStatus()
      case 'session-gate':
        return await sessionGate(req)
      case 'snapshot':
        return await snapshot(req)
      case 'edge-functions-deep-check':
        return await deepEdgeFunctionsHealth(req)
      case 'openai-foreground-test':
        return await runOpenAIForegroundTest(req)
      case 'openai-background-test':
        return await runOpenAIBackgroundTest(req)
      case 'clear-recent':
        return await clearRecentObservability(req, body)
      default:
        throw new HttpError(
          404,
          'OBSERVABILITY_ACTION_NOT_FOUND',
          `Accion no reconocida: ${action}`,
        )
    }
  } catch (error) {
    console.error('[observability-health]', error)
    return errorResponse(
      error instanceof Error ? error : new Error(String(error)),
    )
  }
})
