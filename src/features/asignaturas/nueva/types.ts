import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import type { Asignatura } from '@/data'
import type { Enums } from '@/types/supabase'

export type ModoCreacion = 'MANUAL' | 'IA' | 'CLONADO'
export type TipoAsignatura = Enums<'tipo_asignatura'>

export type TipoOrigenCreacion =
  | Asignatura['tipo_origen']
  | 'CLONADO'
  | 'IA_SIMPLE'

/**
 * Valores del formulario global del wizard "Nueva asignatura" (TanStack Form).
 *
 * Sustituye al antiguo `NewSubjectWizardState`: excluye el ui-state
 * (`step` lo gestiona el stepper, `isLoading` las mutaciones y
 * `errorMessage` los toasts / serverError efímero de `WizardControls`).
 * Los sub-objetos son no opcionales para que los nombres de campo profundos
 * (`datosBasicos.nombre`, `clonInterno.asignaturaOrigenId`, …) sean estables.
 */
export type NuevaAsignaturaFormValues = {
  plan_estudio_id: Asignatura['plan_estudio_id']
  tipoOrigen: TipoOrigenCreacion | null
  datosBasicos: {
    nombre: Asignatura['nombre']
    codigo?: Asignatura['codigo']
    tipo: Asignatura['tipo'] | null
    creditos?: Asignatura['creditos'] | null
    horasAcademicas?: Asignatura['horas_academicas'] | null
    horasIndependientes?: Asignatura['horas_independientes'] | null
    numeroCiclo: Asignatura['numero_ciclo'] | null
    lineaPlanId: Asignatura['linea_plan_id'] | null
  }
  clonInterno: {
    facultadId: string | null
    carreraId: string | null
    planOrigenId: string | null
    asignaturaOrigenId: string | null
    search: string
    page: number
  }
  clonTradicional: {
    archivosAdjuntos: Array<UploadedFile>
  }
  iaConfig: {
    descripcionEnfoqueAcademico: string
    instruccionesAdicionalesIA: string
    archivosReferencia: Array<string>
    coleccionesReferencia: Array<string>
    archivosAdjuntos: Array<UploadedFile>
    webSearchEnabled: boolean
    reasoningEffort: 'auto' | 'none' | 'low' | 'medium' | 'high'
  }
  /**
   * Contador de deduplicaciones SHA-256 en curso reportado por los dropzones.
   * No es un campo de formulario semántico, pero vive aquí porque el form es
   * el estado compartido del wizard (bloquea avanzar/crear mientras > 0).
   */
  archivosAdjuntosDedupePending: number
}
