import { app } from '@azure/functions'
import OpenAI from 'openai'

import { createWebhookRelaySigner } from '../lib/relay-signature.js'
import {
  initializeRouterStage,
  routerConfigurationCode,
} from '../lib/router-diagnostic.js'
import {
  createSupabaseBranchValidator,
  createWebhookRouter,
  isSupabaseProjectRef,
} from '../lib/webhook-router.js'

let routerPromise = null

function requiredSetting(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing Azure Static Web App setting: ${name}`)
  return value
}

async function buildRouter() {
  const parentProjectRef = requiredSetting('SUPABASE_PARENT_PROJECT_REF')
  if (!isSupabaseProjectRef(parentProjectRef)) {
    throw new Error('SUPABASE_PARENT_PROJECT_REF is invalid.')
  }

  const apiKey = requiredSetting('OPENAI_API_KEY')
  const project = requiredSetting('OPENAI_PROJECT_ID')
  const webhookSecret = requiredSetting('OPENAI_WEBHOOK_SECRET')
  const accessToken = requiredSetting('SUPABASE_ACCESS_TOKEN')
  const privateKey = requiredSetting('WEBHOOK_RELAY_PRIVATE_KEY')

  const openai = await initializeRouterStage(
    'openai_client',
    () => new OpenAI({ apiKey, project, webhookSecret }),
  )
  const validateProjectRef = await initializeRouterStage(
    'branch_validator',
    () => createSupabaseBranchValidator({ parentProjectRef, accessToken }),
  )
  const signRelay = await initializeRouterStage('relay_signer', () =>
    createWebhookRelaySigner(privateKey),
  )

  return initializeRouterStage('router', () =>
    createWebhookRouter({
      parentProjectRef,
      verifyWebhook: (payload, headers) =>
        openai.webhooks.unwrap(payload, headers),
      retrieveResponse: (responseId) => openai.responses.retrieve(responseId),
      validateProjectRef,
      signRelay,
    }),
  )
}

async function openAIWebhook(request, context) {
  try {
    routerPromise ??= buildRouter()
    const router = await routerPromise
    return await router(
      {
        method: request.method,
        rawBody: await request.text(),
        headers: request.headers,
      },
      context,
    )
  } catch (error) {
    routerPromise = null
    context.error('OpenAI webhook router is not configured.', error)
    return {
      status: 503,
      body: `Webhook router unavailable (${routerConfigurationCode(error)})`,
    }
  }
}

app.http('openai-webhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'openai-webhook',
  handler: openAIWebhook,
})
