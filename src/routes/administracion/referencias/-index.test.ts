import { describe, expect, test } from 'bun:test'

import { parseReferenciasSearch } from './index'

describe('búsqueda tipada de la biblioteca', () => {
  test('conserva una vista compartible y descarta valores desconocidos', () => {
    expect(
      parseReferenciasSearch({
        q: 'normativa',
        tab: 'imagenes',
        modo: 'grid',
        orden: 'name_asc',
        coleccion: 'carpeta-1',
      }),
    ).toEqual({
      q: 'normativa',
      tab: 'imagenes',
      modo: 'grid',
      orden: 'name_asc',
      coleccion: 'carpeta-1',
    })

    expect(
      parseReferenciasSearch({ tab: 'chat', modo: 'mosaico', orden: 'x' }),
    ).toEqual({
      q: '',
      tab: 'todo',
      modo: 'lista',
      orden: 'updated_desc',
      coleccion: '',
    })
  })
})
