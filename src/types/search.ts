export type PlanesListaSearch = {
  facultad: string
  carrera: string
  estado: string
  nivel: string
  page: number
}

export const defaultPlanesSearch: PlanesListaSearch = {
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

export type HistorialSearch = {
  page: number
}

export const defaultHistorialSearch: HistorialSearch = {
  page: 0,
}

export type UsuariosSearch = {
  vista: 'lista' | 'jerarquia'
}

export const defaultUsuariosSearch: UsuariosSearch = {
  vista: 'lista',
}
