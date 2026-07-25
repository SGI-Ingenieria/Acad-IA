import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import type { AlcanceGeneracionPlan } from '@/data/api/plans.api'
import type {
  TipoCiclo,
  TipoEstructuraPlan,
  TipoOrigen,
} from '@/data/types/domain'

/**
 * Valores del formulario global del wizard "Nuevo plan" (TanStack Form).
 *
 * Sustituye al antiguo `NewPlanWizardState`: excluye el ui-state
 * (`step` lo gestiona el stepper, `isLoading` las mutaciones y
 * `errorMessage` los toasts / serverError efímero de `WizardControls`).
 * Los sub-objetos son no opcionales para que los nombres de campo profundos
 * (`datosBasicos.nombrePlan`, `clonInterno.planOrigenId`, …) sean estables.
 */
export type NuevoPlanFormValues = {
  /** Incluye 'OTRO' como estado intermedio al expandir "Clonado". */
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
    tipoEstructura: TipoEstructuraPlan | null
    // Selección de plantillas (obligatorias)
    estructuraPlanId: string | null
    // Mes de primera generación / inicio de impartición (requerido para CURRICULAR)
    fechaInicioImparticion: string | null
  }
  clonInterno: {
    planOrigenId: string | null
    planOrigenNombre: string | null
    facultadId: string | null
    carreraId: string | null
    search: string
  }
  clonTradicional: {
    archivoPlanId: UploadedFile | null
  }
  iaConfig: {
    descripcionEnfoqueAcademico: string
    instruccionesAdicionalesIA: string
    archivosReferencia: Array<string>
    coleccionesReferencia: Array<string>
    archivosAdjuntos: Array<UploadedFile>
    webSearchEnabled: boolean
    reasoningEffort: 'auto' | 'none' | 'low' | 'medium' | 'high'
    /**
     * Qué genera la IA además del plan. Vive en el formulario —y no en estado
     * local del paso— porque forma parte del borrador que se restaura cuando
     * una generación se cancela.
     */
    alcance: AlcanceGeneracionPlan
  }
  // Confirmación explícita cuando el mes de inicio de impartición es pasado
  confirmarFechaPasada: boolean
  /**
   * Contador de deduplicaciones SHA-256 en curso reportado por los dropzones.
   * No es un campo de formulario semántico, pero vive aquí porque el form es
   * el estado compartido del wizard (bloquea avanzar/crear mientras > 0).
   */
  archivosAdjuntosDedupePending: number
}
