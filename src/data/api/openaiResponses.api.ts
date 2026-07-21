import { invokeEdge } from '../supabase/invokeEdge'

export type OpenAIResponseControlKind =
  | 'plan'
  | 'subject'
  | 'plan-chat'
  | 'subject-chat'

export type OpenAIResponseControlInput = {
  responseId: string
  kind: OpenAIResponseControlKind
  entityId: string
}

export type OpenAIResponseStatusResult = {
  responseId: string
  status: string
  applied: boolean
  resolution:
    | 'active'
    | 'applied'
    | 'already_applied'
    | 'claimed_elsewhere'
    | 'stale'
}

export type OpenAIResponseCancelResult = {
  responseId: string
  status: string
  deleted: boolean
  applied: boolean
  resolution: OpenAIResponseStatusResult['resolution']
}

export type OpenAICancellationOutcome =
  | 'cancelled'
  | 'finished'
  | 'pending'
  | 'stale'

export function resolverResultadoCancelacion(
  result: OpenAIResponseCancelResult,
): OpenAICancellationOutcome {
  if (
    result.resolution === 'active' ||
    result.resolution === 'claimed_elsewhere'
  ) {
    return 'pending'
  }
  if (result.resolution === 'stale') return 'stale'

  const cancelledStatus = ['cancelled', 'canceled'].includes(
    result.status.toLowerCase(),
  )
  if (cancelledStatus) return 'cancelled'

  return 'finished'
}

export function openai_response_status(input: OpenAIResponseControlInput) {
  return invokeEdge<OpenAIResponseStatusResult>(
    'openai-responses/status',
    input,
    {
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export function openai_response_cancel(input: OpenAIResponseControlInput) {
  return invokeEdge<OpenAIResponseCancelResult>(
    'openai-responses/cancel',
    input,
    {
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
