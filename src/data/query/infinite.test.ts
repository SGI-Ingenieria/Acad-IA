import { describe, expect, test } from 'bun:test'

import { extraerPaginas, siguienteOffset } from './infinite'

describe('siguienteOffset', () => {
  test('continúa desde la cantidad real acumulada', () => {
    expect(
      siguienteOffset({ data: ['d'], count: 10 }, [
        { data: ['a', 'b', 'c'], count: 10 },
        { data: ['d'], count: 10 },
      ]),
    ).toBe(4)
  })

  test('termina al alcanzar el total o recibir una página vacía', () => {
    expect(
      siguienteOffset({ data: ['c'], count: 3 }, [
        { data: ['a', 'b'], count: 3 },
        { data: ['c'], count: 3 },
      ]),
    ).toBeUndefined()
    expect(
      siguienteOffset({ data: [], count: 8 }, [{ data: [], count: 8 }]),
    ).toBeUndefined()
  })
})

describe('extraerPaginas', () => {
  test('lee tanto consultas ordinarias como infinitas', () => {
    const pagina = { data: ['a'], count: 1 }
    expect(extraerPaginas(pagina)).toEqual([pagina])
    expect(extraerPaginas({ pages: [pagina], pageParams: [0] })).toEqual([
      pagina,
    ])
  })
})
