import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, CornerUpLeft, Reply } from 'lucide-react'

import { SelectionQuote } from './SelectionQuote'

import type { ComentarioPlan, EstadoPlanRow } from '@/data/types/domain'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
  estadosById,
  onReply,
  isReadOnly,
  resuelto,
  onToggleResuelto,
  replyToName = null,
}: {
  comment: ComentarioPlan
  estadosById: Map<string, EstadoPlanRow>
  onReply: () => void
  isReadOnly: boolean
  resuelto: boolean
  onToggleResuelto: () => void
  /** Nombre del autor al que responde este comentario, si aplica. */
  replyToName?: string | null
}) {
  const fase = comment.estado_id ? estadosById.get(comment.estado_id) : null
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
            <Badge variant="outline" className="text-[10px]">
              {comment.categoria === 'EXPERTO' ? 'Experto' : 'Sede'}
            </Badge>
          )}
          {fase && (
            <Badge variant="secondary" className="text-[10px]">
              {fase.etiqueta}
            </Badge>
          )}
          {resuelto && (
            <Badge
              variant="outline"
              className="border-emerald-500/30 text-[10px] text-emerald-700 dark:text-emerald-300"
            >
              <Check className="h-3 w-3" />
            </Badge>
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

        {referencia?.textoSeleccionado && (
          <SelectionQuote referencia={referencia} />
        )}

        <div
          className="text-foreground mt-1 text-sm leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: comment.cuerpo }}
        />

        {!isReadOnly && (
          <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Responder"
                  onClick={onReply}
                >
                  <Reply className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Responder</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={
                    resuelto ? 'Marcar no resuelto' : 'Marcar resuelto'
                  }
                  onClick={onToggleResuelto}
                >
                  <Check
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
