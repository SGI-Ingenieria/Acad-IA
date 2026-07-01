import type { Json, Database } from '@/types/supabase'

import { supabaseBrowser } from '@/data/supabase/client'

type CrashSeverity = 'info' | 'warning' | 'error' | 'fatal'

type CrashReportInput = {
  error?: unknown
  message?: string
  componentStack?: string | null
  source: string
  severity?: CrashSeverity
  context?: Record<string, unknown>
}

const DEDUPE_WINDOW_MS = 30_000
const MAX_STRING_LENGTH = 8_000
const recentFingerprints = new Map<string, number>()

let installed = false
let reporting = false

export function installCrashReporter(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    reportFrontendCrash({
      error: event.error,
      message: event.message,
      source: 'window.error',
      severity: 'error',
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    reportFrontendCrash({
      error: event.reason,
      message: getErrorMessage(event.reason, 'Promesa rechazada sin manejar'),
      source: 'window.unhandledrejection',
      severity: 'error',
      context: {
        reason: toJsonSafe(event.reason),
      },
    })
  })
}

export function reportFrontendCrash(input: CrashReportInput): void {
  void sendCrashReport(input).catch((error: unknown) => {
    console.warn('No se pudo registrar el reporte de error.', error)
  })
}

async function sendCrashReport(input: CrashReportInput): Promise<void> {
  if (reporting) return

  const normalized = normalizeCrash(input)
  if (!shouldReport(normalized.fingerprint)) return

  reporting = true
  try {
    const supabase = supabaseBrowser()
    const userId = await getCurrentUserId()
    const payload: Database['public']['Tables']['crash_reports']['Insert'] = {
      usuario_id: userId,
      nombre: normalized.name,
      mensaje: normalized.message,
      stack: normalized.stack,
      component_stack: normalized.componentStack,
      origen: 'frontend',
      severidad: input.severity ?? 'error',
      url: normalized.url,
      ruta: normalized.route,
      user_agent: normalized.userAgent,
      app_version: normalized.appVersion,
      build_id: normalized.buildId,
      fingerprint: normalized.fingerprint,
      contexto: normalized.context,
    }

    const { error } = await supabase.from('crash_reports').insert(payload)
    if (error) {
      throw error
    }
  } finally {
    reporting = false
  }
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabaseBrowser().auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

function normalizeCrash(input: CrashReportInput) {
  const errorLike = getErrorLike(input.error)
  const message =
    limitString(
      input.message ?? errorLike.message ?? 'Error de frontend sin mensaje',
    ) ?? 'Error de frontend sin mensaje'
  const name = limitString(errorLike.name ?? 'FrontendError')
  const stack = limitString(errorLike.stack)
  const componentStack = limitString(input.componentStack ?? undefined)
  const route =
    typeof window === 'undefined'
      ? null
      : `${window.location.pathname}${window.location.search}`
  const url = typeof window === 'undefined' ? null : window.location.href
  const userAgent =
    typeof navigator === 'undefined' ? null : navigator.userAgent
  const appVersion = getOptionalEnv('VITE_APP_VERSION')
  const buildId = getOptionalEnv('VITE_BUILD_ID', 'VITE_COMMIT_SHA')
  const fingerprint = makeFingerprint([
    input.source,
    name,
    message,
    firstStackLine(stack),
    componentStack ? firstStackLine(componentStack) : null,
  ])

  return {
    name,
    message,
    stack,
    componentStack,
    url,
    route,
    userAgent,
    appVersion,
    buildId,
    fingerprint,
    context: toJsonSafe({
      source: input.source,
      ...input.context,
    }),
  }
}

function getErrorLike(error: unknown): {
  name?: string
  message?: string
  stack?: string
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (typeof error === 'object' && error !== null) {
    const value = error as Record<string, unknown>
    return {
      name: typeof value.name === 'string' ? value.name : undefined,
      message: typeof value.message === 'string' ? value.message : undefined,
      stack: typeof value.stack === 'string' ? value.stack : undefined,
    }
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  return {}
}

function getErrorMessage(error: unknown, fallback: string): string {
  return getErrorLike(error).message ?? fallback
}

function shouldReport(fingerprint: string): boolean {
  const now = Date.now()
  for (const [key, timestamp] of recentFingerprints) {
    if (now - timestamp > DEDUPE_WINDOW_MS) {
      recentFingerprints.delete(key)
    }
  }

  if (recentFingerprints.has(fingerprint)) return false

  recentFingerprints.set(fingerprint, now)
  return true
}

function makeFingerprint(parts: Array<string | null | undefined>): string {
  const source = parts.filter(Boolean).join('|')
  let hash = 0x811c9dc5

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(36)
}

function firstStackLine(stack?: string | null): string | null {
  return stack?.split('\n').find((line) => line.trim().length > 0) ?? null
}

function getOptionalEnv(...keys: Array<string>): string | null {
  const env =
    typeof import.meta !== 'undefined'
      ? ((import.meta as unknown as { env?: Record<string, unknown> }).env ??
        {})
      : {}

  for (const key of keys) {
    const value = env[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

function toJsonSafe(value: unknown, depth = 0): Json {
  if (value === null) return null
  if (typeof value === 'string') return limitString(value) ?? ''
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'undefined') return null
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'function') return '[function]'
  if (typeof value === 'symbol') return value.toString()
  if (depth >= 4) return '[max-depth]'

  if (value instanceof Error) {
    return {
      name: value.name,
      message: limitString(value.message) ?? '',
      stack: limitString(value.stack),
    }
  }

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => toJsonSafe(item, depth + 1))
  }

  if (typeof value === 'object') {
    const result: Record<string, Json> = {}
    for (const [key, nestedValue] of Object.entries(value).slice(0, 50)) {
      result[key] = toJsonSafe(nestedValue, depth + 1)
    }
    return result
  }

  return String(value)
}

function limitString(value?: string | null): string | null {
  if (!value) return null
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...`
    : value
}
