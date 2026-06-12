import type { Enums } from './supabase'

export type AsignaturaTab =
  | 'datos-generales'
  | 'contenido-tematico'
  | 'bibliografia'
  | 'ia-asignatura'
  | 'documento-sep'
  | 'historial'

export interface Asignatura {
  id: string
  nombre: string
  clave: string
  creditos?: number
  lineaCurricular?: string
  ciclo?: string
  planId: string
  planNombre: string
  carrera: string
  facultad: string
  estructuraId: string
}

export interface CampoEstructura {
  id: string
  nombre: string
  tipo: 'texto' | 'texto_largo' | 'lista' | 'numero'
  obligatorio: boolean
  descripcion?: string
  placeholder?: string
}

export interface AsignaturaStructure {
  id: string
  nombre: string
  campos: Array<CampoEstructura>
}

export interface Tema {
  id: string
  nombre: string
  descripcion?: string
  horasEstimadas?: number
}

export interface UnidadTematica {
  id: string
  nombre: string
  numero: number
  temas: Array<Tema>
}

export interface BibliografiaEntry {
  id: string
  tipo: Enums<'tipo_bibliografia'>
  cita: string
  fuenteBibliotecaId?: string
  fuenteBiblioteca?: LibraryResource
}

export interface LibraryResource {
  id: string
  titulo: string
  autor: string
  editorial?: string
  anio?: number
  isbn?: string
  tipo: 'libro' | 'articulo' | 'revista' | 'recurso_digital'
  disponible: boolean
}

export interface IAMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  campoAfectado?: string
  sugerencia?: IASugerencia
}

export interface IASugerencia {
  campoId: string
  campoKey: string
  campoNombre: string
  valorActual: string
  valorSugerido: string
  messageId: string
  aceptada?: boolean
}

export interface CambioAsignatura {
  id: string
  tipo: 'datos' | 'contenido' | 'bibliografia' | 'ia' | 'documento'
  descripcion: string
  usuario: string
  fecha: Date
  detalles?: Record<string, any>
}

export interface DocumentoAsignatura {
  id: string
  asignaturaId: string
  version: number
  fechaGeneracion: Date
  url?: string
  estado: 'generando' | 'listo' | 'error'
}

export interface AsignaturaDetailState {
  asignatura: Asignatura | null
  estructura: AsignaturaStructure | null
  datosGenerales: Record<string, any>
  contenidoTematico: Array<UnidadTematica>
  bibliografia: Array<BibliografiaEntry>
  iaMessages: Array<IAMessage>
  documentoSep: DocumentoAsignatura | null
  historial: Array<CambioAsignatura>
  activeTab: AsignaturaTab
  isSaving: boolean
  isLoading: boolean
  errorMessage: string | null
}
