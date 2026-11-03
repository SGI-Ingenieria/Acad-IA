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

const grupos = {
  ...base,
  espacios: [
    {
      clave: 'I',
      nombre: 'Obligatoria Electiva I',
      numero_ciclo: 6,
      opciones: [
        'ac000000-0000-4000-8000-000000000112',
        'ac000000-0000-4000-8000-000000000113',
      ],
    },
    {
      clave: 'II',
      nombre: 'Obligatoria Electiva II',
      numero_ciclo: 8,
      opciones: [
        'ac000000-0000-4000-8000-000000000115',
        'ac000000-0000-4000-8000-000000000116',
      ],
      prerrequisito_grupo_clave: 'I',
    },
  ],
}
describe('seriación entre grupos electivos #296', () => {
  test('persiste una relación entre grupos conservando todas las alternativas', () => {
    const parsed = configuracionAreaComunSchema.parse([grupos])
    const reopened = configuracionAreaComunSchema.parse(
      JSON.parse(JSON.stringify(parsed)),
    )
    expect(reopened[0].espacios[1].prerrequisito_grupo_clave).toBe('I')
    expect(reopened[0].espacios.map((e) => e.opciones?.length)).toEqual([2, 2])
  })
  test('rechaza antecedentes inexistentes, de otro grupo o de otra distribución', () => {
    for (const clave of ['II', 'otro', '']) {
      expect(
        configuracionAreaComunSchema.safeParse([
          {
            ...grupos,
            espacios: [
              grupos.espacios[0],
              { ...grupos.espacios[1], prerrequisito_grupo_clave: clave },
            ],
          },
        ]).success,
      ).toBe(false)
    }
  })
  test('rechaza eliminar o convertir el antecedente en materia fija', () => {
    expect(
      configuracionAreaComunSchema.safeParse([
        { ...grupos, espacios: [grupos.espacios[1]] },
      ]).success,
    ).toBe(false)
    expect(
      configuracionAreaComunSchema.safeParse([
        {
          ...grupos,
          espacios: [
            { clave: 'I', numero_ciclo: 6, asignatura_id: materia },
            grupos.espacios[1],
          ],
        },
      ]).success,
    ).toBe(false)
  })
  test('rechaza mismo ciclo, ciclo posterior y ciclos de dependencia', () => {
    for (const ciclo of [8, 9]) {
      expect(
        configuracionAreaComunSchema.safeParse([
          {
            ...grupos,
            espacios: [
              { ...grupos.espacios[0], numero_ciclo: ciclo },
              grupos.espacios[1],
            ],
          },
        ]).success,
      ).toBe(false)
    }
    expect(
      configuracionAreaComunSchema.safeParse([
        {
          ...grupos,
          espacios: [
            { ...grupos.espacios[0], prerrequisito_grupo_clave: 'II' },
            grupos.espacios[1],
          ],
        },
      ]).success,
    ).toBe(false)
  })
  test('permite quitar la dependencia antes de retirar el grupo y admite datos anteriores', () => {
    const { prerrequisito_grupo_clave: _previo, ...sinRelacion } =
      grupos.espacios[1]
    expect(
      configuracionAreaComunSchema.safeParse([
        { ...grupos, espacios: [sinRelacion] },
      ]).success,
    ).toBe(true)
    expect(configuracionAreaComunSchema.safeParse([base]).success).toBe(true)
  })
})
