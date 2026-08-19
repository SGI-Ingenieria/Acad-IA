export const RELAY_SIGNATURE_HEADER = 'x-acad-ia-relay-signature'
export const RELAY_TIMESTAMP_HEADER = 'x-acad-ia-relay-timestamp'
export const RELAY_PROJECT_REF_HEADER = 'x-acad-ia-project-ref'
export const RELAY_WEBHOOK_ID_HEADER = 'x-acad-ia-webhook-id'

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/
const ROUTED_EVENT_TYPES = new Set([
  'response.completed',
  'response.cancelled',
  'response.failed',
  'response.incomplete',
])

export class WebhookRouterError extends Error {
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'WebhookRouterError'
    this.code = code
  }
}

export function isSupabaseProjectRef(value) {
  return typeof value === 'string' && PROJECT_REF_PATTERN.test(value)
}

function getHeader(headers, name) {
  if (headers && typeof headers.get === 'function') return headers.get(name)
  const entry = Object.entries(headers ?? {}).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )
  return entry ? String(entry[1]) : null
}

function safeLogger(logger) {
  return {
    info: logger?.info ?? logger?.log ?? (() => undefined),
    warn: logger?.warn ?? logger?.log ?? (() => undefined),
    error: logger?.error ?? logger?.log ?? (() => undefined),
  }
}

export function createSupabaseBranchValidator(options) {
  const {
    parentProjectRef,
    accessToken,
    fetchImpl = fetch,
    cacheMilliseconds = 30_000,
    now = Date.now,
  } = options

  let expiresAt = 0
  let allowedProjectRefs = new Set([parentProjectRef])
  let refreshPromise = null

  async function refresh() {
    const response = await fetchImpl(
      `https://api.supabase.com/v1/projects/${encodeURIComponent(parentProjectRef)}/branches`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8_000),
      },
    )
    if (!response.ok) {
      throw new WebhookRouterError(
        'BRANCH_DIRECTORY_UNAVAILABLE',
        `Supabase branch directory returned ${response.status}.`,
      )
    }

    const branches = await response.json()
    if (!Array.isArray(branches)) {
      throw new WebhookRouterError(
        'BRANCH_DIRECTORY_INVALID',
        'Supabase branch directory returned an invalid payload.',
      )
    }

    allowedProjectRefs = new Set([
      parentProjectRef,
      ...branches
        .map((branch) => branch?.project_ref)
        .filter(isSupabaseProjectRef),
    ])
    expiresAt = now() + cacheMilliseconds
  }

  return async (projectRef) => {
    if (projectRef === parentProjectRef) return true
    if (now() >= expiresAt) {
      refreshPromise ??= refresh().finally(() => {
        refreshPromise = null
      })
      await refreshPromise
    }
    return allowedProjectRefs.has(projectRef)
  }
}

function targetProjectRef(response, parentProjectRef) {
  const projectRef = response?.metadata?.supabase_project_ref
  if (projectRef === undefined || projectRef === null || projectRef === '') {
    return parentProjectRef
  }
  return isSupabaseProjectRef(projectRef) ? projectRef : null
}

export function createWebhookRouter(options) {
  const {
    verifyWebhook,
    retrieveResponse,
    validateProjectRef,
    signRelay,
    parentProjectRef,
    fetchImpl = fetch,
    now = Date.now,
  } = options

  return async function routeWebhook(request, loggerInput) {
    const logger = safeLogger(loggerInput)
    if (request.method !== 'POST') {
      return { status: 405, body: 'Method Not Allowed' }
    }

    let event
    try {
      event = await verifyWebhook(request.rawBody, request.headers)
    } catch (error) {
      logger.warn('OpenAI webhook signature rejected.', error)
      return { status: 400, body: 'Invalid webhook signature' }
    }

    if (!ROUTED_EVENT_TYPES.has(event?.type)) {
      logger.info('OpenAI webhook event ignored.', { type: event?.type })
      return { status: 204 }
    }

    const responseId = event?.data?.id
    if (typeof responseId !== 'string' || !responseId) {
      logger.warn('OpenAI webhook has no response id.', { eventId: event?.id })
      return { status: 204 }
    }

    try {
      const response = await retrieveResponse(responseId)
      const projectRef = targetProjectRef(response, parentProjectRef)
      if (!projectRef) {
        logger.error('OpenAI response has invalid routing metadata.', {
          eventId: event.id,
          responseId,
        })
        return { status: 204 }
      }

      if (!(await validateProjectRef(projectRef))) {
        logger.warn('OpenAI response targets an unavailable Supabase branch.', {
          eventId: event.id,
          responseId,
          projectRef,
        })
        return { status: 204 }
      }

      const timestamp = String(Math.floor(now() / 1000))
      const webhookId =
        getHeader(request.headers, 'webhook-id') ?? event.id ?? responseId
      const signature = await signRelay({
        timestamp,
        projectRef,
        webhookId,
        rawBody: request.rawBody,
      })
      const downstream = await fetchImpl(
        `https://${projectRef}.supabase.co/functions/v1/openai-webhook-responses`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [RELAY_SIGNATURE_HEADER]: signature,
            [RELAY_TIMESTAMP_HEADER]: timestamp,
            [RELAY_PROJECT_REF_HEADER]: projectRef,
            [RELAY_WEBHOOK_ID_HEADER]: webhookId,
          },
          body: request.rawBody,
          signal: AbortSignal.timeout(10_000),
        },
      )

      if (!downstream.ok) {
        logger.error('Supabase webhook handler rejected the delivery.', {
          eventId: event.id,
          responseId,
          projectRef,
          status: downstream.status,
        })
        return { status: 502, body: 'Branch delivery failed' }
      }

      logger.info('OpenAI webhook routed.', {
        eventId: event.id,
        responseId,
        projectRef,
      })
      return { status: 204 }
    } catch (error) {
      logger.error('OpenAI webhook routing failed.', error)
      if (
        error instanceof WebhookRouterError &&
        error.code.startsWith('BRANCH_DIRECTORY_')
      ) {
        return { status: 503, body: 'Branch directory unavailable' }
      }
      return { status: 500, body: 'Webhook routing failed' }
    }
  }
}
