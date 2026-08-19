declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
}

export const OPENAI_WEBHOOK_PROJECT_REF_METADATA = 'supabase_project_ref'

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/

type BackgroundRequest = {
  background?: boolean | null
  metadata?: Record<string, string> | null
}

export function isSupabaseProjectRef(value: unknown): value is string {
  return typeof value === 'string' && PROJECT_REF_PATTERN.test(value)
}

export function projectRefFromSupabaseUrl(
  supabaseUrl: string | undefined,
): string | null {
  if (!supabaseUrl) return null

  try {
    const hostname = new URL(supabaseUrl).hostname.toLowerCase()
    const suffix = '.supabase.co'
    if (!hostname.endsWith(suffix)) return null

    const projectRef = hostname.slice(0, -suffix.length)
    return isSupabaseProjectRef(projectRef) ? projectRef : null
  } catch {
    return null
  }
}

/**
 * Identifica el proyecto Supabase que originó una Response background. El
 * router estable usa esta metadata para entregar el webhook a la misma branch.
 */
export function withOpenAIWebhookRouting<T extends BackgroundRequest>(
  request: T,
  supabaseUrl = Deno.env.get('SUPABASE_URL'),
): T {
  if (request.background !== true) return request

  const existing = request.metadata?.[OPENAI_WEBHOOK_PROJECT_REF_METADATA]
  if (existing !== undefined) {
    if (!isSupabaseProjectRef(existing)) {
      throw new Error('Invalid Supabase project ref in OpenAI metadata.')
    }
    return request
  }

  const projectRef = projectRefFromSupabaseUrl(supabaseUrl)
  if (!projectRef) return request

  return {
    ...request,
    metadata: {
      ...(request.metadata ?? {}),
      [OPENAI_WEBHOOK_PROJECT_REF_METADATA]: projectRef,
    },
  }
}
