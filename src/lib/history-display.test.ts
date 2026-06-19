import { describe, expect, test } from 'bun:test'

import {
  areHistoryValuesEqual,
  formatHistoryFieldLabel,
  getHistoryGroupForChange,
  isHistoryTransitionChange,
  toHistoryDisplayValue,
} from './history-display'

describe('history-display', () => {
  test('resolves known references before rendering history values', () => {
    const value = toHistoryDisplayValue(
      '11111111-1111-1111-1111-111111111111',
      {
        estados: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            label: 'En revisión',
          },
        ],
      },
      'estado_actual_id',
    )

    expect(value).toBe('En revisión')
  })

  test('does not leak unknown technical identifiers', () => {
    expect(
      toHistoryDisplayValue(
        '22222222-2222-2222-2222-222222222222',
        {},
        'carrera_id',
      ),
    ).toBe('Referencia no disponible')
  })

  test('hides object ids and keeps human fields', () => {
    expect(
      toHistoryDisplayValue({
        id: '33333333-3333-3333-3333-333333333333',
        nombre: 'Ingeniería',
        estado_actual_id: '44444444-4444-4444-4444-444444444444',
      }),
    ).toEqual({
      Nombre: 'Ingeniería',
      Estado: 'Referencia no disponible',
    })
  })

  test('formats field labels and compares values deterministically', () => {
    expect(formatHistoryFieldLabel('linea_plan_id')).toBe('Línea curricular')
    expect(areHistoryValuesEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(areHistoryValuesEqual({ a: 1 }, { a: 2 })).toBe(false)
  })

  test('classifies plan and subject history changes into display groups', () => {
    expect(
      getHistoryGroupForChange({
        source: 'asignatura',
        tipo: 'ACTUALIZACION_MAPA',
        campo: 'numero_ciclo',
      }).id,
    ).toBe('mapa_curricular')

    expect(
      getHistoryGroupForChange({
        source: 'asignatura',
        tipo: 'ACTUALIZACION',
        campo: 'horas_academicas',
      }).id,
    ).toBe('cambios_asignatura')

    expect(
      getHistoryGroupForChange({
        source: 'plan',
        tipo: 'ACTUALIZACION',
        campo: 'numero_ciclos',
      }).id,
    ).toBe('estructura_plan')

    expect(isHistoryTransitionChange('TRANSICION_ESTADO', 'estado')).toBe(true)
  })
})
