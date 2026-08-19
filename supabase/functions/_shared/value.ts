export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

export function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const item = asRecord(value)
  if (item) {
    return `{${Object.keys(item)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(item[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function slugifyAscii(
  value: string,
  fallback = 'paquete',
  maxLength = 60,
): string {
  const slug = value
    .normalize('NFD')
    .replace(/[^\x20-\x7e]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
  return slug || fallback
}

export function isExpiredTimestamp(
  createdAtIso: string | undefined | null,
  ttlMs: number,
  now = Date.now(),
): boolean {
  if (!createdAtIso) return true
  const createdAt = new Date(createdAtIso).getTime()
  return Number.isNaN(createdAt) || now - createdAt > ttlMs
}
