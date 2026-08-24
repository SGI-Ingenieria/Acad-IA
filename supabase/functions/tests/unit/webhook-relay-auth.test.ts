import { assertRejects } from 'jsr:@std/assert@1'

import {
  RELAY_PROJECT_REF_HEADER,
  RELAY_SIGNATURE_HEADER,
  RELAY_TIMESTAMP_HEADER,
  RELAY_WEBHOOK_ID_HEADER,
  verifyWebhookRelay,
  webhookRelayPayload,
} from '../../_shared/webhook-relay-auth.ts'

const PROJECT_REF = 'abcdefghijklmnopqrst'
const RAW_BODY =
  '{"id":"evt_123","type":"response.completed","data":{"id":"resp_123"}}'

function encodeBase64Url(value: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(value))
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

Deno.test(
  'verifica el relay asimétrico y liga la firma a branch, id y cuerpo',
  async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign', 'verify'],
    )
    const timestamp = '1800000000'
    const webhookId = 'wh_123'
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      new TextEncoder().encode(
        webhookRelayPayload({
          timestamp,
          projectRef: PROJECT_REF,
          webhookId,
          rawBody: RAW_BODY,
        }),
      ),
    )
    const headers = new Headers({
      [RELAY_SIGNATURE_HEADER]: `v1,${encodeBase64Url(signature)}`,
      [RELAY_TIMESTAMP_HEADER]: timestamp,
      [RELAY_PROJECT_REF_HEADER]: PROJECT_REF,
      [RELAY_WEBHOOK_ID_HEADER]: webhookId,
    })

    await verifyWebhookRelay({
      rawBody: RAW_BODY,
      headers,
      supabaseUrl: `https://${PROJECT_REF}.supabase.co`,
      now: 1_800_000_000_000,
      publicKey: keyPair.publicKey,
    })

    await assertRejects(
      () =>
        verifyWebhookRelay({
          rawBody: `${RAW_BODY} `,
          headers,
          supabaseUrl: `https://${PROJECT_REF}.supabase.co`,
          now: 1_800_000_000_000,
          publicKey: keyPair.publicKey,
        }),
      Error,
      'Invalid webhook relay signature',
    )
  },
)
