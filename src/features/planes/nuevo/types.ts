import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import type {
  NivelPlanEstudio,
  TipoCiclo,
  TipoOrigen,
} from '@/data/types/domain'

export type PlanPreview = {
  nombrePlan: string
  nivel: NivelPlanEstudio
  tipoCiclo: TipoCiclo
  numCiclos: number
  numAsignaturasAprox?: number
  secciones?: Array<{ id: string; titulo: string; resumen: string }>
}

export type LineaPlanProposal = {
  id: string
  nombre: string
  area?: string
  orden: number
  selected: boolean
  color?: string | null
}

export type NewPlanWizardState = {
  step: 1 | 2 | 3 | 4
  tipoOrigen: TipoOrigen | null
  datosBasicos: {
    nombrePlan: string
    facultad: {
      id: string
      nombre: string
    }
    carrera: {
      id: string
      nombre: string
    }
    tipoCiclo: TipoCiclo | ''
    numCiclos: number | null
    // Selección de plantillas (obligatorias)
    estructuraPlanId: string | null
    // Mes de primera generación / inicio de impartición (requerido para CURRICULAR)
    fechaInicioImparticion: string | null
    // Filtros usados en el paso de clonado interno
    facultadId?: string
    carreraId?: string
  }
  clonInterno?: {
    planOrigenId?: string | null
    planOrigenNombre?: string | null
    facultadId?: string | null
    carreraId?: string | null
    search?: string
  }
  clonTradicional?: {
    archivoPlanId?: UploadedFile | null
  }
  iaConfig?: {
    descripcionEnfoqueAcademico: string
    instruccionesAdicionalesIA?: string
    archivosReferencia: Array<string>
    repositoriosReferencia?: Array<string>
    archivosAdjuntos?: Array<UploadedFile>
    reasoningEffort?: 'auto' | 'none' | 'low' | 'medium' | 'high'
  }
  // Confirmación explícita cuando el mes de inicio de impartición es pasado
  confirmarFechaPasada?: boolean
  lineas?: Array<LineaPlanProposal>
  resumen: { previewPlan?: PlanPreview }
  isLoading: boolean
  errorMessage: string | null
}
