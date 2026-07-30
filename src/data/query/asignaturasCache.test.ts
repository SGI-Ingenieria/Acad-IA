import { describe, expect, test } from 'bun:test'

import { reconciliarAsignaturaGenerada } from './asignaturasCache'

import type { Asignatura } from '../types/domain'

const asignatura = (id: string, nombre: string): Asignatura =>
  ({ id, nombre }) as Asignatura

describe('reconciliarAsignaturaGenerada', () => {
  test('sustituye la fila temporal por la persistida en la misma posición', () => {
    const real = asignatura('real-1', 'Diseño centrado en el usuario')

    expect(
      reconciliarAsignaturaGenerada(
        [
          asignatura('anterior', 'Anterior'),
          asignatura('temp:1', 'Diseño centrado en el usuario'),
          asignatura('siguiente', 'Siguiente'),
        ],
        'temp:1',
        real,
      ),
    ).toEqual([
      asignatura('anterior', 'Anterior'),
      real,
      asignatura('siguiente', 'Siguiente'),
    ])
  })

  test('colapsa el eco Realtime y la fila temporal en una sola identidad real', () => {
    const real = asignatura('real-1', 'Diseño centrado en el usuario')

    const resultado = reconciliarAsignaturaGenerada(
      [
        asignatura('temp:1', 'Diseño centrado en el usuario'),
        asignatura('real-1', 'Diseño centrado en el usuario'),
      ],
      'temp:1',
      real,
    )

    expect(resultado).toEqual([real])
    expect(resultado.filter((fila) => fila.id === real.id)).toHaveLength(1)
  })

  test('actualiza la fila real si el placeholder ya no está en la lista', () => {
    const real = asignatura('real-1', 'Nombre definitivo')

    expect(
      reconciliarAsignaturaGenerada(
        [asignatura('real-1', 'Nombre provisional')],
        'temp:1',
        real,
      ),
    ).toEqual([real])
  })
})
