import { HttpError } from './utils.ts'

export type ReasoningEffort = 'auto' | 'none' | 'low' | 'medium' | 'high'

export function buildReasoningParam(
  model: string,
  effort?: ReasoningEffort | null,
): { effort: Exclude<ReasoningEffort, 'auto'> } | undefined {
  if (!effort || effort === 'auto') return undefined

  if (effort === 'none' && !supportsNoReasoning(model)) {
    throw new HttpError(
      422,
      'El nivel de razonamiento "Ninguno" solo está disponible para modelos GPT-5.1 o superiores. Elige Auto, Bajo, Medio o Alto.',
      'UNSUPPORTED_REASONING_EFFORT',
      { model, effort },
    )
  }

  return { effort }
}

export async function buildSafetyIdentifier(userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(userId)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 64)
}

function supportsNoReasoning(model: string): boolean {
  const normalized = model.toLowerCase()
  return normalized.includes('gpt-5.1') || normalized.includes('gpt-5-1')
}
