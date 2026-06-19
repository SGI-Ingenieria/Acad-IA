import { invokeEdge } from '../supabase/invokeEdge'

export type OpenAIResponseControlKind = 'plan' | 'subject'

export type OpenAIResponseControlInput = {
  responseId: string
  kind: OpenAIResponseControlKind
  entityId: string
}

export type OpenAIResponseStatusResult = {
  responseId: string
  status: string
  applied: boolean
}

export type OpenAIResponseCancelResult = {
  responseId: string
  status: string
  deleted: boolean
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
