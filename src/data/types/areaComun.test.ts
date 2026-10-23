import { describe, expect, test } from 'bun:test'

import { configuracionAreaComunSchema } from './areaComun'

const materia = 'ac000000-0000-4000-8000-000000000101'
const otra = 'ac000000-0000-4000-8000-000000000112'
const base = {
  clave: 'semestral-8',
  tipo_ciclo: 'Semestre',
  numero_ciclos: 8,
  carrera_id: null,
  espacios: [{ clave: 'pensamiento', numero_ciclo: 1, asignatura_id: materia }],
}

describe('distribuciones de Área común', () => {
  test('permite variantes por carrera sin confundirlas con la distribución general', () => {
    expect(
      configuracionAreaComunSchema.safeParse([
        base,
        {
          ...base,
          clave: 'filosofia',
          carrera_id: 'ac000000-0000-4000-8000-000000000099',
        },
      ]).success,
    ).toBe(true)
  })
  test('rechaza distribuciones ambiguas para el mismo destino', () => {
    expect(
      configuracionAreaComunSchema.safeParse([base, { ...base, clave: 'otra' }])
        .success,
    ).toBe(false)
  })
  test('rechaza materias fuera de la duración oficial', () => {
    expect(
      configuracionAreaComunSchema.safeParse([{ ...base, numero_ciclos: 0 }])
        .success,
    ).toBe(false)
  })
  test('un espacio representa una materia fija o una selección, nunca ambas', () => {
    expect(
      configuracionAreaComunSchema.safeParse([
        { ...base, espacios: [{ ...base.espacios[0], opciones: [otra] }] },
      ]).success,
    ).toBe(false)
  })
  test('no permite repetir una materia entre espacios y opciones', () => {
    expect(
      configuracionAreaComunSchema.safeParse([
        {
          ...base,
          espacios: [
            ...base.espacios,
            { clave: 'electiva', numero_ciclo: 6, opciones: [materia, otra] },
          ],
        },
      ]).success,
    ).toBe(false)
  })
  test('las electivas necesitan opciones y los espacios necesitan identidad estable', () => {
    expect(
      configuracionAreaComunSchema.safeParse([
        { ...base, espacios: [{ clave: '', numero_ciclo: 6, opciones: [] }] },
      ]).success,
    ).toBe(false)
  })
})
