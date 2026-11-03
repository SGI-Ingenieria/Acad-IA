import { expect, test } from 'bun:test'

import { alternativasSinDuplicarCarga } from './grupos-electivos'

test('cuenta una carga por bloque y conserva materias independientes', () => {
  const materias = [
    { id: 'a', grupo_electivo_id: 'I', creditos: 3 },
    { id: 'b', grupo_electivo_id: 'I', creditos: 3 },
    { id: 'c', grupo_electivo_id: 'II', creditos: 3 },
    { id: 'd', grupo_electivo_id: null, creditos: 6 },
  ]
  const contadas = alternativasSinDuplicarCarga(materias)
  expect(contadas.reduce((s, a) => s + a.creditos, 0)).toBe(12)
  expect(contadas.map((a) => a.id)).toEqual(['a', 'c', 'd'])
  expect(materias).toHaveLength(4)
})
test('planes sin bloques y bloques vacíos mantienen carga correcta', () => {
  expect(alternativasSinDuplicarCarga([])).toEqual([])
  const materias = [{ id: 'a' }, { id: 'b' }]
  expect(alternativasSinDuplicarCarga(materias)).toEqual(materias)
})
