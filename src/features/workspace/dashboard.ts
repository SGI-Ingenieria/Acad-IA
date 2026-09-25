import type {
  WorkspaceAction,
  WorkspaceAsignatura,
  WorkspaceContext,
  WorkspacePlan,
} from './types'

export type WorkspaceDashboardGroup = {
  id: string
  etiqueta: string
  completadas: number
  pendientes: number
  total: number
  porcentaje: number
}

export type WorkspaceDashboardSummary = {
  completadas: number
  pendientes: number
  total: number
  porcentaje: number
  grupos: Array<WorkspaceDashboardGroup>
}

export type WorkspacePlanActionGroup = {
  id: string
  planId: string | null
  planNombre: string
  carreraNombre: string | null
  acciones: Array<WorkspaceAction>
}

export type WorkspacePlanSubjectGroup = {
  id: string
  planId: string
  planNombre: string
  carreraNombre: string
  asignaturas: Array<WorkspaceAsignatura>
}

function porcentaje(completadas: number, total: number) {
  return total === 0 ? 100 : Math.round((completadas / total) * 100)
}

export function buildWorkspaceDashboard(
  workspace: WorkspaceContext,
): WorkspaceDashboardSummary {
  const esProfesor = workspace.estacion === 'CourseWorkspace'
  const fuentes = esProfesor
    ? workspace.asignaturas.map((asignatura) => ({
        id: asignatura.planId,
        etiqueta: asignatura.planNombre,
        completadas: asignatura.progreso,
        total: 100,
      }))
    : workspace.planes.map((plan) => ({
        id: plan.carreraId,
        etiqueta: plan.carreraNombre,
        completadas: plan.asignaturasCompletas,
        total: plan.asignaturasTotal,
      }))

  const grupos = Array.from(
    fuentes
      .reduce((result, fuente) => {
        const actual = result.get(fuente.id) ?? {
          id: fuente.id,
          etiqueta: fuente.etiqueta,
          completadas: 0,
          total: 0,
        }
        actual.completadas += fuente.completadas
        actual.total += fuente.total
        result.set(fuente.id, actual)
        return result
      }, new Map<string, { id: string; etiqueta: string; completadas: number; total: number }>())
      .values(),
  )
    .map((group) => ({
      ...group,
      pendientes: Math.max(group.total - group.completadas, 0),
      porcentaje: porcentaje(group.completadas, group.total),
    }))
    .sort((left, right) => left.porcentaje - right.porcentaje)

  const completadas = workspace.progreso.completadas
  const total = workspace.progreso.total

  return {
    completadas,
    pendientes: workspace.progreso.pendientes,
    total,
    porcentaje: workspace.progreso.porcentaje,
    grupos,
  }
}

export function groupActionsByPlan(
  actions: Array<WorkspaceAction>,
  plans: Array<WorkspacePlan>,
): Array<WorkspacePlanActionGroup> {
  const plansById = new Map(plans.map((plan) => [plan.id, plan]))
  const groups = new Map<string, WorkspacePlanActionGroup>()

  for (const action of actions) {
    const routePlanId = action.ruta.match(/^\/planes\/([^/]+)/)?.[1]
    const planId = action.planId ?? routePlanId ?? null
    const plan = planId ? plansById.get(planId) : undefined
    const id = planId ?? `sin-plan:${action.id}`
    const group = groups.get(id)

    if (group) {
      group.acciones.push(action)
      continue
    }

    groups.set(id, {
      id,
      planId,
      planNombre:
        plan?.nombre ??
        action.planNombre ??
        (action.tipo === 'REVISION'
          ? action.titulo
          : planId
            ? `Plan ${planId.slice(0, 8)}`
            : 'Plan sin identificar'),
      carreraNombre: plan?.carreraNombre ?? action.carreraNombre ?? null,
      acciones: [action],
    })
  }

  return Array.from(groups.values()).sort((left, right) =>
    left.planNombre.localeCompare(right.planNombre, 'es'),
  )
}

export function groupSubjectsByPlan(
  asignaturas: Array<WorkspaceAsignatura>,
): Array<WorkspacePlanSubjectGroup> {
  const groups = new Map<string, WorkspacePlanSubjectGroup>()

  for (const asignatura of asignaturas) {
    const group = groups.get(asignatura.planId)
    if (group) {
      group.asignaturas.push(asignatura)
      continue
    }

    groups.set(asignatura.planId, {
      id: asignatura.planId,
      planId: asignatura.planId,
      planNombre: asignatura.planNombre,
      carreraNombre: asignatura.carreraNombre,
      asignaturas: [asignatura],
    })
  }

  return Array.from(groups.values()).sort((left, right) =>
    left.planNombre.localeCompare(right.planNombre, 'es'),
  )
}
