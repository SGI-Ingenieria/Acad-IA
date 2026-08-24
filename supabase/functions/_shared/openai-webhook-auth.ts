const REQUIRED_OPENAI_WEBHOOK_HEADERS = [
  'webhook-id',
  'webhook-timestamp',
  'webhook-signature',
] as const

export class InvalidOpenAIWebhookRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidOpenAIWebhookRequestError'
  }
}

export function requireOpenAIWebhookHeaders(headers: Headers): void {
  const missingHeader = REQUIRED_OPENAI_WEBHOOK_HEADERS.find(
    (name) => !headers.get(name)?.trim(),
  )
  if (missingHeader) {
    throw new InvalidOpenAIWebhookRequestError(
      `Missing required OpenAI webhook header: ${missingHeader}`,
    )
  }
}
