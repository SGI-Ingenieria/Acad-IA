import { webcrypto } from 'node:crypto'

const cryptoApi = globalThis.crypto ?? webcrypto

function decodeBase64(value) {
  return Uint8Array.from(Buffer.from(value, 'base64'))
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url')
}

export function webhookRelayPayload(args) {
  return [
    'v1',
    args.timestamp,
    args.projectRef,
    args.webhookId,
    args.rawBody,
  ].join('\n')
}

export async function createWebhookRelaySigner(privateKeyBase64) {
  const privateKey = await cryptoApi.subtle.importKey(
    'pkcs8',
    decodeBase64(privateKeyBase64),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  return async (args) => {
    const signature = await cryptoApi.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(webhookRelayPayload(args)),
    )
    return `v1,${encodeBase64Url(signature)}`
  }
}
