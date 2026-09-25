import { describe, expect, test } from 'bun:test'

import {
  buildWorkspaceDashboard,
  groupActionsByPlan,
  groupSubjectsByPlan,
} from './dashboard'

import type { WorkspacePlan } from './types'

const base = {
  usuarioId: 'user-1',
  rolClave: 'JEFE_CARRERA',
  alcance: {},
  capacidades: {
    puedeCrearPlan: true,
    puedeEditarPlan: true,
    puedeEditarAsignatura: true,
    puedeRevisar: false,
    puedeAprobar: false,
    puedeAsignarResponsables: true,
    puedeUsarIA: true,
  },
  titulo: 'Trabajo',
  accionPrincipal: null,
  asignaturas: [],
  accionesPendientes: [],
  indicadores: [],
  progreso: { completadas: 7, pendientes: 3, total: 10, porcentaje: 70 },
}

function plan(
  id: string,
  nombre: string,
  carreraNombre: string,
): WorkspacePlan {
  return {
    id,
    nombre,
    carreraId: `carrera-${id}`,
    carreraNombre,
    facultadId: 'facultad-1',
    facultadNombre: 'Facultad',
    estadoClave: null,
    estadoEtiqueta: null,
    faseDiseno: 'MAPA',
    actualizadoEn: '',
    asignaturasTotal: 0,
    asignaturasCompletas: 0,
    asignaturasPendientes: 0,
    asignaturasSinResponsable: 0,
    comentariosPendientes: 0,
    bloqueos: 0,
  }
}

