import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createSupabaseBranchValidator,
  createWebhookRouter,
  RELAY_PROJECT_REF_HEADER,
  RELAY_SIGNATURE_HEADER,
} from '../src/lib/webhook-router.js'

const PARENT_REF = 'exdkssurzmjnnhgtiama'
const BRANCH_REF = 'abcdefghijklmnopqrst'
const RAW_BODY = JSON.stringify({
  id: 'evt_123',
  type: 'response.completed',
  data: { id: 'resp_123' },
})

function request() {
  return {
    method: 'POST',
    rawBody: RAW_BODY,
    headers: new Headers({ 'webhook-id': 'wh_123' }),
  }
}

function dependencies(overrides = {}) {
  return {
    parentProjectRef: PARENT_REF,
    verifyWebhook: async () => ({
      id: 'evt_123',
      type: 'response.completed',
      data: { id: 'resp_123' },
    }),
    retrieveResponse: async () => ({
      id: 'resp_123',
      metadata: { supabase_project_ref: BRANCH_REF },
    }),
    validateProjectRef: async () => true,
    signRelay: async () => 'v1,signed',
    fetchImpl: async () => new Response(null, { status: 204 }),
    now: () => 1_800_000_000_000,
    ...overrides,
  }
}

describe('Azure OpenAI webhook router', () => {
  it('rechaza una firma de OpenAI inválida antes de consultar la Response', async () => {
    let retrieved = false
    const router = createWebhookRouter(
      dependencies({
        verifyWebhook: async () => {
          throw new Error('invalid signature')
        },
        retrieveResponse: async () => {
          retrieved = true
        },
      }),
    )

    const result = await router(request())

    assert.equal(result.status, 400)
    assert.equal(retrieved, false)
  })

  it('enruta a la branch indicada y firma el cuerpo original', async () => {
    let downstreamUrl = ''
    let downstreamInit
    const router = createWebhookRouter(
      dependencies({
        fetchImpl: async (url, init) => {
          downstreamUrl = String(url)
          downstreamInit = init
          return new Response(null, { status: 204 })
        },
      }),
    )

    const result = await router(request())

    assert.equal(result.status, 204)
    assert.equal(
      downstreamUrl,
      `https://${BRANCH_REF}.supabase.co/functions/v1/openai-webhook-responses`,
    )
    assert.equal(downstreamInit.body, RAW_BODY)
    assert.equal(downstreamInit.headers[RELAY_PROJECT_REF_HEADER], BRANCH_REF)
    assert.equal(downstreamInit.headers[RELAY_SIGNATURE_HEADER], 'v1,signed')
  })

  it('usa producción para Responses anteriores sin metadata de routing', async () => {
    let routedProjectRef = null
    const router = createWebhookRouter(
      dependencies({
        retrieveResponse: async () => ({ id: 'resp_123', metadata: {} }),
        validateProjectRef: async (projectRef) => {
          routedProjectRef = projectRef
          return true
        },
      }),
    )

    const result = await router(request())

    assert.equal(result.status, 204)
    assert.equal(routedProjectRef, PARENT_REF)
  })

  it('confirma eventos de una branch eliminada sin reenviar ni reintentar 72 horas', async () => {
    let forwarded = false
    const router = createWebhookRouter(
      dependencies({
        validateProjectRef: async () => false,
        fetchImpl: async () => {
          forwarded = true
          return new Response(null, { status: 204 })
        },
      }),
    )

    const result = await router(request())

    assert.equal(result.status, 204)
    assert.equal(forwarded, false)
  })

  it('devuelve un error transitorio cuando el handler de branch falla', async () => {
    const router = createWebhookRouter(
      dependencies({
        fetchImpl: async () => new Response('failed', { status: 500 }),
      }),
    )

    const result = await router(request())

    assert.equal(result.status, 502)
  })
})

describe('Supabase branch allowlist', () => {
  it('acepta producción y sólo las branches devueltas por Management API', async () => {
    let calls = 0
    const validate = createSupabaseBranchValidator({
      parentProjectRef: PARENT_REF,
      accessToken: 'token',
      fetchImpl: async () => {
        calls += 1
        return Response.json([{ project_ref: BRANCH_REF }])
      },
      now: () => 1,
    })

    assert.equal(await validate(PARENT_REF), true)
    assert.equal(await validate(BRANCH_REF), true)
    assert.equal(await validate('zzzzzzzzzzzzzzzzzzzz'), false)
    assert.equal(calls, 1)
  })
})
