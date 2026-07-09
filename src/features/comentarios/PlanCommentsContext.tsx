import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

import type { ComentarioReferencia } from '@/data/types/domain'

export type PendingQuote = Required<
  Pick<
    ComentarioReferencia,
    'textoSeleccionado' | 'contenedor' | 'from' | 'until'
  >
> &
  Omit<
    ComentarioReferencia,
    'textoSeleccionado' | 'contenedor' | 'from' | 'until'
  >

type PlanCommentsContextValue = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  selectedPhaseId: string | null
  setSelectedPhaseId: (id: string | null) => void
  pendingQuote: PendingQuote | null
  setPendingQuote: (quote: PendingQuote | null) => void
  clearPendingQuote: () => void
}

const PlanCommentsContext = createContext<PlanCommentsContextValue | null>(null)

export function PlanCommentsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)
  const [pendingQuote, setPendingQuote] = useState<PendingQuote | null>(null)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const clearPendingQuote = useCallback(() => setPendingQuote(null), [])

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      selectedPhaseId,
      setSelectedPhaseId,
      pendingQuote,
      setPendingQuote,
      clearPendingQuote,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      selectedPhaseId,
      pendingQuote,
      clearPendingQuote,
    ],
  )

  return (
    <PlanCommentsContext.Provider value={value}>
      {children}
    </PlanCommentsContext.Provider>
  )
}

export function usePlanComments() {
  const ctx = useContext(PlanCommentsContext)
  if (!ctx) {
    throw new Error(
      'usePlanComments debe usarse dentro de PlanCommentsProvider',
    )
  }
  return ctx
}
