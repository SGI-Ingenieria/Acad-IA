import { MessageSquare, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { CommentComposer } from './CommentComposer'
import { CommentThread } from './CommentThread'

import type { EstadoPlanRow, UUID } from '@/data/types/domain'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEstadosPlan } from '@/data/hooks/useMeta'
import {
  useCrearComentarioPlan,
  useComentariosPlan,
  useToggleResueltoComentarioPlan,
} from '@/data/hooks/useWorkflow'
import { useCommentsRead } from '@/features/comentarios/hooks/useCommentsRead'
import {
  isRootComment,
  threadMemberIds,
} from '@/features/comentarios/lib/threads'
import { usePlanComments } from '@/features/comentarios/PlanCommentsContext'
import { cn } from '@/lib/utils'

export function CommentsDrawer({
  planId,
  asignaturaId,
  estadoActualId,
  isReadOnly,
}: {
  planId: UUID
  asignaturaId?: UUID | null
  estadoActualId?: UUID | null
  isReadOnly: boolean
}) {
  const {
    close,
    selectedPhaseId,
    setSelectedPhaseId,
    pendingQuote,
    clearPendingQuote,
  } = usePlanComments()
  const [replyingToId, setReplyingToId] = useState<string | null>(null)

  // El header es sticky (z-50); medimos su altura para colgar el panel justo
  // debajo y que su propia cabecera —y la X para cerrar— nunca queden tapadas.
  const [topOffset, setTopOffset] = useState(0)
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return
    const update = () => setTopOffset(header.getBoundingClientRect().height)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  const { data: comentarios } = useComentariosPlan(planId, asignaturaId)
  const { data: estados } = useEstadosPlan()
  const crear = useCrearComentarioPlan()
  const toggleResuelto = useToggleResueltoComentarioPlan()

  // El panel solo se monta cuando está abierto, así que al verlo (y al llegar
  // mensajes nuevos mientras está abierto) marcamos todo como leído.
  const { markAllRead } = useCommentsRead(planId, asignaturaId)
  useEffect(() => {
    if (comentarios) markAllRead(comentarios)
  }, [comentarios, markAllRead])

  const estadosById = useMemo(() => {
    const map = new Map<string, EstadoPlanRow>()
    for (const e of estados ?? []) map.set(e.id, e)
    return map
  }, [estados])

  const fasesConComentarios = useMemo(() => {
    const ids = new Set<string>()
    for (const c of comentarios ?? []) {
      if (c.estado_id) ids.add(c.estado_id)
    }
    return ids
  }, [comentarios])

  const comentariosFiltrados = useMemo(() => {
    if (!comentarios) return []
    if (!selectedPhaseId) return comentarios
    return comentarios.filter((c) => c.estado_id === selectedPhaseId)
  }, [comentarios, selectedPhaseId])

  const handleSubmit = async (html: string) => {
    await crear.mutateAsync({
      planId,
      asignaturaId: asignaturaId ?? null,
      estadoId: isReadOnly ? null : (estadoActualId ?? null),
      cuerpo: html,
      referencia: pendingQuote,
    })
    clearPendingQuote()
  }

  const handleReply = async (parentId: string | null, html: string) => {
    await crear.mutateAsync({
      planId,
      asignaturaId: asignaturaId ?? null,
      estadoId: isReadOnly ? null : (estadoActualId ?? null),
      cuerpo: html,
      comentarioPadreId: parentId,
    })
  }

  const handleToggleResuelto = (id: string) => {
    if (isReadOnly) return
    const all = comentarios ?? []
    const comment = all.find((c) => c.id === id)
    if (!comment) return

    // Resolver una raíz resuelve todo su hilo; una respuesta solo a sí misma.
    const byId = new Map(all.map((c) => [c.id, c]))
    const ids = isRootComment(comment, byId) ? threadMemberIds(all, id) : [id]

    toggleResuelto.mutate({
      ids,
      resuelto: !comment.resuelto,
      planId,
      asignaturaId,
    })
  }

  return (
    <div
      className={cn(
        'bg-background border-border fixed right-0 z-40 flex w-full flex-col overflow-hidden border-l shadow-2xl',
        'sm:w-105',
      )}
      style={{
        top: topOffset,
        bottom: 0,
      }}
      aria-label="Panel de comentarios"
    >
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-primary h-5 w-5" />
          <h2 className="text-base font-semibold">Comentarios</h2>
          <Badge variant="secondary" className="text-xs">
            {comentariosFiltrados.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={close}
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Filtro de fase */}
      <div className="border-b px-4 py-2">
        <Select
          value={selectedPhaseId ?? 'TODAS'}
          onValueChange={(value) =>
            setSelectedPhaseId(value === 'TODAS' ? null : value)
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Todas las fases" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas las fases</SelectItem>
            {(estados ?? [])
              .filter(
                (e) => fasesConComentarios.has(e.id) || e.id === estadoActualId,
              )
              .sort((a, b) => a.orden - b.orden)
              .map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.etiqueta}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <ScrollArea className="min-h-0 flex-1 px-4 py-4">
        {comentariosFiltrados.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-center text-sm">
            <MessageSquare className="h-8 w-8 opacity-30" />
            <p>Aún no hay comentarios en este apartado.</p>
            {!isReadOnly && (
              <p>Selecciona texto para comentar o escribe uno nuevo.</p>
            )}
          </div>
        ) : (
          <CommentThread
            comments={comentariosFiltrados}
            estadosById={estadosById}
            isReadOnly={isReadOnly}
            onReply={handleReply}
            onToggleResuelto={handleToggleResuelto}
            replyingToId={replyingToId}
            setReplyingToId={setReplyingToId}
          />
        )}
      </ScrollArea>

      {/* Composer */}
      {!isReadOnly && (
        <div className="border-t px-4 pt-3 pb-4">
          <CommentComposer
            initialQuote={pendingQuote}
            onSubmit={handleSubmit}
            isSubmitting={crear.isPending}
            placeholder="Escribe un comentario…"
          />
        </div>
      )}

      {isReadOnly && (
        <div className="bg-muted/40 text-muted-foreground border-t px-4 py-3 text-center text-xs">
          Plan en estado final. Los comentarios son de solo lectura.
        </div>
      )}
    </div>
  )
}
