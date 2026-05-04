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
  }
  clonInterno?: { planOrigenId: string | null }
  clonTradicional?: {
    archivoPlanId?: UploadedFile | null
  }
  iaConfig?: {
    descripcionEnfoqueAcademico: string
    instruccionesAdicionalesIA?: string
    archivosReferencia: Array<string>
    repositoriosReferencia?: Array<string>
    archivosAdjuntos?: Array<UploadedFile>
  }
  resumen: { previewPlan?: PlanPreview }
  isLoading: boolean
  errorMessage: string | null
}
