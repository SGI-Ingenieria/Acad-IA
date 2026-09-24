import type { AppPermission } from '@/data/auth/permissions'

export type WorkspaceStation =
  | 'CreateWorkspace'
  | 'DesignWorkspace'
  | 'ReviewWorkspace'
  | 'WaitingWorkspace'
  | 'CourseWorkspace'
  | 'FacultyWorkspace'
  | 'InstitutionWorkspace'
  | 'PlanningWorkspace'
  | 'ExternalReviewWorkspace'

export type WorkspaceEntityType =
  | 'institucion'
  | 'facultad'
  | 'carrera'
  | 'plan'
  | 'asignatura'
  | 'tarea'

export type WorkspaceSeverity = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA'

export type WorkspaceCapability = {
  puedeCrearPlan: boolean
  puedeEditarPlan: boolean
  puedeEditarAsignatura: boolean
  puedeRevisar: boolean
  puedeAprobar: boolean
  puedeAsignarResponsables: boolean
  puedeUsarIA: boolean
}

export type WorkspacePlan = {
  id: string
  nombre: string
  carreraId: string
  carreraNombre: string
  facultadId: string
  facultadNombre: string
  estadoClave: string | null
  estadoEtiqueta: string | null
  faseDiseno: 'FUNDAMENTOS' | 'BLOQUES' | 'MAPA'
  actualizadoEn: string
  asignaturasTotal: number
  asignaturasCompletas: number
  asignaturasPendientes: number
  asignaturasSinResponsable: number
  comentariosPendientes: number
  bloqueos: number
}

export type WorkspaceAsignatura = {
  id: string
  planId: string
  planNombre: string
  carreraNombre: string
  nombre: string
  estado: string
  actualizadoEn: string
  progreso: number
  pendientes: Array<WorkspaceFinding>
}

export type WorkspaceFinding = {
  id: string
  entidad: WorkspaceEntityType
  entidadId: string
  titulo: string
  detalle: string
  severidad: WorkspaceSeverity
  estado: string
  permiso: AppPermission | null
  ruta: string
  nivelDrilldown: number
}

export type WorkspaceAction = WorkspaceFinding & {
  tipo: 'PENDIENTE' | 'REVISION' | 'BLOQUEO' | 'TAREA'
  planId?: string
  asignaturaId?: string
  fechaLimite?: string | null
}

export type WorkspaceIndicator = {
  id: string
  titulo: string
  valor: number
  detalle: string
  entidad: WorkspaceEntityType
  nivelDrilldown: number
  ruta: string
  severidad?: WorkspaceSeverity
}

export type WorkspaceContext = {
  usuarioId: string
  rolClave: string
  alcance: {
    facultadId?: string
    carreraId?: string
    asignaturaId?: string
  }
  capacidades: WorkspaceCapability
  estacion: WorkspaceStation
  titulo: string
  accionPrincipal: {
    etiqueta: string
    ruta: string
  } | null
  planes: Array<WorkspacePlan>
  asignaturas: Array<WorkspaceAsignatura>
  accionesPendientes: Array<WorkspaceAction>
  indicadores: Array<WorkspaceIndicator>
}
