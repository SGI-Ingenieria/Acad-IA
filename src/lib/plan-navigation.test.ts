import { describe, expect, test } from 'bun:test'

import { rutaContinuacionCurricular } from './plan-navigation'

describe('rutaContinuacionCurricular', () => {
  test('mantiene fundamentos y bloques en la vista conceptual', () => {
    expect(rutaContinuacionCurricular('FUNDAMENTOS')).toBe(
      '/planes/$planId/bloques',
    )
    expect(rutaContinuacionCurricular('BLOQUES')).toBe(
      '/planes/$planId/bloques',
    )
  })

  test('continúa en el mapa únicamente después de avanzar a esa fase', () => {
    expect(rutaContinuacionCurricular('MAPA')).toBe('/planes/$planId/mapa')
  })

  test('los planes sin fase explícita comienzan en bloques', () => {
    expect(rutaContinuacionCurricular(null)).toBe('/planes/$planId/bloques')
    expect(rutaContinuacionCurricular(undefined)).toBe(
      '/planes/$planId/bloques',
    )
  })
})
