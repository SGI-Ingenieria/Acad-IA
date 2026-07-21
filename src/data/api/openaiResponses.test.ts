import { describe, expect, test } from 'bun:test'

import { resolverResultadoCancelacion } from './openaiResponses.api'

describe('resolverResultadoCancelacion', () => {
  test('confirma cancelación sólo cuando la transición quedó aplicada', () => {
    expect(
      resolverResultadoCancelacion({
        responseId: 'resp-1',
        status: 'cancelled',
        deleted: true,
        applied: true,
        resolution: 'applied',
      }),
    ).toBe('cancelled')
  })

  test('no presenta como cancelada una respuesta que terminó primero', () => {
    expect(
      resolverResultadoCancelacion({
        responseId: 'resp-2',
        status: 'completed',
        deleted: false,
        applied: true,
        resolution: 'already_applied',
      }),
    ).toBe('finished')
  })

  test('continúa esperando si otro trabajador mantiene la reclamación', () => {
    expect(
      resolverResultadoCancelacion({
        responseId: 'resp-3',
        status: 'completed',
        deleted: false,
        applied: false,
        resolution: 'claimed_elsewhere',
      }),
    ).toBe('pending')
  })

  test('distingue una respuesta que dejó de ser vigente', () => {
    expect(
      resolverResultadoCancelacion({
        responseId: 'resp-4',
        status: 'cancelled',
        deleted: false,
        applied: false,
        resolution: 'stale',
      }),
    ).toBe('stale')
  })
})
