import { useCallback, useReducer } from 'react'

export type ContextualSheetState<TPanel extends string> = {
  panel: TPanel
  open: boolean
}

type ContextualSheetAction<TPanel extends string> =
  | { type: 'open'; panel: TPanel }
  | { type: 'set-open'; open: boolean }

export function contextualSheetReducer<TPanel extends string>(
  state: ContextualSheetState<TPanel>,
  action: ContextualSheetAction<TPanel>,
): ContextualSheetState<TPanel> {
  if (action.type === 'open') {
    return { panel: action.panel, open: true }
  }

  return { ...state, open: action.open }
}

export function useContextualSheet<TPanel extends string>(
  initialPanel: TPanel,
) {
  const [state, dispatch] = useReducer(contextualSheetReducer<TPanel>, {
    panel: initialPanel,
    open: false,
  })

  const openPanel = useCallback((panel: TPanel) => {
    dispatch({ type: 'open', panel })
  }, [])
  const setOpen = useCallback((open: boolean) => {
    dispatch({ type: 'set-open', open })
  }, [])
  const close = useCallback(() => setOpen(false), [setOpen])

  return { state, openPanel, setOpen, close }
}
