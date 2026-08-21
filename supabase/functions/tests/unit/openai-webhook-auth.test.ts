import { assertThrows } from 'jsr:@std/assert@1'

import {
  InvalidOpenAIWebhookRequestError,
  requireOpenAIWebhookHeaders,
} from '../../_shared/openai-webhook-auth.ts'

Deno.test('acepta el conjunto completo de encabezados webhook de OpenAI', () => {
  requireOpenAIWebhookHeaders(
    new Headers({
      'webhook-id': 'wh_test',
      'webhook-timestamp': '1800000000',
      'webhook-signature': 'v1,test',
    }),
  )
})

Deno.test('rechaza un webhook directo sin firma antes de invocar el SDK', () => {
  assertThrows(
    () =>
      requireOpenAIWebhookHeaders(
        new Headers({
          'webhook-id': 'wh_test',
          'webhook-timestamp': '1800000000',
        }),
      ),
    InvalidOpenAIWebhookRequestError,
    'webhook-signature',
  )
})
