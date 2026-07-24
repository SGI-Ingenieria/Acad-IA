import { useTextSelection } from '../hooks/useTextSelection'

import { TextSelectionToolbar } from './TextSelectionToolbar'

import type { PendingQuote } from '@/features/comentarios/PlanCommentsContext'

import { usePlanComments } from '@/features/comentarios/PlanCommentsContext'

export function PlanCommentsManager({
  asignaturaId,
  isReadOnly,
}: {
  asignaturaId?: string | null
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
    selection &&
    !isOpen && (
      <TextSelectionToolbar
        selection={selection}
        onComment={handleCommentSelection}
      />
    )
  )
}
