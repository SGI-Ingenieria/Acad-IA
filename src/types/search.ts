import type { OrdenBiblioteca } from '@/data/api/documentos.api'

export type ReferenciasSearch = {
  q: string
  tab: 'todo' | 'imagenes' | 'archivos'
  orden: OrdenBiblioteca
  coleccion: string
}

export const defaultReferenciasSearch: ReferenciasSearch = {
  q: '',
  tab: 'todo',
  orden: 'updated_desc',
  coleccion: '',
}

export type PlanesListaSearch = {
  q: string
  facultad: string
  carrera: string
  estado: string
  nivel: string
  tipo: 'todos' | 'CURRICULAR' | 'NO_CURRICULAR'
  version: 'actuales' | 'antecedentes' | 'todos'
  orden: 'creado_desc' | 'actualizado_desc' | 'nombre_asc' | 'nombre_desc'
}

export const defaultPlanesSearch: PlanesListaSearch = {
  q: '',
  facultad: 'todas',
  carrera: 'todas',
  estado: 'todos',
  nivel: 'todos',
  tipo: 'todos',
  version: 'actuales',
  orden: 'creado_desc',
}

export type AsignaturasSearch = {
  q: string
  archivo: 'activas' | 'archivadas'
  tipo: string
  estado: string
  linea: string
  orden:
    | 'curricular'
    | 'actualizado_desc'
    | 'nombre_asc'
    | 'nombre_desc'
    | 'creditos_desc'
}

export const defaultAsignaturasSearch: AsignaturasSearch = {
  q: '',
  archivo: 'activas',
  tipo: 'all',
  estado: 'all',
  linea: 'all',
  orden: 'curricular',
}

export type CatalogoAsignaturasSearch = {
  q: string
  facultad: string
  carrera: string
  plan: string
  tipo: string
  estado: string
  incluirArchivadas: boolean
  orden:
    | 'relevancia'
    | 'curricular'
    | 'nombre_asc'
    | 'nombre_desc'
    | 'ciclo_asc'
    | 'creditos_desc'
}

export const defaultCatalogoAsignaturasSearch: CatalogoAsignaturasSearch = {
  q: '',
  facultad: 'todas',
  carrera: 'todas',
  plan: 'todos',
  tipo: 'all',
  estado: 'all',
  incluirArchivadas: false,
  orden: 'relevancia',
}

// Grupos de historial del plan, en orden canónico. El orden importa: los
// params de URL se normalizan a este orden para que stripSearchParams pueda
// comparar contra el default (todos seleccionados) por igualdad profunda.
export const HISTORIAL_PLAN_GRUPOS = [
  'datos_basicos_plan',
  'detalles_plan',
  'estructura_plan',
  'mapa_curricular',
  'cambios_asignatura',
  'transiciones',
] as const

export type HistorialPlanGrupo = (typeof HISTORIAL_PLAN_GRUPOS)[number]

export type HistorialSearch = {
  page: number
  grupos: Array<HistorialPlanGrupo>
  q: string
  orden: 'reciente' | 'antiguo'
}

export const defaultHistorialSearch: HistorialSearch = {
  page: 0,
  grupos: [...HISTORIAL_PLAN_GRUPOS],
  q: '',
  orden: 'reciente',
}

// Grupos del historial de una asignatura (claves de `tipoConfig` en
// HistorialTab), en orden canónico por la misma razón que arriba.
export const ASIGNATURA_HISTORIAL_GRUPOS = [
  'datos',
  'mapa',
  'revision',
  'contenido',
  'bibliografia',
  'ia',
  'documento',
] as const

export type AsignaturaHistorialGrupo =
  (typeof ASIGNATURA_HISTORIAL_GRUPOS)[number]

export type AsignaturaHistorialSearch = {
  grupos: Array<AsignaturaHistorialGrupo>
  q: string
  orden: 'reciente' | 'antiguo'
}

export const defaultAsignaturaHistorialSearch: AsignaturaHistorialSearch = {
  grupos: [...ASIGNATURA_HISTORIAL_GRUPOS],
  q: '',
  orden: 'reciente',
}

export type UsuariosSearch = {
  vista: 'lista' | 'jerarquia'
  q: string
  filtro: 'todos' | 'internos' | 'externos' | 'inactivos'
  orden: 'nombre_asc' | 'nombre_desc' | 'creado_desc' | 'actualizado_desc'
  // Id del usuario abierto en el panel de detalle ('' = cerrado).
  detalle: string
}

export const defaultUsuariosSearch: UsuariosSearch = {
  vista: 'lista',
  q: '',
  filtro: 'todos',
  orden: 'nombre_asc',
  detalle: '',
}

export type RegistrosOficialesSearch = {
  q: string
  orden: 'aprobacion_desc' | 'aprobacion_asc' | 'nombre_asc' | 'nombre_desc'
}

export const defaultRegistrosOficialesSearch: RegistrosOficialesSearch = {
  q: '',
  orden: 'aprobacion_desc',
}

// `desglose` es opcional en el tipo para que navegar a las rutas del detalle
// del plan no exija `search`; el default se aplica al consumir.
// `creditos` abre el diálogo de desglose de créditos del layout del detalle;
// vive en la URL para poder abrirlo desde cualquier ruta hija (p. ej. el mapa).
export type PlanDetalleSearch = {
  desglose?: 'ciclo' | 'linea'
  creditos?: boolean
}

export const defaultPlanDetalleSearch: PlanDetalleSearch = {
  desglose: 'ciclo',
  creditos: false,
}
