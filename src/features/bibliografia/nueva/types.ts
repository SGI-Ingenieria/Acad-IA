import type {
  EndpointResult,
  GoogleBooksVolume,
  OpenLibraryDoc,
} from '@/data/api/subjects.api'
import type { TablesInsert } from '@/types/supabase'

export type MetodoBibliografia = 'MANUAL' | 'BUSCAR' | null

export type FuenteBusquedaBibliografia = 'EN_LINEA' | 'BIBLIOTECA'

export type FormatoCita = 'apa' | 'ieee' | 'vancouver' | 'chicago'

export type IdiomaBibliografia =
  | 'ALL'
  | 'ES'
  | 'EN'
  | 'DE'
  | 'ZH'
  | 'FR'
  | 'IT'
  | 'JA'
  | 'RU'

export const IDIOMA_LABEL: Record<IdiomaBibliografia, string> = {
  ALL: 'Todos',
  ES: 'Español',
  EN: 'Inglés',
  DE: 'Alemán',
  ZH: 'Chino',
  FR: 'Francés',
  IT: 'Italiano',
  JA: 'Japonés',
  RU: 'Ruso',
}

export const IDIOMA_TO_GOOGLE: Record<IdiomaBibliografia, string | undefined> =
  {
    ALL: undefined,
    ES: 'es',
    EN: 'en',
    DE: 'de',
    ZH: 'zh',
    FR: 'fr',
    IT: 'it',
    JA: 'ja',
    RU: 'ru',
  }

// ISO 639-2 (bibliographic codes) commonly used by Open Library.
export const IDIOMA_TO_OPEN_LIBRARY: Record<
  IdiomaBibliografia,
  string | undefined
> = {
  ALL: undefined,
  ES: 'spa',
  EN: 'eng',
  DE: 'ger',
  ZH: 'chi',
  FR: 'fre',
  IT: 'ita',
  JA: 'jpn',
  RU: 'rus',
}

export const MIN_YEAR = 1450
export const MAX_YEAR = new Date().getFullYear() + 1

export type BibliografiaAsignaturaInsert =
  TablesInsert<'bibliografia_asignatura'>
export type BibliografiaTipo = BibliografiaAsignaturaInsert['tipo']

export type BibliotecaOption = {
  id: string
  title: string
  subtitle?: string
  authors: Array<string>
  publisher?: string
  year?: number
  isbn?: string
  shelf?: string
  badgeText?: string
}

export type BibliografiaRef = {
  id: string
  raw?: GoogleBooksVolume | OpenLibraryDoc
  title: string
  subtitle?: string
  authors: Array<string>
  publisher?: string
  year?: number
  yearIsApproximate?: boolean
  isInPress?: boolean
  isbn?: string

  tipo: BibliografiaTipo
  referenciaEnLinea?: string
  referenciaBiblioteca?: string
}

export type IASugerencia = {
  id: string
  selected: boolean
  endpoint: EndpointResult['endpoint']
  item: GoogleBooksVolume | OpenLibraryDoc
  tipo: BibliografiaTipo
  biblioteca?: {
    options?: Array<BibliotecaOption>
    choiceId?: string
  }
}

export type ManualDraft = {
  title: string
  authorsText: string
  publisher: string
  yearText: string
  isbn: string
}

/**
 * Valores del form global del wizard (TanStack Form). Contiene únicamente
 * datos del dominio: el ui-state del antiguo `WizardState` monolítico vive
 * ahora fuera del form (mutaciones de TanStack Query, `useState` efímeros).
 */
export type NuevaBibliografiaFormValues = {
  metodo: MetodoBibliografia
  fuenteBusqueda: FuenteBusquedaBibliografia
  tipoBusqueda: BibliografiaTipo
  ia: {
    q: string
    idioma: IdiomaBibliografia
    sugerencias: Array<IASugerencia>
  }
  manual: {
    draft: ManualDraft
    refs: Array<BibliografiaRef>
  }
  biblioteca: {
    q: string
    refs: Array<BibliografiaRef>
  }
  formato: FormatoCita | null
  /** Snapshot editable para los pasos Detalles/Resumen (ver `computeRefsParaDetalle`). */
  refs: Array<BibliografiaRef>
  citaEdits: Record<FormatoCita, Record<string, string>>
}
