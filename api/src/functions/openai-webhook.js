import { app } from '@azure/functions'
import OpenAI from 'openai'

import { createWebhookRelaySigner } from '../lib/relay-signature.js'
import { routerConfigurationCode } from '../lib/router-diagnostic.js'
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

  const openai = new OpenAI({
    apiKey: requiredSetting('OPENAI_API_KEY'),
    project: requiredSetting('OPENAI_PROJECT_ID'),
    webhookSecret: requiredSetting('OPENAI_WEBHOOK_SECRET'),
  })
  const validateProjectRef = createSupabaseBranchValidator({
    parentProjectRef,
    accessToken: requiredSetting('SUPABASE_ACCESS_TOKEN'),
  })
  const signRelay = await createWebhookRelaySigner(
    requiredSetting('WEBHOOK_RELAY_PRIVATE_KEY'),
  )

  return createWebhookRouter({
    parentProjectRef,
    verifyWebhook: (payload, headers) =>
      openai.webhooks.unwrap(payload, headers),
    retrieveResponse: (responseId) => openai.responses.retrieve(responseId),
    validateProjectRef,
    signRelay,
  })
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
