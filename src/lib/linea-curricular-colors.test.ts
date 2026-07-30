import { describe, expect, test } from 'bun:test'

import {
  colorLineaCurricular,
  PALETA_LINEAS_CURRICULARES,
  siguienteColorLineaCurricular,
} from './linea-curricular-colors'

describe('colorLineaCurricular', () => {
  test('conserva un color persistido', () => {
    expect(colorLineaCurricular({ color: '#123456' }, 3)).toBe('#123456')
  })

  test('usa la misma paleta estable cuando falta el color', () => {
    expect(colorLineaCurricular({ color: null }, 0)).toBe(
      PALETA_LINEAS_CURRICULARES[0],
    )
    expect(
      colorLineaCurricular({ color: '  ' }, PALETA_LINEAS_CURRICULARES.length),
    ).toBe(PALETA_LINEAS_CURRICULARES[0])
  })

  test('elige primero un color de la paleta que todavía no se utiliza', () => {
    const color = siguienteColorLineaCurricular(
      PALETA_LINEAS_CURRICULARES.slice(0, -1),
      () => 0,
    )

    expect(color).toBe(PALETA_LINEAS_CURRICULARES.at(-1)!)
  })

  test('genera un color válido al agotar la paleta', () => {
    const color = siguienteColorLineaCurricular(
      PALETA_LINEAS_CURRICULARES,
      () => 0.5,
    )

    expect(color).toMatch(/^#[0-9A-F]{6}$/)
    expect(PALETA_LINEAS_CURRICULARES).not.toContain(color)
  })
})
