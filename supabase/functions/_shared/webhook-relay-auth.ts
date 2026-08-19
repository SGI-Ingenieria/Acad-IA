import {
  isSupabaseProjectRef,
  projectRefFromSupabaseUrl,
} from './openai-webhook-routing.ts'

export const RELAY_SIGNATURE_HEADER = 'x-acad-ia-relay-signature'
export const RELAY_TIMESTAMP_HEADER = 'x-acad-ia-relay-timestamp'
export const RELAY_PROJECT_REF_HEADER = 'x-acad-ia-project-ref'
export const RELAY_WEBHOOK_ID_HEADER = 'x-acad-ia-webhook-id'

const RELAY_PUBLIC_KEY =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEf9x+jgxS18wAb0dxtU3ZK803tk5Xl3fvV9vyeBU+hNEAudSyp6ieGKpQ3gudBxMH3PD2bxEXSr/XaWT5px2PEA=='
const MAX_CLOCK_SKEW_SECONDS = 300

let publicKeyPromise: Promise<CryptoKey> | null = null

export class InvalidWebhookRelayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidWebhookRelayError'
  }
}

function decodeBase64(value: string): Uint8Array {
  const decoded = atob(value)
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  return decodeBase64(`${normalized}${padding}`)
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength)
  new Uint8Array(buffer).set(value)
  return buffer
}

function importPublicKey(): Promise<CryptoKey> {
  publicKeyPromise ??= crypto.subtle.importKey(
    'spki',
    toArrayBuffer(decodeBase64(RELAY_PUBLIC_KEY)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
  return publicKeyPromise
}

export function hasWebhookRelayHeaders(headers: Headers): boolean {
  return [
    RELAY_SIGNATURE_HEADER,
    RELAY_TIMESTAMP_HEADER,
    RELAY_PROJECT_REF_HEADER,
    RELAY_WEBHOOK_ID_HEADER,
  ].some((header) => headers.has(header))
}

export function webhookRelayPayload(args: {
  timestamp: string
  projectRef: string
  webhookId: string
  rawBody: string
}): string {
  return [
    'v1',
    args.timestamp,
    args.projectRef,
    args.webhookId,
    args.rawBody,
  ].join('\n')
}

export async function verifyWebhookRelay(args: {
  rawBody: string
  headers: Headers
  supabaseUrl: string | undefined
  now?: number
  publicKey?: CryptoKey
}): Promise<void> {
  const signatureHeader = args.headers.get(RELAY_SIGNATURE_HEADER)
  const timestamp = args.headers.get(RELAY_TIMESTAMP_HEADER)
  const projectRef = args.headers.get(RELAY_PROJECT_REF_HEADER)
  const webhookId = args.headers.get(RELAY_WEBHOOK_ID_HEADER)

  if (!signatureHeader || !timestamp || !projectRef || !webhookId) {
    throw new InvalidWebhookRelayError('Incomplete webhook relay headers.')
  }
  if (!signatureHeader.startsWith('v1,')) {
    throw new InvalidWebhookRelayError('Unsupported webhook relay signature.')
  }
  if (!isSupabaseProjectRef(projectRef)) {
    throw new InvalidWebhookRelayError('Invalid webhook relay project ref.')
  }

  const expectedProjectRef = projectRefFromSupabaseUrl(args.supabaseUrl)
  if (!expectedProjectRef || expectedProjectRef !== projectRef) {
    throw new InvalidWebhookRelayError(
      'Webhook relay target does not match this Supabase project.',
    )
  }

  const timestampSeconds = Number(timestamp)
  const nowSeconds = Math.floor((args.now ?? Date.now()) / 1000)
  if (
    !Number.isInteger(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS
  ) {
    throw new InvalidWebhookRelayError('Expired webhook relay signature.')
  }

  let signature: Uint8Array
  try {
    signature = decodeBase64Url(signatureHeader.slice(3))
  } catch {
    throw new InvalidWebhookRelayError('Malformed webhook relay signature.')
  }

  const verified = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    args.publicKey ?? (await importPublicKey()),
    toArrayBuffer(signature),
    toArrayBuffer(
      new TextEncoder().encode(
        webhookRelayPayload({
          timestamp,
          projectRef,
          webhookId,
          rawBody: args.rawBody,
        }),
      ),
    ),
  )

  if (!verified) {
    throw new InvalidWebhookRelayError('Invalid webhook relay signature.')
  }
}
