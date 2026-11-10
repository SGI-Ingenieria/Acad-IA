export function normalizeBugReportText(value: unknown, max = 12_000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export const BUG_REPORT_MAX_ATTACHMENTS = 5
export const BUG_REPORT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const BUG_REPORT_ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

export function validateBugReportAttachment(file: File) {
  if (!BUG_REPORT_ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    return 'Solo se aceptan imágenes PNG, JPG, WEBP o GIF.'
  }
  if (file.size > BUG_REPORT_MAX_ATTACHMENT_BYTES) {
    return 'Cada imagen debe pesar como máximo 10 MB.'
  }
  return null
}
