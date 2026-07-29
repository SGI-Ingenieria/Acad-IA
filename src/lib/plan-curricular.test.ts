import { describe, expect, test } from 'bun:test'

import { recomendarEstructuraVigente } from './plan-curricular'

const estructuras = [
  {
    id: 'anterior',
    tipo: 'CURRICULAR',
    estado_publicacion: 'PUBLICADA' as const,
    aplicable_desde: '2019-01-01',
    aplicable_hasta: '2023-12-31',
  },
  {
    id: 'vigente',
    tipo: 'CURRICULAR',
    estado_publicacion: 'PUBLICADA' as const,
    aplicable_desde: '2024-01-01',
    aplicable_hasta: null,
  },
  {
    id: 'borrador',
    tipo: 'CURRICULAR',
    estado_publicacion: 'BORRADOR' as const,
    aplicable_desde: '2026-01-01',
    aplicable_hasta: null,
  },
]

describe('recomendarEstructuraVigente', () => {
  test('respeta ambos límites de vigencia', () => {
    expect(
      recomendarEstructuraVigente(estructuras, 'CURRICULAR', '2023-12-31')?.id,
    ).toBe('anterior')
    expect(
      recomendarEstructuraVigente(estructuras, 'CURRICULAR', '2024-01-01')?.id,
    ).toBe('vigente')
  })

  test('ignora versiones borrador aunque sean más recientes', () => {
    expect(
      recomendarEstructuraVigente(estructuras, 'CURRICULAR', '2026-08-01')?.id,
    ).toBe('vigente')
  })
})
