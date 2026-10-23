import { describe, expect, test } from 'bun:test'

import { PLAN_AREA_COMUN_ID } from '../types/areaComun'

import { canAccessPlanRoute } from './routeGuards'

describe('acceso a rutas de planes', () => {
  test('Área común puede abrir su plan aunque no tenga permisos generales', () => {
    expect(
      canAccessPlanRoute(
        PLAN_AREA_COMUN_ID,
        new Set(['area_comun.gestionar']),
        ['planes.ver'],
        false,
      ),
    ).toBe(true)
  })

  test('el encargado de bloque abre el plan institucional en modo acotado', () => {
    expect(
      canAccessPlanRoute(
        PLAN_AREA_COMUN_ID,
        new Set(['area_comun.bloque.editar']),
        ['planes.ver'],
        false,
      ),
    ).toBe(true)
  })

  test('Área común no obtiene acceso a planes de licenciatura por esta excepción', () => {
    expect(
      canAccessPlanRoute(
        'plan-licenciatura',
        new Set(['area_comun.gestionar']),
        ['planes.ver'],
        false,
      ),
    ).toBe(false)
  })

  test('conserva el acceso normal por permiso y la excepción de ADMIN', () => {
    expect(
      canAccessPlanRoute(
        'plan-licenciatura',
        new Set(['planes.ver']),
        ['planes.ver'],
        false,
      ),
    ).toBe(true)
    expect(canAccessPlanRoute('plan-licenciatura', new Set(), [], true)).toBe(
      true,
    )
  })
})
