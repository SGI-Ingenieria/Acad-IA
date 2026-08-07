import { MessageSquare, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { CommentComposer } from './CommentComposer'
import { buildCommentPhaseGroups, CommentThread } from './CommentThread'

import type {
  AdjuntoComentarioInput,
  EstadoPlanRow,
  UUID,
} from '@/data/types/domain'

import { Input } from '@/components/ui/input'
import {
  ListFilterSection,
  ListFiltersDialog,
  ListSortMenu,
  ListToolbar,
} from '@/components/ui/list-controls'
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

export function CommentsDrawer({
  planId,
  asignaturaId,
  estadoActualId,
  isReadOnly,
  onClose: _onClose,
}: {
  planId: UUID
  asignaturaId?: UUID | null
  estadoActualId?: UUID | null
  isReadOnly: boolean
  onClose?: () => void
}) {
  const {
    selectedPhaseId,
    setSelectedPhaseId,
    pendingQuote,
    clearPendingQuote,
  } = usePlanComments()
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<'reciente' | 'antiguo'>('reciente')

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

  const allPhaseGroups = useMemo(
    () => buildCommentPhaseGroups(comentarios ?? [], estadosById, null),
    [comentarios, estadosById],
  )
  const fasesConComentarios = useMemo(
    () =>
      new Set(
        allPhaseGroups
          .map((group) => group.phaseId)
          .filter((phaseId): phaseId is string => Boolean(phaseId)),
      ),
    [allPhaseGroups],
  )
  const phaseGroups = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es')
    return allPhaseGroups
      .filter((group) => !selectedPhaseId || group.phaseId === selectedPhaseId)
      .map((group) => ({
        ...group,
        threads: group.threads
          .filter((thread) => {
            if (!term) return true
            const comments = [
              thread.root,
              ...thread.replies.map((reply) => reply.comment),
            ]
            return comments.some((comment) =>
              [comment.autor?.nombre_completo, comment.cuerpo]
                .filter(Boolean)
                .join(' ')
                .replace(/<[^>]*>/g, ' ')
                .toLocaleLowerCase('es')
                .includes(term),
            )
          })
          .sort((left, right) => {
            const activity = (thread: typeof left) =>
              Math.max(
                Date.parse(thread.root.creado_en),
                ...thread.replies.map((reply) =>
                  Date.parse(reply.comment.creado_en),
                ),
              )
            const comparison = activity(left) - activity(right)
            return order === 'antiguo' ? comparison : -comparison
          }),
      }))
      .filter((group) => group.threads.length > 0)
  }, [allPhaseGroups, order, query, selectedPhaseId])

  const handleSubmit = async (
    html: string,
    adjuntos: Array<AdjuntoComentarioInput>,
  ) => {
    await crear.mutateAsync({
      planId,
      asignaturaId: asignaturaId ?? null,
      estadoId: isReadOnly ? null : (estadoActualId ?? null),
      cuerpo: html,
      referencia: pendingQuote,
      adjuntos,
    })
    clearPendingQuote()
  }

  const handleReply = async (
    parentId: string | null,
    html: string,
    adjuntos: Array<AdjuntoComentarioInput>,
  ) => {
    await crear.mutateAsync({
      planId,
      asignaturaId: asignaturaId ?? null,
      estadoId: isReadOnly ? null : (estadoActualId ?? null),
      cuerpo: html,
      comentarioPadreId: parentId,
      adjuntos,
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
      className="bg-background flex h-full min-h-0 w-full flex-col overflow-hidden"
      aria-label="Panel de comentarios"
    >
      {/* Header */}
      <div className="border-border px-grupo py-control border-b">
        <ListToolbar
          search={
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar comentarios"
                className="pl-pagina h-9 text-sm"
                aria-label="Buscar comentarios"
              />
            </div>
          }
          actions={
            <>
              <ListSortMenu
                value={order}
                defaultValue="reciente"
                options={[
                  { value: 'reciente', label: 'Actividad reciente' },
                  { value: 'antiguo', label: 'Actividad antigua' },
                ]}
                onValueChange={setOrder}
                label="Ordenar comentarios"
              />
              <ListFiltersDialog
                title="Filtrar comentarios"
                description="Consulta comentarios de una fase específica del plan."
                value={{ phaseId: selectedPhaseId ?? 'TODAS' }}
                defaultValue={{ phaseId: 'TODAS' }}
                activeCount={selectedPhaseId ? 1 : 0}
                onApply={(next, { resetAll }) => {
                  setSelectedPhaseId(
                    next.phaseId === 'TODAS' ? null : next.phaseId,
                  )
                  if (resetAll) {
                    setQuery('')
                    setOrder('reciente')
                  }
                }}
                label="Filtrar comentarios"
              >
                {(draft, setDraft) => (
                  <ListFilterSection title="Fase">
                    <Select
                      value={draft.phaseId}
                      onValueChange={(phaseId) => setDraft({ phaseId })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODAS">Todas las fases</SelectItem>
                        {(estados ?? [])
                          .filter(
                            (estado) =>
                              fasesConComentarios.has(estado.id) ||
                              estado.id === estadoActualId,
                          )
                          .sort((left, right) => left.orden - right.orden)
                          .map((estado) => (
                            <SelectItem key={estado.id} value={estado.id}>
                              {estado.etiqueta}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </ListFilterSection>
                )}
              </ListFiltersDialog>
            </>
          }
        />
      </div>

      {/* Lista */}
      <ScrollArea className="px-grupo py-grupo min-h-0 flex-1">
        {phaseGroups.length === 0 ? (
          <div className="text-muted-foreground gap-relacionado py-pagina flex flex-col items-center justify-center text-center text-sm">
            <MessageSquare className="h-8 w-8 opacity-30" />
            <p>Aún no hay comentarios en este apartado.</p>
            {!isReadOnly && (
              <p>Selecciona texto para comentar o escribe uno nuevo.</p>
            )}
          </div>
        ) : (
          <CommentThread
            planId={planId}
            phaseGroups={phaseGroups}
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
        <div className="px-grupo pt-control pb-grupo border-t">
          <CommentComposer
            planId={planId}
            initialQuote={pendingQuote}
            onSubmit={handleSubmit}
            isSubmitting={crear.isPending}
            placeholder="Escribe un comentario…"
            appearance="flat"
          />
        </div>
      )}

      {isReadOnly && (
        <div className="bg-muted/40 text-muted-foreground px-grupo py-control border-t text-center text-xs">
          Plan en estado final. Los comentarios son de solo lectura.
        </div>
      )}
    </div>
  )
}
