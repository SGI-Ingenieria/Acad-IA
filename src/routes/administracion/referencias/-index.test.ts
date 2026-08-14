import { describe, expect, test } from 'bun:test'

import { parseReferenciasSearch } from './index'

describe('búsqueda tipada de la biblioteca', () => {
  test('conserva los filtros compartibles y descarta la vista de la URL', () => {
    expect(
      parseReferenciasSearch({
        q: 'normativa',
        tab: 'imagenes',
        orden: 'name_asc',
        coleccion: 'carpeta-1',
      }),
    ).toEqual({
      q: 'normativa',
      tab: 'imagenes',
      orden: 'name_asc',
      coleccion: 'carpeta-1',
    })

    expect(
      parseReferenciasSearch({ tab: 'chat', modo: 'mosaico', orden: 'x' }),
    ).toEqual({
      q: '',
      tab: 'todo',
      orden: 'updated_desc',
      coleccion: '',
    })
  })
})
