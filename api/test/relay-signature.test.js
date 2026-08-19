import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { it } from 'node:test'

import {
  createWebhookRelaySigner,
  webhookRelayPayload,
} from '../src/lib/relay-signature.js'

it('firma el contrato canónico con ECDSA P-256', async () => {
  const keyPair = await webcrypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  const privateKey = Buffer.from(
    await webcrypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  ).toString('base64')
  const args = {
    timestamp: '1800000000',
    projectRef: 'abcdefghijklmnopqrst',
    webhookId: 'wh_123',
    rawBody:
      '{"id":"evt_123","type":"response.completed","data":{"id":"resp_123"}}',
  }

  const sign = await createWebhookRelaySigner(privateKey)
  const signatureHeader = await sign(args)
  const signature = Buffer.from(signatureHeader.slice(3), 'base64url')
  const verified = await webcrypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.publicKey,
    signature,
    new TextEncoder().encode(webhookRelayPayload(args)),
  )

  assert.equal(signatureHeader.startsWith('v1,'), true)
  assert.equal(verified, true)
})
