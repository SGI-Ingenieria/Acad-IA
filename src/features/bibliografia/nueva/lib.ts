import { MAX_YEAR, MIN_YEAR } from './types'

import type {
  BibliografiaRef,
  BibliografiaTipo,
  BibliotecaOption,
  IASugerencia,
  NuevaBibliografiaFormValues,
} from './types'
import type { BibliotecaItem } from '@/data/api/repositories.api'
import type {
  EndpointResult,
  GoogleBooksVolume,
  OpenLibraryDoc,
} from '@/data/api/subjects.api'

export function iaSugerenciaToEndpointResult(s: IASugerencia): EndpointResult {
  return s.endpoint === 'google'
    ? { endpoint: 'google', item: s.item as GoogleBooksVolume }
    : { endpoint: 'open_library', item: s.item }
}

export function bibliotecaOptionToRef(opt: BibliotecaOption): BibliografiaRef {
  return {
    id: opt.id,
    raw: undefined,
    title: opt.title,
    subtitle: undefined,
    authors: opt.authors,
    publisher: opt.publisher,
    year: opt.year,
    isbn: opt.isbn,
    tipo: 'BASICA',
    referenciaBiblioteca: opt.id,
  }
}

/** Convierte un resultado del catálogo institucional en una referencia. */
export function bibliotecaItemToRef(
  item: BibliotecaItem,
  tipo: BibliografiaTipo,
): BibliografiaRef {
  const year = item.anio
    ? Number(String(item.anio).replace(/[^\d]/g, '').slice(0, 4)) || undefined
    : undefined
  return {
    id: `biblio-${item.id}`,
    title: item.titulo,
    subtitle: item.descripcion,
    authors: item.autor ? [item.autor] : [],
    publisher: item.editorial,
    year,
    isbn: item.isbn,
    tipo,
    referenciaBiblioteca: item.id,
  }
}

export function getOnlineSuggestionTitle(s: IASugerencia): string {
  if (s.endpoint === 'google') {
    const info = (s.item as GoogleBooksVolume).volumeInfo ?? {}
    return (info.title ?? '').trim() || 'Sin título'
  }

  const doc = s.item as OpenLibraryDoc
  return (
    (typeof doc['title'] === 'string' ? doc['title'] : '').trim() ||
    'Sin título'
  )
}

export function getOnlineSuggestionSubtitle(
  s: IASugerencia,
): string | undefined {
  if (s.endpoint === 'google') {
    const info = (s.item as GoogleBooksVolume).volumeInfo ?? {}
    const subtitle = info.subtitle
    return typeof subtitle === 'string' && subtitle.trim()
      ? subtitle.trim()
      : undefined
  }

  const doc = s.item as OpenLibraryDoc
  const subtitle = doc['subtitle']
  return typeof subtitle === 'string' && subtitle.trim()
    ? subtitle.trim()
    : undefined
}

export function getOnlineSuggestionAuthors(s: IASugerencia): Array<string> {
  if (s.endpoint === 'google') {
    const info = (s.item as GoogleBooksVolume).volumeInfo ?? {}
    return Array.isArray(info.authors) ? info.authors : []
  }

  const doc = s.item as OpenLibraryDoc
  return Array.isArray(doc['author_name'])
    ? (doc['author_name'] as Array<unknown>).filter(
        (a): a is string => typeof a === 'string',
      )
    : []
}

/** Extrae el ISBN de una sugerencia (Google Books u Open Library). */
export function getOnlineSuggestionIsbn(s: IASugerencia): string | undefined {
  if (s.endpoint === 'google') {
    const info = (s.item as GoogleBooksVolume).volumeInfo
    const ids = info?.industryIdentifiers ?? []
    const isbn =
      ids.find((x) => x.type === 'ISBN_13')?.identifier ??
      ids.find((x) => x.type === 'ISBN_10')?.identifier ??
      ids.find((x) => x.identifier)?.identifier
    return typeof isbn === 'string' && isbn.trim() ? isbn.trim() : undefined
  }

  const doc = s.item as OpenLibraryDoc
  const isbn = Array.isArray(doc['isbn'])
    ? (doc['isbn'] as Array<unknown>).find(
        (x): x is string => typeof x === 'string',
      )
    : undefined
  return typeof isbn === 'string' && isbn.trim() ? isbn.trim() : undefined
}

export function getOnlineSuggestionYear(s: IASugerencia): number | undefined {
  return s.endpoint === 'google'
    ? tryParseYear((s.item as GoogleBooksVolume).volumeInfo?.publishedDate)
    : tryParseYearFromOpenLibrary(s.item)
}

export function iaSugerenciaToChosenRef(s: IASugerencia): BibliografiaRef {
  const choiceId = s.biblioteca?.choiceId
  const options = s.biblioteca?.options

  if (choiceId && choiceId !== 'online' && Array.isArray(options)) {
    const chosen = options.find((o) => o.id === choiceId)
    if (chosen) return bibliotecaOptionToRef(chosen)
  }

  return endpointResultToRef(iaSugerenciaToEndpointResult(s))
}

export function tryParseYear(publishedDate?: string): number | undefined {
  if (!publishedDate) return undefined
  const match = String(publishedDate).match(/\d{4}/)
  if (!match) return undefined
  const year = Number.parseInt(match[0], 10)
  return Number.isFinite(year) ? year : undefined
}

export function sanitizeYearInput(value: string): string {
  return value.replace(/[^\d]/g, '').slice(0, 4)
}

export function tryParseStrictYear(value: string): number | undefined {
  const cleaned = sanitizeYearInput(value)
  if (!/^\d{4}$/.test(cleaned)) return undefined
  const year = Number.parseInt(cleaned, 10)
  if (!Number.isFinite(year)) return undefined
  if (year < MIN_YEAR || year > MAX_YEAR) return undefined
  return year
}

