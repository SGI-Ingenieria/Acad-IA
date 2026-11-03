import { expect, test } from 'bun:test'

import { obtenerCadenaSeriacion } from './seriacion-mapa'

test('resalta grupos antecedentes y sucesores sin incluir cadenas de asignaturas ajenas', () => {
  const edges = [
    { source: 'grupo-I', target: 'grupo-II' },
    { source: 'grupo-II', target: 'grupo-III' },
    { source: 'ingles-I', target: 'ingles-II' },
  ]
  expect(obtenerCadenaSeriacion('grupo-II', edges)).toEqual(
    new Set(['grupo-II', 'grupo-I', 'grupo-III']),
  )
  expect(obtenerCadenaSeriacion('ingles-I', edges)).toEqual(
    new Set(['ingles-I', 'ingles-II']),
  )
  expect(obtenerCadenaSeriacion(null, edges)).toBeNull()
})
test('tolera nodos aislados y relaciones cíclicas heredadas sin bucles infinitos', () => {
  expect(obtenerCadenaSeriacion('aislado', [])).toEqual(new Set(['aislado']))
  expect(
    obtenerCadenaSeriacion('a', [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
    ]),
  ).toEqual(new Set(['a', 'b']))
})
