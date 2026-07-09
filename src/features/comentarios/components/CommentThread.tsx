import { useMemo, useState } from 'react'

import { CommentComposer } from './CommentComposer'
import { CommentItem } from './CommentItem'

import type { ComentarioPlan, EstadoPlanRow } from '@/data/types/domain'

import {
  isRootComment,
  rootCommentIdOf,
} from '@/features/comentarios/lib/threads'

type ThreadReply = {
  comment: ComentarioPlan
  /** Comentario al que responde (para la referencia «En respuesta a …»). */
  parent: ComentarioPlan
}

type Thread = {
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
function buildThreads(comments: Array<ComentarioPlan>): Array<Thread> {
  const byId = new Map(comments.map((c) => [c.id, c]))
  const threads = new Map<string, Thread>()

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

export function CommentThread({
  comments,
  estadosById,
  isReadOnly,
  onReply,
  onToggleResuelto,
  replyingToId,
  setReplyingToId,
}: {
  comments: Array<ComentarioPlan>
  estadosById: Map<string, EstadoPlanRow>
  isReadOnly: boolean
  onReply: (parentId: string, html: string) => void | Promise<void>
  onToggleResuelto: (id: string) => void
  replyingToId: string | null
  setReplyingToId: (id: string | null) => void
}) {
  const threads = useMemo(() => buildThreads(comments), [comments])
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)

  const handleReply = async (parentId: string, html: string) => {
    setIsSubmittingReply(true)
    try {
      await onReply(parentId, html)
      setReplyingToId(null)
    } finally {
      setIsSubmittingReply(false)
    }
  }

  const renderComment = (
    comment: ComentarioPlan,
    replyToName: string | null,
  ) => (
    <>
      <CommentItem
        comment={comment}
        estadosById={estadosById}
        onReply={() =>
          setReplyingToId(replyingToId === comment.id ? null : comment.id)
        }
        isReadOnly={isReadOnly}
        resuelto={comment.resuelto}
        onToggleResuelto={() => onToggleResuelto(comment.id)}
        replyToName={replyToName}
      />
      {replyingToId === comment.id && !isReadOnly && (
        <div className="mt-3">
          <CommentComposer
            initialQuote={null}
            onSubmit={(html) => void handleReply(comment.id, html)}
            isSubmitting={isSubmittingReply}
            placeholder="Escribe una respuesta…"
            submitLabel="Responder"
          />
        </div>
      )}
    </>
  )

  return (
    <div className="space-y-6">
      {threads.map((thread) => (
        <div key={thread.root.id} className="space-y-4">
          <div>{renderComment(thread.root, null)}</div>

          {thread.replies.length > 0 && (
            <div className="border-border ml-5 space-y-4 border-l pl-4">
              {thread.replies.map(({ comment, parent }) => (
                <div key={comment.id}>
                  {renderComment(
                    comment,
                    // Solo mostramos la referencia cuando responde a otra
                    // respuesta; si responde a la raíz ya queda claro por
                    // la indentación.
                    parent.id === thread.root.id
                      ? null
                      : (parent.autor?.nombre_completo ?? 'Usuario'),
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
