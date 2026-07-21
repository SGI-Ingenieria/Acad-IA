import { describe, expect, test } from 'bun:test'

import { formatAssistantAnsweredAt } from './AssistantMessageActions'

describe('formatAssistantAnsweredAt', () => {
  test('muestra fecha completa y hora para una respuesta persistida', () => {
    const formatted = formatAssistantAnsweredAt('2026-07-21T18:30:00.000Z')

    expect(formatted).toContain('2026')
    expect(formatted).not.toContain('no disponible')
  })

  test('explica cuando la fecha falta o no es válida', () => {
    expect(formatAssistantAnsweredAt(null)).toBe(
      'Fecha de respuesta no disponible',
    )
    expect(formatAssistantAnsweredAt('fecha-inválida')).toBe(
      'Fecha de respuesta no disponible',
    )
  })
})
