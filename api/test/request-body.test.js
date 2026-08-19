import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readWebhookBody } from '../src/lib/request-body.js'

describe('Azure webhook request body', () => {
  it('decodifica exactamente el JSON UTF-8 usado para verificar la firma', async () => {
    const rawBody = '{"message":"Webhook de Acadia 🎓"}'
    const request = {
      arrayBuffer: async () => new TextEncoder().encode(rawBody).buffer,
    }

    assert.equal(await readWebhookBody(request), rawBody)
  })

  it('rechaza objetos que no sean HttpRequest de Azure', async () => {
    await assert.rejects(() => readWebhookBody({}), TypeError)
  })
})
