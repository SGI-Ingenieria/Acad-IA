const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const OPENAI_ID_PATTERN =
  /^(file|vs|vec|resp|conv|msg|thread|asst)_[A-Za-z0-9_-]{8,}$/

const UUID_PREFIX_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i

export function isLikelyTechnicalId(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const text = value.trim()
  return UUID_PATTERN.test(text) || OPENAI_ID_PATTERN.test(text)
}

export function getBasename(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts.length ? (parts.at(-1) ?? path) : path
}

export function stripUuidPrefix(value: string): string {
  return value.replace(UUID_PREFIX_PATTERN, '')
}

export function formatFileDisplayName(path?: string | null): string {
  if (!path) return 'Archivo sin nombre'
  const cleaned = stripUuidPrefix(getBasename(path)).trim()
  if (!cleaned || isLikelyTechnicalId(cleaned)) return 'Archivo sin nombre'
  return cleaned
}

export function safeHumanText(value: unknown, fallback = 'Sin nombre'): string {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  if (!text || isLikelyTechnicalId(text)) return fallback
  return text
}

export function fallbackSequenceLabel(label: string, index: number): string {
  return `${label} ${index + 1}`
}
