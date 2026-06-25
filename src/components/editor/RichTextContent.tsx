import { sanitizeHtml } from './sanitize'

import './richtext-editor.css'

import { cn } from '@/lib/utils'

export function RichTextContent({
  html,
  className,
}: {
  html: string
  className?: string
}) {
  return (
    <div
      className={cn('richtext-content text-sm', className)}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  )
}
