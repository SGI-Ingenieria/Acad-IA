import { CornerDownLeft, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { ComentarioReferencia } from '@/data/types/domain'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function buildInitialHtml(quote: ComentarioReferencia | null): string {
  if (!quote?.textoSeleccionado) return ''
  const lines = quote.textoSeleccionado.split('\n')
  const escaped = lines
    .map((line) =>
      line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    )
    .join('<br>')
  return `<blockquote data-comment-quote="true">${escaped}</blockquote><p><br></p>`
}

export function CommentComposer({
  initialQuote,
  onSubmit,
  isSubmitting,
  disabled,
  placeholder = 'Escribe un comentario…',
  submitLabel = 'Comentar',
}: {
  initialQuote: ComentarioReferencia | null
  onSubmit: (html: string) => void
  isSubmitting: boolean
  disabled?: boolean
  placeholder?: string
  submitLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = buildInitialHtml(initialQuote)
    // Reflejar si el quote inicial ya trae contenido para que el placeholder no
    // se dibuje encima de la cita.
    setHasContent(ref.current.innerText.trim().length > 0)
    ref.current.focus()
  }, [initialQuote])

  const handleInput = () => {
    if (!ref.current) return
    const text = ref.current.innerText
    setHasContent(text.trim().length > 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (ref.current && !disabled && !isSubmitting) {
        const html = ref.current.innerHTML.trim()
        if (hasContent) {
          onSubmit(html)
          ref.current.innerHTML = ''
          setHasContent(false)
        }
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  return (
    <div className="border-border bg-background mt-3 rounded-xl border p-2">
      <div className="relative">
        {!hasContent && (
          <div className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 text-sm">
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          contentEditable={!disabled}
          suppressContentEditableWarning
          tabIndex={0}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className={cn(
            'max-h-40 min-h-[72px] overflow-y-auto px-3 py-2 text-sm leading-6',
            'break-words whitespace-pre-wrap outline-none',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        />
      </div>
      <div className="flex items-center justify-between border-t px-1 pt-2">
        <span className="text-muted-foreground hidden text-[11px] sm:inline">
          Enter para enviar · Shift + Enter para salto
        </span>
        <Button
          size="sm"
          disabled={disabled || isSubmitting || !hasContent}
          onClick={() => {
            if (!ref.current || disabled || isSubmitting) return
            onSubmit(ref.current.innerHTML.trim())
            ref.current.innerHTML = ''
            setHasContent(false)
          }}
          className="ml-auto"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CornerDownLeft className="mr-2 h-4 w-4" />
          )}
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
