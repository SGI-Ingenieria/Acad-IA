import { describe, expect, test } from 'bun:test'

import { ApiError, isResourceNotFoundError } from './_helpers'

describe('isResourceNotFoundError', () => {
  test('reconoce ausencias de plan y asignatura como estados esperados', () => {
    expect(
      isResourceNotFoundError(
        new ApiError('Plan no encontrado.', 'PLAN_NOT_FOUND'),
      ),
    ).toBe(true)
    expect(
      isResourceNotFoundError(
        new ApiError('Asignatura no encontrada.', 'SUBJECT_NOT_FOUND'),
      ),
    ).toBe(true)
  })

  test('mantiene compatibilidad con PGRST116 sin silenciar otros fallos', () => {
    expect(isResourceNotFoundError({ code: 'PGRST116' })).toBe(true)
    expect(isResourceNotFoundError({ code: '42501' })).toBe(false)
    expect(isResourceNotFoundError(new Error('Sin conexión'))).toBe(false)
  })
})
