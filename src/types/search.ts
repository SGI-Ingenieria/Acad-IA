import type { OrdenBiblioteca } from '@/data/api/documentos.api'

export type ReferenciasSearch = {
  q: string
  tab: 'todo' | 'imagenes' | 'archivos'
  modo: 'grid' | 'lista'
  orden: OrdenBiblioteca
  coleccion: string
}

export const defaultReferenciasSearch: ReferenciasSearch = {
  q: '',
  tab: 'todo',
  modo: 'lista',
  orden: 'updated_desc',
  coleccion: '',
}

export type PlanesListaSearch = {
  q: string
  facultad: string
  carrera: string
  estado: string
  nivel: string
  page: number
}

export const defaultPlanesSearch: PlanesListaSearch = {
  q: '',
  facultad: 'todas',
  carrera: 'todas',
  estado: 'todos',
  nivel: 'todos',
  page: 0,
}

export type AsignaturasSearch = {
  q: string
  tipo: string
  estado: string
  linea: string
}

export const defaultAsignaturasSearch: AsignaturasSearch = {
  q: '',
  tipo: 'all',
  estado: 'all',
  linea: 'all',
}

export type CatalogoAsignaturasSearch = {
  q: string
  facultad: string
  carrera: string
  plan: string
  tipo: string
  estado: string
  incluirArchivadas: boolean
  page: number
}

export const defaultCatalogoAsignaturasSearch: CatalogoAsignaturasSearch = {
  q: '',
  facultad: 'todas',
  carrera: 'todas',
  plan: 'todos',
  tipo: 'all',
  estado: 'all',
  incluirArchivadas: false,
  page: 0,
}

export type ArchivadasSearch = {
  q: string
  tipo: string
}

export const defaultArchivadasSearch: ArchivadasSearch = {
  q: '',
  tipo: 'all',
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
}

export const defaultHistorialSearch: HistorialSearch = {
  page: 0,
  grupos: [...HISTORIAL_PLAN_GRUPOS],
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
}

export const defaultAsignaturaHistorialSearch: AsignaturaHistorialSearch = {
  grupos: [...ASIGNATURA_HISTORIAL_GRUPOS],
}

export type UsuariosSearch = {
  vista: 'lista' | 'jerarquia'
  q: string
  filtro: 'todos' | 'internos' | 'externos' | 'inactivos'
  // Id del usuario abierto en el panel de detalle ('' = cerrado).
  detalle: string
}

export const defaultUsuariosSearch: UsuariosSearch = {
  vista: 'lista',
  q: '',
  filtro: 'todos',
  detalle: '',
}

export type RegistrosOficialesSearch = {
  q: string
}

export const defaultRegistrosOficialesSearch: RegistrosOficialesSearch = {
  q: '',
}

// `desglose` es opcional en el tipo para que navegar a las rutas del detalle
// del plan no exija `search`; el default se aplica al consumir.
export type PlanDetalleSearch = {
  desglose?: 'ciclo' | 'linea'
}

export const defaultPlanDetalleSearch: PlanDetalleSearch = {
  desglose: 'ciclo',
}
