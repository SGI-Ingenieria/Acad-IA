import { describe, expect, test } from 'bun:test'

import { calcularPosicionToolbarSeleccion } from './selection-toolbar-position'

const base = {
  contenedor: { top: 200, right: 900, bottom: 700, left: 500 },
  altoViewport: 800,
  altoToolbar: 40,
  separacion: 8,
  margenViewport: 12,
}

describe('calcularPosicionToolbarSeleccion', () => {
  test('mantiene una selección ordinaria encima del fragmento seleccionado', () => {
    const posicion = calcularPosicionToolbarSeleccion({
      ...base,
      inicio: { top: 360, right: 620, bottom: 380, left: 540 },
      fin: { top: 410, right: 760, bottom: 430, left: 680 },
      rectangulos: [
        { top: 360, right: 820, bottom: 380, left: 540 },
        { top: 410, right: 760, bottom: 430, left: 540 },
      ],
    })

    expect(posicion).toEqual({
      top: 312,
      left: 650,
      estrategia: 'sobre-seleccion',
    })
  })

  test('centra el toolbar en el tramo visible si el inicio quedó arriba', () => {
    const posicion = calcularPosicionToolbarSeleccion({
      ...base,
      inicio: { top: -420, right: 760, bottom: -400, left: 540 },
      fin: { top: 680, right: 820, bottom: 700, left: 540 },
      rectangulos: [
        { top: -420, right: 820, bottom: -400, left: 540 },
        { top: 210, right: 820, bottom: 230, left: 540 },
        { top: 680, right: 820, bottom: 700, left: 540 },
      ],
    })

    expect(posicion).toEqual({
      top: 435,
      left: 700,
      estrategia: 'centro-visible',
    })
  })

  test('respeta la porción seleccionada visible, no toda la tarjeta', () => {
    const posicion = calcularPosicionToolbarSeleccion({
      ...base,
      inicio: { top: 120, right: 760, bottom: 140, left: 540 },
      fin: { top: 340, right: 820, bottom: 360, left: 540 },
      rectangulos: [
        { top: 120, right: 820, bottom: 140, left: 540 },
        { top: 250, right: 820, bottom: 270, left: 540 },
        { top: 340, right: 820, bottom: 360, left: 540 },
      ],
    })

    expect(posicion).toEqual({
      top: 285,
      left: 700,
      estrategia: 'centro-visible',
    })
  })
})
