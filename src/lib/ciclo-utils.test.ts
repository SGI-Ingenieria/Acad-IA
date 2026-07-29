import { describe, expect, test } from 'bun:test'

import {
  completarEstructuraCiclos,
  proponerEstructuraCiclos,
  requiereSemanasPorCiclo,
  semanasTotalesPlan,
} from './ciclo-utils'

describe('completarEstructuraCiclos', () => {
  test('una carrera sin configuración empieza con un ciclo personalizado de una semana', () => {
    expect(completarEstructuraCiclos(proponerEstructuraCiclos(null))).toEqual({
      tipoCiclo: 'Otro',
      numCiclos: 1,
      semanasPorCiclo: 1,
    })
  })

  test('conserva la propuesta institucional cuando ya está completa', () => {
    expect(
      completarEstructuraCiclos(
        proponerEstructuraCiclos({
          nivel: 'Maestría',
          tipo_ciclo_default: 'Cuatrimestre',
          ciclos_default: 6,
        }),
      ),
    ).toEqual({
      tipoCiclo: 'Cuatrimestre',
      numCiclos: 6,
      semanasPorCiclo: null,
    })
  })
})

describe('requiereSemanasPorCiclo', () => {
  test('sólo «Otro» necesita que se declare la duración del ciclo', () => {
    expect(requiereSemanasPorCiclo('Otro')).toBe(true)
    expect(requiereSemanasPorCiclo('Semestre')).toBe(false)
    expect(requiereSemanasPorCiclo('Cuatrimestre')).toBe(false)
    expect(requiereSemanasPorCiclo('')).toBe(false)
    expect(requiereSemanasPorCiclo(null)).toBe(false)
  })
})

describe('proponerEstructuraCiclos', () => {
  test('la carrera manda sobre la convención del nivel', () => {
    expect(
      proponerEstructuraCiclos({
        nivel: 'Licenciatura',
        tipo_ciclo_default: 'Cuatrimestre',
        ciclos_default: 12,
      }),
    ).toEqual({
      tipoCiclo: 'Cuatrimestre',
      numCiclos: 12,
      semanasPorCiclo: null,
      origen: 'carrera',
    })
  })

  test('cae a la convención del nivel cuando la carrera no declara nada', () => {
    expect(proponerEstructuraCiclos({ nivel: 'Maestría' })).toEqual({
      tipoCiclo: 'Cuatrimestre',
      numCiclos: 6,
      semanasPorCiclo: null,
      origen: 'nivel',
    })
  })

  test('mezcla lo declarado con la convención y marca el origen como carrera', () => {
    // Declarar sólo el número ya deja de ser una propuesta genérica: alguien
    // revisó ese dato aunque el tipo siga viniendo del nivel.
    expect(
      proponerEstructuraCiclos({ nivel: 'Licenciatura', ciclos_default: 8 }),
    ).toEqual({
      tipoCiclo: 'Semestre',
      numCiclos: 8,
      semanasPorCiclo: null,
      origen: 'carrera',
    })
  })

  test('arrastra las semanas sólo con ciclos «Otro»', () => {
    expect(
      proponerEstructuraCiclos({
        nivel: 'Licenciatura',
        tipo_ciclo_default: 'Otro',
        ciclos_default: 5,
        semanas_por_ciclo_default: 10,
      }).semanasPorCiclo,
    ).toBe(10)

    // Un semestre trae su duración en el nombre: un valor suelto en la carrera
    // no debe convertirse en una duración declarada del plan.
    expect(
      proponerEstructuraCiclos({
        nivel: 'Licenciatura',
        tipo_ciclo_default: 'Semestre',
        ciclos_default: 8,
        semanas_por_ciclo_default: 10,
      }).semanasPorCiclo,
    ).toBeNull()
  })

  test('sin carrera ni nivel conocido no propone nada', () => {
    expect(proponerEstructuraCiclos(null)).toEqual({
      tipoCiclo: null,
      numCiclos: null,
      semanasPorCiclo: null,
      origen: 'ninguno',
    })
    expect(proponerEstructuraCiclos({ nivel: 'Diplomado' }).origen).toBe(
      'ninguno',
    )
  })
})

describe('semanasTotalesPlan', () => {
  test('multiplica sólo cuando se conocen las dos cifras', () => {
    expect(semanasTotalesPlan(5, 10)).toBe(50)
    expect(semanasTotalesPlan(5, null)).toBeNull()
    expect(semanasTotalesPlan(null, 10)).toBeNull()
    expect(semanasTotalesPlan(0, 10)).toBeNull()
  })
})
