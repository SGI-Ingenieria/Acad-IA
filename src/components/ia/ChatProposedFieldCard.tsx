import { Check, Loader2, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
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

  return (
    <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
      {String(parsed)}
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

  if (dismissed) return null

  const handleApply = async () => {
    setIsApplying(true)
    try {
      await onApply(suggestion)
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

  const parsedPrevious = tryParseChatValue(suggestion.previousValue)
  const parsedNew = tryParseChatValue(suggestion.newValue)
  const hasPrevious = !isEmptyValue(parsedPrevious)
  const isApplied = suggestion.applied === true

  return (
    <div
      className={cn(
        'improvement-card bg-card border-border/60 hover:border-border group rounded-xl border p-3 shadow-sm transition-colors',
        isApplied && 'border-primary/30 bg-primary/5 opacity-80',
        isApplying && 'pointer-events-none opacity-70',
      )}
      role="group"
      aria-label={`Propuesta para ${suggestion.label}`}
      aria-busy={isApplying || isRejecting}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary max-w-full truncate rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
              {suggestion.label}
            </span>
            {suggestion.explanation ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground cursor-help text-[10px] underline decoration-dotted">
                      Por qué
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {suggestion.explanation}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
        </div>

        {!isApplied && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              disabled={isApplying || isRejecting}
              className="h-7 px-3 text-xs font-semibold shadow-sm"
              onClick={handleApply}
              aria-label={`Aplicar propuesta para ${suggestion.label}`}
            >
              {isApplying ? (
                <Loader2 size={13} className="mr-1.5 animate-spin" />
              ) : (
                <Check size={13} className="mr-1.5" />
              )}
              {isApplying ? 'Aplicando...' : 'Aplicar'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isApplying || isRejecting}
              className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
              onClick={handleReject}
              aria-label={`Descartar propuesta para ${suggestion.label}`}
            >
              {isRejecting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <X size={13} />
              )}
            </Button>
          </div>
        )}

        {isApplied && (
          <div className="border-border bg-muted/50 text-primary flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
            <Check size={13} />
            Aplicado
          </div>
        )}
      </div>

      {suggestion.explanation && (
        <p className="text-muted-foreground mb-2 text-xs italic">
          {suggestion.explanation}
        </p>
      )}

      <div
        className={cn(
          'grid gap-2',
          hasPrevious ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {hasPrevious && (
          <div className="bg-muted/40 border-border/60 rounded-lg border border-dashed p-2.5">
            <div className="text-muted-foreground/70 mb-1 text-[10px] font-semibold tracking-wider uppercase">
              Actual
            </div>
            <div className="text-muted-foreground opacity-70">
              <CompactValuePreview value={parsedPrevious} />
            </div>
          </div>
        )}

        <div
          className={cn(
            'rounded-lg border p-2.5',
            isApplied
              ? 'border-primary/20 bg-primary/5'
              : 'border-border/60 bg-muted/20',
            hasPrevious ? '' : 'col-span-1',
          )}
        >
          <div className="text-muted-foreground/70 mb-1 text-[10px] font-semibold tracking-wider uppercase">
            Propuesta
          </div>
          <CompactValuePreview value={parsedNew} />
        </div>
      </div>
    </div>
  )
}
