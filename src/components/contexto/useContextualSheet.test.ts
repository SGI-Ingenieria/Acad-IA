import { describe, expect, test } from 'bun:test'

import { contextualSheetReducer } from './useContextualSheet'

import type { ContextualSheetState } from './useContextualSheet'

type Panel = 'ia' | 'historial'

describe('estado del panel contextual', () => {
  test('conserva la identidad del panel durante el cierre', () => {
    const openState: ContextualSheetState<Panel> = {
      panel: 'historial',
      open: true,
    }

    expect(
      contextualSheetReducer(openState, {
        type: 'set-open',
        open: false,
      }),
    ).toEqual({
      panel: 'historial',
      open: false,
    })
  })

  test('abrir otra opción actualiza panel y presencia en una sola transición', () => {
    const closedState: ContextualSheetState<Panel> = {
      panel: 'historial',
      open: false,
    }

    expect(
      contextualSheetReducer(closedState, {
        type: 'open',
        panel: 'ia',
      }),
    ).toEqual({
      panel: 'ia',
      open: true,
    })
  })
})
