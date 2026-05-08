import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import type { Asignatura } from '@/data'

export type ModoCreacion = 'MANUAL' | 'IA' | 'CLONADO'
export type TipoAsignatura = 'OBLIGATORIA' | 'OPTATIVA' | 'TRONCAL' | 'OTRO'

export type AsignaturaPreview = {
  nombre: string
  objetivo: string
  unidades: number
  bibliografiaCount: number
}

export type DataAsignaturaSugerida = {
  nombre: Asignatura['nombre']
  codigo?: Asignatura['codigo']
  tipo: Asignatura['tipo'] | null
  creditos: Asignatura['creditos'] | null
  horasAcademicas?: number | null
  horasIndependientes?: number | null
  descripcion: string
}

export type AsignaturaSugerida = {
  id: string
  selected: boolean
  source: 'IA' | 'MANUAL' | 'CLON'
  linea_plan_id: string | null
  numero_ciclo: number | null
} & DataAsignaturaSugerida

export type NewSubjectWizardState = {
  step: 1 | 2 | 3 | 4
  plan_estudio_id: Asignatura['plan_estudio_id']
  estructuraId: Asignatura['estructura_id'] | null
  tipoOrigen:
    | Asignatura['tipo_origen']
    | 'CLONADO'
    | 'IA_SIMPLE'
    | 'IA_MULTIPLE'
    | null
  datosBasicos: {
    nombre: Asignatura['nombre']
    codigo?: Asignatura['codigo']
    tipo: Asignatura['tipo'] | null
    creditos: Asignatura['creditos'] | null
    horasAcademicas?: Asignatura['horas_academicas'] | null
    horasIndependientes?: Asignatura['horas_independientes'] | null
    estructuraId: Asignatura['estructura_id'] | null
  }
  sugerencias: Array<AsignaturaSugerida>
  clonInterno?: {
    facultadId?: string | null
    carreraId?: string | null
    planOrigenId?: string | null
    asignaturaOrigenId?: string | null
    search?: string
    page?: number
  }
  clonTradicional?: {
    archivosAdjuntos: Array<UploadedFile>
  }
  iaConfig?: {
    descripcionEnfoqueAcademico: string
    instruccionesAdicionalesIA: string
    archivosReferencia: Array<string>
    repositoriosReferencia?: Array<string>
    archivosAdjuntos?: Array<UploadedFile>
  }
  iaMultiple?: {
    enfoque: string
    cantidadDeSugerencias: number
    isLoading: boolean
  }
  resumen: {
    previewAsignatura?: AsignaturaPreview
  }
  archivosAdjuntosDedupePending?: number
  isLoading: boolean
  errorMessage: string | null
}
