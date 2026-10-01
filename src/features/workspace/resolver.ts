import type {
  WorkspaceCapability,
  WorkspaceContext,
  WorkspaceStation,
} from './types'
import type { AppPermission } from '@/data/auth/permissions'


export type WorkspaceResolverInput = Omit<
  WorkspaceContext,
  'estacion' | 'titulo' | 'accionPrincipal'
> & {
  roleKeys: Set<string>
  permissions: Set<string>
  isAdmin: boolean
}

const hasPermission = (
  input: WorkspaceResolverInput,
  permission: AppPermission,
) => input.isAdmin || input.permissions.has(permission)

export function buildWorkspaceCapabilities(
  input: WorkspaceResolverInput,
): WorkspaceCapability {
  return {
    puedeCrearPlan: hasPermission(input, 'planes.crear'),
    puedeEditarPlan: hasPermission(input, 'planes.editar'),
    puedeEditarAsignatura: hasPermission(input, 'asignaturas.editar'),
    puedeRevisar:
      hasPermission(input, 'planes.aprobar') ||
      hasPermission(input, 'evaluaciones.comentar') ||
      input.roleKeys.has('PLANEACION_CURRICULAR') ||
      input.roleKeys.has('SECRETARIO_ACADEMICO'),
    puedeAprobar: hasPermission(input, 'planes.aprobar'),
    puedeAsignarResponsables: hasPermission(
      input,
      'asignaturas.responsables.gestionar',
    ),
    puedeUsarIA: hasPermission(input, 'ia.usar'),
  }
}

function firstAction(input: WorkspaceResolverInput) {
  return [...input.accionesPendientes]
    .sort((a, b) => {
      const rank = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 }
      return rank[a.severidad] - rank[b.severidad]
    })
    .at(0)
}

function stationForRole(input: WorkspaceResolverInput): WorkspaceStation {
  const role = input.rolClave
  const action = firstAction(input)

  if (role === 'EVALUADOR_EXTERNO') return 'ExternalReviewWorkspace'
  if (role === 'PROFESOR') return 'CourseWorkspace'
  if (
    ['SECRETARIO_ACADEMICO', 'PLANEACION_CURRICULAR'].includes(role) &&
    action
  ) {
    return role === 'PLANEACION_CURRICULAR'
      ? 'PlanningWorkspace'
      : 'ReviewWorkspace'
  }
  if (['VICERRECTOR_ACADEMICO', 'ADMIN'].includes(role)) {
    return 'InstitutionWorkspace'
  }
  if (role === 'DIRECTOR_FACULTAD') return 'FacultyWorkspace'
  if (
    ['JEFE_CARRERA', 'JEFE_POSGRADO'].includes(role) &&
    input.planes.length === 0
  ) {
    return 'CreateWorkspace'
  }
  if (
    ['JEFE_CARRERA', 'JEFE_POSGRADO'].includes(role) &&
    input.planes.some((plan) =>
      ['REVISION', 'REV_PLANEACION', 'REV_VICERRECTORIA'].includes(
        plan.estadoClave ?? '',
      ),
    )
  ) {
    return 'WaitingWorkspace'
  }
  return 'DesignWorkspace'
}

function stationCopy(
  station: WorkspaceStation,
  input: WorkspaceResolverInput,
): Pick<WorkspaceContext, 'titulo' | 'accionPrincipal'> {
  const action = firstAction(input)
  if (action) {
    return {
      titulo: action.titulo,
      accionPrincipal: { etiqueta: 'Atender pendiente', ruta: action.ruta },
    }
  }

  switch (station) {
    case 'CreateWorkspace':
      return {
        titulo: 'Prepara tu próximo plan de estudios',
        accionPrincipal: input.capacidades.puedeCrearPlan
          ? { etiqueta: 'Crear plan de estudios', ruta: '/planes/nuevo' }
          : null,
      }
    case 'CourseWorkspace':
      return {
        titulo: 'Continúa desarrollando tus asignaturas',
        accionPrincipal: input.asignaturas.at(0)
          ? {
              etiqueta: 'Continuar asignatura',
              ruta: `/planes/${input.asignaturas[0].planId}/asignaturas/${input.asignaturas[0].id}`,
            }
          : null,
      }
    case 'InstitutionWorkspace':
      return {
        titulo: 'Estado institucional y excepciones',
        accionPrincipal: null,
      }
    case 'FacultyWorkspace':
      return { titulo: 'Estado de tu facultad', accionPrincipal: null }
    case 'PlanningWorkspace':
      return {
        titulo: 'Planes que requieren análisis curricular',
        accionPrincipal: null,
      }
    case 'ExternalReviewWorkspace':
      return {
        titulo: 'Revisiones que requieren tu opinión',
        accionPrincipal: null,
      }
    case 'ReviewWorkspace':
      return {
        titulo: 'Propuestas que esperan una decisión',
        accionPrincipal: null,
      }
    case 'WaitingWorkspace':
      return {
        titulo: 'Trabajo en espera de otra etapa',
        accionPrincipal: null,
      }
    default:
      return { titulo: 'Continúa el diseño curricular', accionPrincipal: null }
  }
}

export function resolveWorkspace(
  input: WorkspaceResolverInput,
): WorkspaceContext {
  const estacion = stationForRole(input)
  return {
    ...input,
    capacidades: input.capacidades,
    estacion,
    ...stationCopy(estacion, input),
  }
}
