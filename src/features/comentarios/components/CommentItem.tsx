import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Building2,
  Check,
  CornerUpLeft,
  Reply,
  UserRoundSearch,
} from 'lucide-react'

import { CommentAttachments } from './CommentAttachments'
import { SelectionQuote } from './SelectionQuote'

import type { ComentarioPlan } from '@/data/types/domain'

import { sanitizeHtml } from '@/components/editor/sanitize'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { animateControlIcon } from '@/lib/animations'

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function formatTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es })
}

export function CommentItem({
  comment,
  onReply,
  isReadOnly,
  resuelto,
  onToggleResuelto,
  replyToName = null,
  phaseNote = null,
}: {
  comment: ComentarioPlan
  onReply: () => void
  isReadOnly: boolean
  resuelto: boolean
  onToggleResuelto: () => void
  /** Nombre del autor al que responde este comentario, si aplica. */
  replyToName?: string | null
  /** Fase propia cuando difiere de la fase que agrupa al hilo. */
  phaseNote?: string | null
}) {
  const referencia = comment.referencia as
    | {
        textoSeleccionado?: string
        contenedor?: string
        from?: number
        until?: number
      }
    | undefined

  return (
    <div
      className={`group flex gap-3 ${resuelto ? 'opacity-70' : ''}`}
      data-comment-id={comment.id}
    >
      <Avatar size="sm">
        <AvatarFallback>
          {getInitials(comment.autor?.nombre_completo)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">
            {comment.autor?.nombre_completo ?? 'Usuario'}
          </span>
          {comment.categoria !== 'INTERNO' && (
            <Tooltip>
              <TooltipTrigger
                className="text-muted-foreground inline-flex"
                aria-label={
                  comment.categoria === 'EXPERTO'
                    ? 'Comentario de experto'
                    : 'Comentario de sede'
                }
              >
                {comment.categoria === 'EXPERTO' ? (
                  <UserRoundSearch className="size-3.5" />
                ) : (
                  <Building2 className="size-3.5" />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {comment.categoria === 'EXPERTO' ? 'Experto' : 'Sede'}
              </TooltipContent>
            </Tooltip>
          )}
          {resuelto && (
            <Tooltip>
              <TooltipTrigger
                className="inline-flex text-emerald-600 dark:text-emerald-400"
                aria-label="Comentario resuelto"
              >
                <Check className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Resuelto</TooltipContent>
            </Tooltip>
          )}
          <span className="text-muted-foreground ml-auto text-xs">
            {formatTime(comment.creado_en)}
          </span>
        </div>

        {replyToName && (
          <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
            <CornerUpLeft className="h-3 w-3 shrink-0" />
            <span className="truncate">
              En respuesta a{' '}
              <span className="text-foreground/90 font-medium">
                {replyToName}
              </span>
            </span>
          </div>
        )}

        {phaseNote && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            Registrado en {phaseNote}
          </p>
        )}

        {referencia?.textoSeleccionado && (
          <SelectionQuote referencia={referencia} />
        )}

        <div
          className="text-foreground mt-1 text-sm leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment.cuerpo) }}
        />

        {comment.adjuntos && comment.adjuntos.length > 0 && (
          <CommentAttachments adjuntos={comment.adjuntos} />
        )}

        {!isReadOnly && (
          <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-motion-control
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Responder"
                  onClick={onReply}
                  onPointerEnter={(event) =>
                    animateControlIcon(event.currentTarget, true)
                  }
                  onPointerLeave={(event) =>
                    animateControlIcon(event.currentTarget, false)
                  }
                  onFocus={(event) =>
                    animateControlIcon(event.currentTarget, true)
                  }
                  onBlur={(event) =>
                    animateControlIcon(event.currentTarget, false)
                  }
                >
                  <Reply data-motion-icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Responder</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-motion-control
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={
                    resuelto ? 'Marcar no resuelto' : 'Marcar resuelto'
                  }
                  onClick={onToggleResuelto}
                  onPointerEnter={(event) =>
                    animateControlIcon(event.currentTarget, true)
                  }
                  onPointerLeave={(event) =>
                    animateControlIcon(event.currentTarget, false)
                  }
                  onFocus={(event) =>
                    animateControlIcon(event.currentTarget, true)
                  }
                  onBlur={(event) =>
                    animateControlIcon(event.currentTarget, false)
                  }
                >
                  <Check
                    data-motion-icon
                    className={`h-3.5 w-3.5 ${resuelto ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {resuelto ? 'Marcar no resuelto' : 'Marcar resuelto'}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