describe('buildWorkspaceDashboard', () => {
  test('agrega el avance de planes por carrera', () => {
    const dashboard = buildWorkspaceDashboard({
      ...base,
      estacion: 'DesignWorkspace',
      planes: [
        {
          id: 'plan-1',
          nombre: 'Plan de Ingeniería',
          carreraId: 'carrera-1',
          carreraNombre: 'Ingeniería',
          facultadId: 'facultad-1',
          facultadNombre: 'Facultad',
          estadoClave: null,
          estadoEtiqueta: null,
          faseDiseno: 'MAPA',
          actualizadoEn: '',
          asignaturasTotal: 10,
          asignaturasCompletas: 7,
          asignaturasPendientes: 3,
          asignaturasSinResponsable: 0,
          comentariosPendientes: 0,
          bloqueos: 0,
        },
      ],
    })

    expect(dashboard.porcentaje).toBe(70)
    expect(dashboard.pendientes).toBe(3)
    expect(dashboard.grupos[0]?.etiqueta).toBe('Ingeniería')
  })

  test('mide el avance propio del profesor por asignatura', () => {
    const dashboard = buildWorkspaceDashboard({
      ...base,
      estacion: 'CourseWorkspace',
      planes: [],
      progreso: {
        completadas: 150,
        pendientes: 50,
        total: 200,
        porcentaje: 75,
      },
      asignaturas: [
        {
          id: 'a-1',
          planId: 'plan-1',
          planNombre: 'Plan A',
          carreraNombre: 'Ingeniería',
          nombre: 'Materia',
          estado: 'borrador',
          actualizadoEn: '',
          progreso: 50,
          pendientes: [],
        },
        {
          id: 'a-2',
          planId: 'plan-1',
          planNombre: 'Plan A',
          carreraNombre: 'Ingeniería',
          nombre: 'Materia 2',
          estado: 'activo',
          actualizadoEn: '',
          progreso: 100,
          pendientes: [],
        },
      ],
    })

    expect(dashboard.porcentaje).toBe(75)
    expect(dashboard.pendientes).toBe(50)
    expect(dashboard.grupos).toHaveLength(1)
  })

  test('agrupa los pendientes bajo su plan sin mezclar asignaturas', () => {
    const actions = [
      {
        id: 'a-1',
        entidad: 'asignatura' as const,
        entidadId: 'a-1',
        titulo: 'Matemáticas',
        detalle: 'Sin contenido',
        severidad: 'ALTA' as const,
        estado: 'borrador',
        permiso: 'asignaturas.editar' as const,
        ruta: '/planes/p1/asignaturas/a-1/contenido',
        nivelDrilldown: 4,
        tipo: 'PENDIENTE' as const,
        planId: 'p1',
        asignaturaId: 'a-1',
      },
      {
        id: 'a-2',
        entidad: 'asignatura' as const,
        entidadId: 'a-2',
        titulo: 'Programación',
        detalle: 'Sin contenido',
        severidad: 'ALTA' as const,
        estado: 'borrador',
        permiso: 'asignaturas.editar' as const,
        ruta: '/planes/p1/asignaturas/a-2/contenido',
        nivelDrilldown: 4,
        tipo: 'PENDIENTE' as const,
        planId: 'p1',
        asignaturaId: 'a-2',
      },
      {
        id: 'a-3',
        entidad: 'asignatura' as const,
        entidadId: 'a-3',
        titulo: 'Física',
        detalle: 'Sin contenido',
        severidad: 'ALTA' as const,
        estado: 'borrador',
        permiso: 'asignaturas.editar' as const,
        ruta: '/planes/p2/asignaturas/a-3/contenido',
        nivelDrilldown: 4,
        tipo: 'PENDIENTE' as const,
        planId: 'p2',
        asignaturaId: 'a-3',
      },
    ]
    const plans = [
      plan('p1', 'Plan 2026', 'Ingeniería'),
      plan('p2', 'Plan 2027', 'Ciencias'),
    ]

    const groups = groupActionsByPlan(actions, plans)

    expect(groups).toHaveLength(2)
    expect(
      groups.find((group) => group.planId === 'p1')?.acciones,
    ).toHaveLength(2)
    expect(
      groups.find((group) => group.planId === 'p2')?.acciones,
    ).toHaveLength(1)
  })

  test('agrupa las asignaturas del selector del profesor por plan', () => {
    const groups = groupSubjectsByPlan([
      {
        id: 'a-1',
        planId: 'p1',
        planNombre: 'Plan A',
        carreraNombre: 'Ingeniería',
        nombre: 'Cálculo',
        estado: 'borrador',
        actualizadoEn: '',
        progreso: 30,
        pendientes: [],
      },
      {
        id: 'a-2',
        planId: 'p1',
        planNombre: 'Plan A',
        carreraNombre: 'Ingeniería',
        nombre: 'Álgebra',
        estado: 'borrador',
        actualizadoEn: '',
        progreso: 50,
        pendientes: [],
      },
      {
        id: 'a-3',
        planId: 'p2',
        planNombre: 'Plan B',
        carreraNombre: 'Ciencias',
        nombre: 'Física',
        estado: 'borrador',
        actualizadoEn: '',
        progreso: 20,
        pendientes: [],
      },
    ])

    expect(groups).toHaveLength(2)
    expect(
      groups.find((group) => group.planId === 'p1')?.asignaturas,
    ).toHaveLength(2)
    expect(
      groups.find((group) => group.planId === 'p2')?.asignaturas,
    ).toHaveLength(1)
  })

  test('usa el nombre del pendiente si su plan no está en el resumen', () => {
    const [group] = groupActionsByPlan(
      [
        {
          id: 'a-1',
          entidad: 'asignatura',
          entidadId: 'a-1',
          titulo: 'Matemáticas',
          detalle: 'Sin responsable',
          severidad: 'ALTA',
          estado: 'borrador',
          permiso: 'asignaturas.responsables.gestionar',
          ruta: '/planes/p1/asignaturas/a-1/responsables',
          nivelDrilldown: 4,
          tipo: 'BLOQUEO',
          planId: 'p1',
          planNombre: 'Plan de Ingeniería Química',
          carreraNombre: 'Ingeniería Química',
        },
      ],
      [],
    )

    expect(group.planNombre).toBe('Plan de Ingeniería Química')
    expect(group.carreraNombre).toBe('Ingeniería Química')
  })
})
