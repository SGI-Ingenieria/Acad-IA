import { describe, expect, test } from 'bun:test'

import { buildWorkspaceCapabilities, resolveWorkspace } from './resolver'

const base = {
  usuarioId: 'user-1',
  rolClave: 'JEFE_CARRERA',
  alcance: { carreraId: 'carrera-1' },
  capacidades: {
    puedeCrearPlan: true,
    puedeEditarPlan: true,
    puedeEditarAsignatura: true,
    puedeRevisar: false,
    puedeAprobar: false,
    puedeAsignarResponsables: true,
    puedeUsarIA: true,
  },
  planes: [],
  asignaturas: [],
  accionesPendientes: [],
  indicadores: [],
}

describe('resolveWorkspace', () => {
  test('manda a crear cuando jefatura no tiene planes', () => {
    const workspace = resolveWorkspace({
      ...base,
      roleKeys: new Set(['JEFE_CARRERA']),
      permissions: new Set(['planes.crear']),
      isAdmin: false,
    })

    expect(workspace.estacion).toBe('CreateWorkspace')
    expect(workspace.accionPrincipal?.ruta).toBe('/planes/nuevo')
  })

  test('prioriza el trabajo asignado de un profesor', () => {
    const workspace = resolveWorkspace({
      ...base,
      rolClave: 'PROFESOR',
      roleKeys: new Set(['PROFESOR']),
      permissions: new Set(['asignaturas.ver']),
      isAdmin: false,
      asignaturas: [
        {
          id: 'asignatura-1',
          planId: 'plan-1',
          planNombre: 'Plan 2027',
          carreraNombre: 'Ingeniería de Software',
          nombre: 'Inteligencia Artificial',
          estado: 'borrador',
          actualizadoEn: '2026-09-18T00:00:00Z',
          progreso: 30,
          pendientes: [],
        },
      ],
    })

    expect(workspace.estacion).toBe('CourseWorkspace')
    expect(workspace.accionPrincipal?.ruta).toContain('asignatura-1')
  })

  test('calcula capacidades a partir de permisos efectivos', () => {
    const capabilities = buildWorkspaceCapabilities({
      ...base,
      roleKeys: new Set(['PLANEACION_CURRICULAR']),
      permissions: new Set(['planes.aprobar']),
      isAdmin: false,
    })

    expect(capabilities.puedeAprobar).toBe(true)
    expect(capabilities.puedeRevisar).toBe(true)
  })
})
