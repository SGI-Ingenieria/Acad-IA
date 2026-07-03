import { describe, expect, test } from 'bun:test'

import { buildPlanCapabilities } from './planCapabilities'

import type { RoleAssignmentClaim } from './permissions'
import type { PlanEstudio } from '@/data/types/domain'

const hasIA = (permission: string) => permission === 'ia.usar'

function planFixture(input: {
  estado: string
  carreraId: string
  facultadId: string
  nivel: string
}): PlanEstudio {
  return {
    id: 'plan-1',
    carrera_id: input.carreraId,
    estados_plan: { clave: input.estado },
    carreras: {
      id: input.carreraId,
      facultad_id: input.facultadId,
      nivel: input.nivel,
    },
  } as PlanEstudio
}

function assignment(
  clave: string,
  scope: Partial<RoleAssignmentClaim>,
): RoleAssignmentClaim {
  return {
    clave,
    alcance_default: scope.alcance_default ?? 'facultad',
    facultad_id: scope.facultad_id ?? null,
    carrera_id: scope.carrera_id ?? null,
  }
}

describe('buildPlanCapabilities scoped roles', () => {
  test('allows JEFE_POSGRADO to edit postgraduate plans in its faculty', () => {
    const capabilities = buildPlanCapabilities({
      plan: planFixture({
        estado: 'BORRADOR',
        carreraId: 'maestria-1',
        facultadId: 'fac-1',
        nivel: 'Maestría',
      }),
      roleKeys: new Set(['JEFE_POSGRADO']),
      roleAssignments: [assignment('JEFE_POSGRADO', { facultad_id: 'fac-1' })],
      isAdmin: false,
      has: hasIA,
    })

    expect(capabilities.canEditPlan).toBe(true)
    expect(capabilities.canEditAsignaturas).toBe(true)
    expect(capabilities.canUseIA).toBe(true)
  })

  test('does not allow JEFE_POSGRADO to edit licenciatura plans', () => {
    const capabilities = buildPlanCapabilities({
      plan: planFixture({
        estado: 'BORRADOR',
        carreraId: 'lic-1',
        facultadId: 'fac-1',
        nivel: 'Licenciatura',
      }),
      roleKeys: new Set(['JEFE_POSGRADO']),
      roleAssignments: [assignment('JEFE_POSGRADO', { facultad_id: 'fac-1' })],
      isAdmin: false,
      has: hasIA,
    })

    expect(capabilities.canEditPlan).toBe(false)
    expect(capabilities.canEditAsignaturas).toBe(false)
    expect(capabilities.canUseIA).toBe(false)
  })

  test('requires scoped SECRETARIO_ACADEMICO to match the plan faculty', () => {
    const plan = planFixture({
      estado: 'REVISION',
      carreraId: 'car-1',
      facultadId: 'fac-1',
      nivel: 'Licenciatura',
    })

    const matching = buildPlanCapabilities({
      plan,
      roleKeys: new Set(['SECRETARIO_ACADEMICO']),
      roleAssignments: [
        assignment('SECRETARIO_ACADEMICO', { facultad_id: 'fac-1' }),
      ],
      isAdmin: false,
      has: hasIA,
    })
    const lateral = buildPlanCapabilities({
      plan,
      roleKeys: new Set(['SECRETARIO_ACADEMICO']),
      roleAssignments: [
        assignment('SECRETARIO_ACADEMICO', { facultad_id: 'fac-2' }),
      ],
      isAdmin: false,
      has: hasIA,
    })

    expect(matching.canEditPlan).toBe(true)
    expect(lateral.canEditPlan).toBe(false)
  })
})
