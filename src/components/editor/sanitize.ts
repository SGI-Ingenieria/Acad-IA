import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
]

const ALLOWED_ATTR = ['href', 'target', 'rel', 'style']

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

export function sanitizeHtml(html: string | null | undefined): string {
  const cleaned = DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })

  if (typeof window === 'undefined' || !cleaned) return cleaned

  const doc = new DOMParser().parseFromString(cleaned, 'text/html')
  for (const link of doc.querySelectorAll('a')) {
    const href = link.getAttribute('href') ?? ''
    if (/^\s*javascript:/i.test(href)) {
      link.removeAttribute('href')
      continue
    }
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  }

  return doc.body.innerHTML
}

export function htmlFromPossiblyPlainText(value: unknown): string {
  const text =
    typeof value === 'string' ? value : value == null ? '' : String(value)
  if (!text.trim()) return '<p></p>'
  if (looksLikeHtml(text)) return sanitizeHtml(text)

  return sanitizeHtml(
    text
      .split(/\n{2,}/)
      .map(
        (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
      )
      .join(''),
  )
}

export function isEmptyRichText(html: string) {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()

  return text.length === 0
}
