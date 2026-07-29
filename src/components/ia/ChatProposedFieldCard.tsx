import {
  ArrowLeftRight,
  Check,
  Info,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { RichTextContent } from '@/components/editor/RichTextContent'
import { looksLikeHtml } from '@/components/editor/sanitize'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface ChatProposedFieldSuggestion {
  key: string
  label: string
  newValue: unknown
  previousValue?: unknown | null
  explanation?: string | null
  applied?: boolean
}

export interface ChatProposedFieldCardProps {
  suggestion: ChatProposedFieldSuggestion
  onApply: (suggestion: ChatProposedFieldSuggestion) => void | Promise<void>
  onReject?: (suggestion: ChatProposedFieldSuggestion) => void | Promise<void>
}

export function tryParseChatValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (
    !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
    !(trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return value
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function valueKind(
  value: unknown,
): 'string' | 'contenido' | 'criterios' | 'json' {
  const parsed = tryParseChatValue(value)
  if (Array.isArray(parsed)) {
    if (parsed[0] && typeof parsed[0] === 'object' && 'unidad' in parsed[0]) {
      return 'contenido'
    }
    if (parsed[0] && typeof parsed[0] === 'object' && 'criterio' in parsed[0]) {
      return 'criterios'
    }
    return 'json'
  }
  if (typeof parsed === 'object' && parsed !== null) return 'json'
  return 'string'
}

function CompactValuePreview({ value }: { value: unknown }) {
  const parsed = tryParseChatValue(value)
  const kind = valueKind(value)

  if (kind === 'contenido' && Array.isArray(parsed)) {
    return (
      <div className="space-y-2">
        {parsed.map((u: any, idx: number) => (
          <div key={idx}>
            <div className="text-primary mb-1 text-[11px] font-semibold">
              Unidad {u.unidad}: {u.titulo}
            </div>
            {Array.isArray(u.temas) && u.temas.length > 0 ? (
              <ul className="space-y-0.5">
                {u.temas.slice(0, 4).map((t: any, tidx: number) => (
                  <li key={tidx} className="text-muted-foreground text-xs">
                    • {t.nombre}
                    {typeof t.horasEstimadas === 'number' && (
                      <span className="text-muted-foreground/60 ml-1 text-[10px]">
                        ({t.horasEstimadas}h)
                      </span>
                    )}
                  </li>
                ))}
                {u.temas.length > 4 && (
                  <li className="text-muted-foreground/60 text-[10px]">
                    +{u.temas.length - 4} temas más
                  </li>
                )}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    )
  }

  if (kind === 'criterios' && Array.isArray(parsed)) {
    return (
      <div className="space-y-1.5">
        {parsed.map((c: any, idx: number) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-muted-foreground line-clamp-2">
              {c.criterio}
            </span>
            <span className="text-primary shrink-0 text-[10px] font-semibold">
              {c.porcentaje}%
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (kind === 'json') {
    return (
      <pre className="text-muted-foreground max-h-40 overflow-auto text-[10px] whitespace-pre-wrap">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    )
  }

  // Texto plano o HTML: los campos enriquecidos (p. ej. la descripción) llegan
  // como HTML (`<p><strong>…`), así que lo renderizamos con el mismo saneador y
  // tipografía que el resto del producto en lugar de mostrar las etiquetas.
  const text = String(parsed)
  if (looksLikeHtml(text)) {
    return <RichTextContent html={text} className="text-foreground text-sm" />
  }

  return (
    <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
      {text}
    </p>
  )
}

export function ChatProposedFieldCard({
  suggestion,
  onApply,
  onReject,
}: ChatProposedFieldCardProps) {
  const [isApplying, setIsApplying] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showingOriginal, setShowingOriginal] = useState(false)

  const parsedPrevious = tryParseChatValue(suggestion.previousValue)
  const parsedNew = tryParseChatValue(suggestion.newValue)
  const hasPrevious = !isEmptyValue(parsedPrevious)
  const isApplied = suggestion.applied === true
  // Sin valor original con el que comparar no hay nada que alternar: siempre
  // mostramos la propuesta.
  const viewingOriginal = hasPrevious && showingOriginal

  if (dismissed) return null

  const applyValue = async (value: unknown) => {
    setIsApplying(true)
    try {
      await onApply({ ...suggestion, newValue: value })
    } finally {
      setIsApplying(false)
    }
  }

  const handleReject = async () => {
    if (!onReject) {
      setDismissed(true)
      return
    }
    setIsRejecting(true)
    try {
      await onReject(suggestion)
      setDismissed(true)
    } finally {
      setIsRejecting(false)
    }
  }

  const busy = isApplying || isRejecting

  return (
    <div
      className={cn(
        'improvement-card border-border/50 bg-card/40 group flex flex-col gap-2 rounded-xl border-[0.5px] p-3 transition-colors',
        isApplied && 'opacity-70',
        isApplying && 'pointer-events-none opacity-70',
      )}
      role="group"
      aria-label={`Propuesta para ${suggestion.label}`}
      aria-busy={busy}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="bg-primary/10 text-primary max-w-full truncate rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
            {suggestion.label}
          </span>
          {suggestion.explanation ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Por qué se propone este cambio"
                  className="text-muted-foreground/70 hover:text-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors"
                >
                  <Info size={13} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-5">
                {suggestion.explanation}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        {isApplied ? (
          <span className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium">
            <Check size={13} />
            Aplicado
          </span>
        ) : (
          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void handleReject()}
                  aria-label="Descartar la propuesta"
                >
                  {isRejecting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <X size={14} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Descartar propuesta</TooltipContent>
            </Tooltip>
            {hasPrevious && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setShowingOriginal((prev) => !prev)}
                    aria-label={
                      viewingOriginal ? 'Ver propuesta' : 'Ver original'
                    }
                  >
                    <ArrowLeftRight size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {viewingOriginal ? 'Ver propuesta' : 'Ver original'}
                </TooltipContent>
              </Tooltip>
            )}

            {viewingOriginal ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void applyValue(suggestion.previousValue)}
                    aria-label="Restaurar el valor original"
                  >
                    {isApplying ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restaurar original</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    disabled={busy}
                    onClick={() => void applyValue(suggestion.newValue)}
                    aria-label="Aplicar la propuesta"
                  >
                    {isApplying ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Aplicar propuesta</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      <div>
        {hasPrevious && (
          <div className="text-muted-foreground/60 mb-1 text-[10px] font-semibold tracking-wider uppercase">
            {viewingOriginal ? 'Original' : 'Propuesta'}
          </div>
        )}
        <CompactValuePreview
          value={viewingOriginal ? parsedPrevious : parsedNew}
        />
      </div>
    </div>
  )
}
