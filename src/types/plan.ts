import type { Enums, Tables } from './supabase'

// PlanStatus no es un enum de la base de datos (los estados viven en la tabla
// dinámica `estados_plan`), por eso se mantiene como unión literal local.
export type PlanStatus =
  | 'borrador'
  | 'revision'
  | 'expertos'
  | 'consejo'
  | 'aprobado'
  | 'rechazado'

// Nivel académico del plan: derivado del enum generado por Supabase.
export type TipoPlan = Enums<'nivel_plan_estudio'>

export type TipoAsignatura = Tables<'asignaturas'>['tipo']

export type AsignaturaStatus = Tables<'asignaturas'>['estado']

export interface Facultad {
  id: string
  nombre: string
  color: string
  icono: string
}

export interface Carrera {
  id: string
  nombre: string
  facultadId: string
}

export type LineaCurricular = Tables<'lineas_plan'>

export interface Asignatura {
  id: string
  clave: string
  nombre: string
  creditos: number
  ciclo: number | null
  lineaCurricularId: string | null
  tipo: TipoAsignatura
  estado: AsignaturaStatus
  orden?: number
  hd: number // <--- Añadir
  hi: number // <--- Añadir
  prerrequisito_asignatura_id: string | null
}

export interface Plan {
  id: string
  nombre: string
  carrera: Carrera
  facultad: Facultad
  tipoPlan: TipoPlan
  nivel?: string
  modalidad?: string
  duracionCiclos: number
  creditosTotales: number
  fechaCreacion: string
  estadoActual: PlanStatus
}

export type DatosGeneralesField = {
  id: string
  label: string
  helperText?: string
  holder?: string
  value: string
  requerido: boolean
  tipo: 'texto' | 'parrafo' | 'lista' | 'number' | 'select'
  opciones?: Array<string>
}

export interface CambioPlan {
  id: string
  fecha: string
  usuario: string
  tab: string
  descripcion: string
  detalle?: string
}

export interface ComentarioFlujo {
  id: string
  usuario: string
  fecha: string
  texto: string
  fase: PlanStatus
}

export interface DocumentoPlan {
  id: string
  fechaGeneracion: string
  version: number
  url?: string
}

export type PlanTab =
  | 'datos-generales'
  | 'mapa-curricular'
  | 'asignaturas'
  | 'flujo'
  | 'ia'
  | 'documento'
  | 'historial'