export function randomUUID(): string {
  try {
    const c = (globalThis as any).crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function tryParseYearFromOpenLibrary(
  doc: OpenLibraryDoc,
): number | undefined {
  const y1 = doc['first_publish_year']
  if (typeof y1 === 'number' && Number.isFinite(y1)) return y1

  const years = doc['publish_year']
  if (Array.isArray(years)) {
    const numeric = years
      .map((x) => (typeof x === 'number' ? x : Number(x)))
      .filter((n) => Number.isFinite(n))
    if (numeric.length > 0) return Math.max(...numeric)
  }

  const published = doc['publish_date']
  if (typeof published === 'string') return tryParseYear(published)
  return undefined
}

export function getEndpointResultId(result: EndpointResult): string {
  if (result.endpoint === 'google') {
    return `google:${result.item.id}`
  }

  const doc = result.item
  const key = doc['key']
  if (typeof key === 'string' && key.trim()) return `open_library:${key}`

  const cover = doc['cover_edition_key']
  if (typeof cover === 'string' && cover.trim()) return `open_library:${cover}`

  const editionKey = doc['edition_key']
  if (Array.isArray(editionKey) && typeof editionKey[0] === 'string') {
    return `open_library:${editionKey[0]}`
  }

  return `open_library:${randomUUID()}`
}

export function endpointResultToRef(result: EndpointResult): BibliografiaRef {
  if (result.endpoint === 'google') {
    const volume = result.item
    const info = volume.volumeInfo ?? {}
    const title = (info.title ?? '').trim() || 'Sin título'
    const subtitle =
      typeof info.subtitle === 'string' ? info.subtitle.trim() : undefined
    const authors = Array.isArray(info.authors) ? info.authors : []
    const publisher =
      typeof info.publisher === 'string' ? info.publisher : undefined
    const year = tryParseYear(info.publishedDate)
    const ids = info.industryIdentifiers ?? []
    const isbn =
      ids.find((x) => x.type === 'ISBN_13')?.identifier ??
      ids.find((x) => x.type === 'ISBN_10')?.identifier ??
      ids.find((x) => x.identifier)?.identifier

    return {
      id: getEndpointResultId(result),
      raw: volume,
      title,
      subtitle,
      authors,
      publisher,
      year,
      isbn,
      tipo: 'BASICA',
      referenciaEnLinea: volume.selfLink ?? `google:${volume.id}`,
    }
  }

  const doc = result.item
  const title =
    (typeof doc['title'] === 'string' ? doc['title'] : '').trim() ||
    'Sin título'
  const subtitle =
    typeof doc['subtitle'] === 'string' ? doc['subtitle'].trim() : undefined
  const authors = Array.isArray(doc['author_name'])
    ? (doc['author_name'] as Array<unknown>).filter(
        (a): a is string => typeof a === 'string',
      )
    : []
  const publisher = Array.isArray(doc['publisher'])
    ? (doc['publisher'] as Array<unknown>).find(
        (p): p is string => typeof p === 'string',
      )
    : typeof doc['publisher'] === 'string'
      ? doc['publisher']
      : undefined
  const year = tryParseYearFromOpenLibrary(doc)
  const isbn = Array.isArray(doc['isbn'])
    ? (doc['isbn'] as Array<unknown>).find(
        (x): x is string => typeof x === 'string',
      )
    : undefined

  const olKey = typeof doc['key'] === 'string' ? doc['key'] : undefined
  return {
    id: getEndpointResultId(result),
    raw: doc,
    title,
    subtitle,
    authors,
    publisher,
    year,
    isbn,
    tipo: 'BASICA',
    referenciaEnLinea: olKey ? `open_library:${olKey}` : undefined,
  }
}

export function getResultYear(result: EndpointResult): number | undefined {
  if (result.endpoint === 'google') {
    const info = result.item.volumeInfo ?? {}
    return tryParseYear(info.publishedDate)
  }
  return tryParseYearFromOpenLibrary(result.item)
}

export function sortResultsByMostRecent(a: EndpointResult, b: EndpointResult) {
  const ya = getResultYear(a)
  const yb = getResultYear(b)
  if (typeof ya === 'number' && typeof yb === 'number') return yb - ya
  if (typeof ya === 'number') return -1
  if (typeof yb === 'number') return 1
  return 0
}

/**
 * Deriva las referencias que verán los pasos Detalles/Resumen a partir del
 * método elegido. Sustituye al antiguo useEffect de sincronización del
 * snapshot `wizard.refs`: cada handler que modifica las fuentes (método,
 * sugerencias en línea, refs manuales) debe re-escribir el campo `refs` con
 * `form.setFieldValue('refs', computeRefsParaDetalle(form.state.values))`.
 * Si las fuentes no cambian, las ediciones hechas en el paso Detalles se
 * conservan (misma semántica que el efecto original).
 */
export function computeRefsParaDetalle(
  values: NuevaBibliografiaFormValues,
): Array<BibliografiaRef> {
  return values.metodo === 'EN_LINEA'
    ? values.ia.sugerencias
        .filter((s) => s.selected)
        .map((s) => iaSugerenciaToChosenRef(s))
    : values.manual.refs
}

/**
 * Ancla DOM estable de cada sugerencia en el paso Biblioteca. Permite que la
 * validación por paso del contenedor haga scroll a la comparación pendiente
 * sin necesitar refs imperativos hacia el sub-componente.
 */
export function anclaBibliotecaSugerencia(id: string): string {
  return `biblioteca-sugerencia-${id}`
}
