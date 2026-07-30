import { describe, expect, test } from 'bun:test'

import {
  colorLineaCurricular,
  PALETA_LINEAS_CURRICULARES,
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
})
