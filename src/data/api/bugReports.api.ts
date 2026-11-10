import { invokeEdge } from '../supabase/invokeEdge'

export const BUG_REPORT_MAX_ATTACHMENTS = 5
export const BUG_REPORT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const BUG_REPORT_ALLOWED_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

export type BugReportAttachmentInput = {
  file: File
}

export type BugReportDraft = {
  summary: string
  description: string
  steps: string
  expected: string
  url: string
  userAgent: string
  viewport: string
  attachments: Array<BugReportAttachmentInput>
}

export type CreateBugReportResponse = {
  issueUrl: string
  issueNumber: number
  issueTitle: string
}

export function validateBugReportAttachment(file: File): string | null {
  if (
    !BUG_REPORT_ALLOWED_ATTACHMENT_TYPES.includes(
      file.type as (typeof BUG_REPORT_ALLOWED_ATTACHMENT_TYPES)[number],
    )
  ) {
    return 'Solo se aceptan imágenes PNG, JPG, WEBP o GIF.'
  }
  if (file.size > BUG_REPORT_MAX_ATTACHMENT_BYTES) {
    return 'Cada adjunto debe pesar como máximo 10 MB.'
  }
  return null
}

export function createBugReport(
  input: Omit<BugReportDraft, 'attachments'> & {
    attachments: Array<BugReportAttachmentInput>
  },
) {
  const form = new FormData()
  form.set('summary', input.summary)
  form.set('description', input.description)
  form.set('steps', input.steps)
  form.set('expected', input.expected)
  form.set('url', input.url)
  form.set('userAgent', input.userAgent)
  form.set('viewport', input.viewport)
  for (const attachment of input.attachments) {
    form.append('attachments', attachment.file, attachment.file.name)
  }
  return invokeEdge<CreateBugReportResponse>('create-bug-report', form)
}
