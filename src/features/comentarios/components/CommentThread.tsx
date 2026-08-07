import { useState } from 'react'

import { CommentComposer } from './CommentComposer'
import { CommentItem } from './CommentItem'

import type {
  AdjuntoComentarioInput,
  ComentarioPlan,
  EstadoPlanRow,
  UUID,
} from '@/data/types/domain'

import {
  isRootComment,
  rootCommentIdOf,
} from '@/features/comentarios/lib/threads'

export type ThreadReply = {
  comment: ComentarioPlan
  /** Comentario al que responde (para la referencia «En respuesta a …»). */
  parent: ComentarioPlan
}

export type CommentThreadGroup = {
  root: ComentarioPlan
  /** Todas las respuestas del hilo, aplanadas a un solo nivel. */
  replies: Array<ThreadReply>
}

/**
 * Aplana el árbol de comentarios a un único nivel de indentación: cada hilo
 * tiene una raíz y una lista plana de respuestas (sin importar cuán profunda
 * fuera la anidación original). Así las respuestas no se recorren infinitamente
 * a la derecha; en su lugar cada una conserva la referencia a qué comentario
 * responde. Los comentarios ya llegan ordenados por fecha ascendente.
 */
function buildThreads(
  comments: Array<ComentarioPlan>,
): Array<CommentThreadGroup> {
  const byId = new Map(comments.map((c) => [c.id, c]))
  const threads = new Map<string, CommentThreadGroup>()

  // Raíces primero (sin padre o con padre ausente), en su orden cronológico.
  for (const comment of comments) {
    if (isRootComment(comment, byId)) {
      threads.set(comment.id, { root: comment, replies: [] })
    }
  }

  // Cada respuesta se cuelga plana bajo su raíz, guardando su padre real.
  for (const comment of comments) {
    if (isRootComment(comment, byId)) continue
    const thread = threads.get(rootCommentIdOf(comment, byId))
    if (thread) {
      thread.replies.push({
        comment,
        parent: byId.get(comment.comentario_padre_id!)!,
      })
    } else {
      threads.set(comment.id, { root: comment, replies: [] })
    }
  }

  return [...threads.values()]
}

export type CommentPhaseGroup = {
  phaseId: string | null
  phaseLabel: string
  phaseOrder: number
  commentCount: number
  threads: Array<CommentThreadGroup>
}

export function buildCommentPhaseGroups(
  comments: Array<ComentarioPlan>,
  estadosById: Map<string, EstadoPlanRow>,
  selectedPhaseId: string | null,
): Array<CommentPhaseGroup> {
  const groups = new Map<string, CommentPhaseGroup>()

  for (const thread of buildThreads(comments)) {
    const phaseId = thread.root.estado_id
    if (selectedPhaseId && phaseId !== selectedPhaseId) continue

    const phase = phaseId ? estadosById.get(phaseId) : null
    const key = phaseId ?? 'SIN_FASE'
    const current = groups.get(key) ?? {
      phaseId,
      phaseLabel: phase?.etiqueta ?? 'Sin fase registrada',
      phaseOrder: phase?.orden ?? Number.MAX_SAFE_INTEGER,
      commentCount: 0,
      threads: [],
    }

    current.threads.push(thread)
    current.commentCount += 1 + thread.replies.length
    groups.set(key, current)
  }

  return [...groups.values()].sort(
    (left, right) =>
      left.phaseOrder - right.phaseOrder ||
      left.phaseLabel.localeCompare(right.phaseLabel, 'es'),
  )
}

export function CommentThread({
  planId,
  phaseGroups,
  estadosById,
  isReadOnly,
  onReply,
  onToggleResuelto,
  replyingToId,
  setReplyingToId,
}: {
  planId: UUID
  phaseGroups: Array<CommentPhaseGroup>
  estadosById: Map<string, EstadoPlanRow>
  isReadOnly: boolean
  onReply: (
    parentId: string,
    html: string,
    adjuntos: Array<AdjuntoComentarioInput>,
  ) => void | Promise<void>
  onToggleResuelto: (id: string) => void
  replyingToId: string | null
  setReplyingToId: (id: string | null) => void
}) {
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)

  const handleReply = async (
    parentId: string,
    html: string,
    adjuntos: Array<AdjuntoComentarioInput>,
  ) => {
    setIsSubmittingReply(true)
    try {
      await onReply(parentId, html, adjuntos)
      setReplyingToId(null)
    } finally {
      setIsSubmittingReply(false)
    }
  }

  const renderComment = (
    comment: ComentarioPlan,
    replyToName: string | null,
    rootPhaseId: string | null,
  ) => (
    <>
      <CommentItem
        comment={comment}
        onReply={() =>
          setReplyingToId(replyingToId === comment.id ? null : comment.id)
        }
        isReadOnly={isReadOnly}
        resuelto={comment.resuelto}
        onToggleResuelto={() => onToggleResuelto(comment.id)}
        replyToName={replyToName}
        phaseNote={
          comment.estado_id !== rootPhaseId
            ? comment.estado_id
              ? estadosById.get(comment.estado_id)?.etiqueta
              : 'Sin fase registrada'
            : null
        }
      />
      {replyingToId === comment.id && !isReadOnly && (
        <div className="mt-control">
          <CommentComposer
            planId={planId}
            initialQuote={null}
            onSubmit={(html, adjuntos) =>
              void handleReply(comment.id, html, adjuntos)
            }
            isSubmitting={isSubmittingReply}
            placeholder="Escribe una respuesta…"
            appearance="flat"
          />
        </div>
      )}
    </>
  )

  return (
    <div>
      {phaseGroups.map((phaseGroup) => (
        <section key={phaseGroup.phaseId ?? 'SIN_FASE'}>
          <div className="border-border bg-background gap-control py-relacionado sticky top-0 z-10 flex items-baseline justify-between border-b">
            <h3 className="text-foreground text-xs font-semibold tracking-wide uppercase">
              {phaseGroup.phaseLabel}
            </h3>
            <span className="text-muted-foreground text-xs tabular-nums">
              {phaseGroup.commentCount}{' '}
              {phaseGroup.commentCount === 1 ? 'comentario' : 'comentarios'}
            </span>
          </div>

          {phaseGroup.threads.map((thread) => (
            <div key={thread.root.id}>
              <div className="border-border py-grupo border-b">
                {renderComment(thread.root, null, phaseGroup.phaseId)}
              </div>

              {thread.replies.length > 0 && (
                <div className="ml-region">
                  {thread.replies.map(({ comment, parent }) => (
                    <div
                      key={comment.id}
                      className="border-border py-grupo border-b"
                    >
                      {renderComment(
                        comment,
                        parent.autor?.nombre_completo ?? 'Usuario',
                        phaseGroup.phaseId,
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
