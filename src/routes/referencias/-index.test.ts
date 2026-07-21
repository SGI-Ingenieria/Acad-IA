import { describe, expect, test } from 'bun:test'

import { parseReferenciasSearch } from './index'

describe('búsqueda tipada de referencias', () => {
  test('conserva una vista compartible y descarta valores desconocidos', () => {
    expect(
      parseReferenciasSearch({
        vista: 'curriculum',
        q: 'normativa',
        orden: 'name_asc',
        coleccion: 'repo-1',
      }),
    ).toEqual({
      vista: 'curriculum',
      q: 'normativa',
      orden: 'name_asc',
      coleccion: 'repo-1',
    })

    expect(
      parseReferenciasSearch({ vista: 'chat', orden: 'desconocido' }),
    ).toEqual({
      vista: 'personal',
      q: '',
      orden: 'updated_desc',
      coleccion: '',
    })
  })
})
