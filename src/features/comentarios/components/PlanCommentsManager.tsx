import { useTextSelection } from '../hooks/useTextSelection'

import { CommentsDrawer } from './CommentsDrawer'
import { TextSelectionToolbar } from './TextSelectionToolbar'

import type { UUID } from '@/data/types/domain'
import type { PendingQuote } from '@/features/comentarios/PlanCommentsContext'

import { usePlanComments } from '@/features/comentarios/PlanCommentsContext'

export function PlanCommentsManager({
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
  const { isOpen, open, setPendingQuote } = usePlanComments()
  const { selection, clearSelection, getLastCapture } = useTextSelection(
    !isReadOnly && !isOpen,
  )

  const handleCommentSelection = () => {
    const capture = getLastCapture()
    if (!capture) return

    const referencia: PendingQuote = {
      textoSeleccionado: capture.text,
      contenedor: capture.containerSelector,
      from: capture.from,
      until: capture.until,
      ruta:
        typeof window !== 'undefined' ? window.location.pathname : undefined,
      origen: asignaturaId ? 'asignatura' : 'plan',
    }

    setPendingQuote(referencia)
    clearSelection()
    open()
  }

  return (
    <>
      {selection && !isOpen && (
        <TextSelectionToolbar
          selection={selection}
          onComment={handleCommentSelection}
        />
      )}

      {isOpen && (
        <CommentsDrawer
          planId={planId}
          asignaturaId={asignaturaId}
          estadoActualId={estadoActualId}
          isReadOnly={isReadOnly}
        />
      )}
    </>
  )
}
