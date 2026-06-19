/**
 * Extrae iniciales de un nombre completo.
 * Ej: "Carlos Núñez" → "CN"
 * Ej: "María Elena García" → "MG"
 * Ej: "Pedro" → "P"
 */
export function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return '?'

  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  const first = parts[0][0].toUpperCase()
  const last = parts[parts.length - 1][0].toUpperCase()
  return `${first}${last}`
}
