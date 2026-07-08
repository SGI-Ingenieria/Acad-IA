import type { Session } from '@supabase/supabase-js'

import { supabaseBrowserWithHeaders } from '@/data/supabase/client'
import { invokeEdge } from '@/data/supabase/invokeEdge'

export type HealthStatus = 'ok' | 'warning' | 'error'

export type EdgeFunctionProbe = {
  name: string
  status: HealthStatus
  httpStatus?: number
  latencyMs?: number
  errorKind?: string
  message?: string
}

export type PublicConnectivityStatus = {
  ok: boolean
  status: HealthStatus
  checkedAt: string
  supabase: {
    status: HealthStatus
    latencyMs?: number
    serverTime?: string | null
    message?: string
  }
  edgeFunctions: {
    status: HealthStatus
    ok: number
    warning: number
    error: number
    total: number
    items: Array<EdgeFunctionProbe>
  }
}

export type SessionGateResult = PublicConnectivityStatus & {
  allowed: boolean
  authToken: {
    status: HealthStatus
    present: boolean
    valid: boolean
    latencyMs?: number
    userId?: string | null
    message?: string
  }
  message?: string
}

export type ObservabilitySnapshot = PublicConnectivityStatus & {
  serviceEnv: Array<{ name: string; present: boolean }>
  authToken: {
    status: HealthStatus
    present: boolean
    valid: boolean
    latencyMs?: number
    userId?: string | null
    message?: string
  }
  openai: {
    status: HealthStatus
    env: {
      apiKey: boolean
      projectId: boolean
      webhookSecret: boolean
      organizationId: boolean
      healthcheckModel: string
    }
    latencyMs: number | null
    keyValid: boolean
    identity: {
      status: HealthStatus
      latencyMs: number | null
      valid: boolean
      message?: string
    }
    models: {
      status: HealthStatus
      latencyMs: number | null
      reachable: boolean
      message?: string
    }
    projectContextValid: boolean
    connectivityValid: boolean
    webhookUrl: string | null
    message?: string
  }
  migrations: {
    status: HealthStatus
    applied: Array<string>
    expected: Array<string>
    missing: Array<string>
    extra: Array<string>
    latestApplied: string | null
    latestExpected: string | null
    github: {
      configured: boolean
      status: HealthStatus
      ref: string
      path: string
      message?: string
    }
  }
  webhooks: {
    status: HealthStatus
    message?: string
    directUrl: string | null
    events: Array<WebhookEventRecord>
    testRuns: Array<TestRunRecord>
  }
}

export type WebhookEventRecord = {
  id: string
  event_id: string
  event_type: string
  openai_response_id: string | null
  test_run_id: string | null
  received_at: string
  signature_valid: boolean
  processing_status: 'received' | 'processed' | 'ignored' | 'failed'
  processing_error: string | null
}

export type TestRunRecord = {
  id: string
  tipo: 'openai_foreground' | 'openai_background' | 'webhook_manual'
  estado: 'pending' | 'running' | 'completed' | 'failed' | 'unknown'
  openai_response_id: string | null
  started_at: string
  completed_at: string | null
  latency_ms: number | null
  error_code: string | null
  error_message: string | null
  metadata: Record<string, unknown>
}

export type OpenAITestResult = {
  ok: boolean
  checkedAt: string
  testRun: {
    id: string
    status: string
    responseId?: string
    latencyMs?: number
    outputText?: string
  }
}

export async function getPublicConnectivityStatus() {
  return invokeEdge<PublicConnectivityStatus>(
    'observability-health/public-status',
    {},
  )
}

export async function runSessionGate(session: Session) {
  const client = supabaseBrowserWithHeaders({
    Authorization: `Bearer ${session.access_token}`,
  })

  return invokeEdge<SessionGateResult>(
    'observability-health/session-gate',
    {},
    {},
    client,
  )
}

export async function getObservabilitySnapshot() {
  return invokeEdge<ObservabilitySnapshot>('observability-health/snapshot', {})
}

export async function runOpenAIForegroundTest() {
  return invokeEdge<OpenAITestResult>(
    'observability-health/openai-foreground-test',
    {},
  )
}

export async function runOpenAIBackgroundTest() {
  return invokeEdge<OpenAITestResult>(
    'observability-health/openai-background-test',
    {},
  )
}

export type ClearRecentScope = 'test_runs' | 'webhook_events' | 'all'

export type ClearRecentResult = {
  ok: boolean
  checkedAt: string
  scope: ClearRecentScope
  cleared: Array<string>
}

export async function clearRecentObservability(scope: ClearRecentScope) {
  return invokeEdge<ClearRecentResult>('observability-health/clear-recent', {
    scope,
  })
}
