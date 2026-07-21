import CSL from 'citeproc'

import type { BibliografiaRef, FormatoCita } from './types'

type CSLAuthor = {
  family: string
  given: string
}

type CSLItem = {
  id: string
  type: 'book'
  title: string
  author: Array<CSLAuthor>
  publisher?: string
  issued?: { 'date-parts': Array<Array<number>>; circa?: boolean }
  status?: string
  ISBN?: string
}

export function parsearAutor(nombreCompleto: string): CSLAuthor {
  if (nombreCompleto.includes(',')) {
    return {
      family: nombreCompleto.split(',')[0]?.trim() ?? '',
      given: nombreCompleto.split(',')[1]?.trim() ?? '',
    }
  }
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 1) return { family: partes[0] ?? '', given: '' }
  const family = partes.pop() ?? ''
  const given = partes.join(' ')
  return { family, given }
}

export function citeprocHtmlToPlainText(value: string) {
  const input = value
  if (!input) return ''

  // citeproc suele devolver HTML + entidades (`&#38;`, `&amp;`, etc.).
  // Convertimos a texto plano usando el parser del navegador.
  try {
    const doc = new DOMParser().parseFromString(input, 'text/html')
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
  } catch {
    // Fallback ultra simple (por si DOMParser no existe en algún entorno).
    return input
      .replace(/<[^>]*>/g, ' ')
      .replace(/&#38;?/g, '&')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }
}

async function fetchTextCached(url: string, cache: Map<string, string>) {
  const cached = cache.get(url)
  if (cached) return cached
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo cargar recurso: ${url}`)
  const text = await res.text()

  // En dev (SPA), una ruta inexistente puede devolver `index.html` con 200.
  // Eso rompe citeproc con errores poco claros.
  const trimmed = text.trim().toLowerCase()
  const looksLikeHtml =
    trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')
  if (looksLikeHtml) {
    throw new Error(
      `Recurso CSL/XML no encontrado en ${url}. ` +
        `Asegúrate de colocar los archivos en public/csl (ver public/csl/README.md).`,
    )
  }

  const looksLikeXml =
    trimmed.startsWith('<?xml') ||
    trimmed.startsWith('<style') ||
    trimmed.startsWith('<locale')
  if (!looksLikeXml) {
    throw new Error(
      `Recurso en ${url} no parece XML CSL válido. ` +
        `Verifica que sea un archivo .csl/.xml correcto.`,
    )
  }

  cache.set(url, text)
  return text
}

// Recursos locales servidos desde Vite `public/`.
// Colocar los archivos en `public/csl/styles/*` y `public/csl/locales/*`.
const PUBLIC_BASE_URL = import.meta.env.BASE_URL || '/'
function publicUrl(path: string) {
  return `${PUBLIC_BASE_URL}${path.replace(/^\//, '')}`
}

const CSL_STYLE_URL: Record<FormatoCita, string> = {
  apa: publicUrl('csl/styles/apa.csl'),
  ieee: publicUrl('csl/styles/ieee.csl'),
  chicago: publicUrl('csl/styles/chicago-author-date.csl'),
  vancouver: publicUrl('csl/styles/nlm-citation-sequence.csl'),
}

const CSL_LOCALE_URL = publicUrl('csl/locales/locales-es-MX.xml')

// Cachés de recursos estáticos de `public/csl` (compartidas por sesión).
const styleCache = new Map<string, string>()
const localeCache = new Map<string, string>()

/**
 * Genera las citas en texto plano para un formato dado. Función pura respecto
 * al estado del wizard: el contenedor decide cómo fusionar el resultado con
 * las citas existentes (`citaEdits`).
 */
export async function generarCitasCSL(
  formato: FormatoCita,
  refs: Array<BibliografiaRef>,
): Promise<Record<string, string>> {
  const xmlStyle = await fetchTextCached(CSL_STYLE_URL[formato], styleCache)
  const xmlLocale = await fetchTextCached(CSL_LOCALE_URL, localeCache)

  const cslItems: Record<string, CSLItem> = {}
  for (const r of refs) {
    const trimmedTitle = r.title.trim()
    cslItems[r.id] = {
      id: r.id,
      type: 'book',
      title: trimmedTitle || 'Sin título',
      author: r.authors.map(parsearAutor),
      publisher: r.publisher,
      issued:
        r.isInPress || !r.year
          ? undefined
          : {
              'date-parts': [[r.year]],
              circa: r.yearIsApproximate ? true : undefined,
            },
      status: r.isInPress ? 'in press' : undefined,
      ISBN: r.isbn,
    }
  }

  const sys = {
    retrieveLocale: (_lang: string) => xmlLocale,
    retrieveItem: (id: string) => cslItems[id],
  }

  const engine = new CSL.Engine(sys as any, xmlStyle)
  engine.updateItems(Object.keys(cslItems))
  const result = engine.makeBibliography()

  // result[0] contiene los metadatos, result[1] las citas formateadas
  const meta = result?.[0] as { entry_ids?: Array<Array<string>> } | undefined
  const entries = (result?.[1] ?? []) as Array<string>

  const citations: Record<string, string> = {}

  // meta.entry_ids es un arreglo de arreglos: [["id-2"], ["id-1"], ...]
  const sortedIds = meta?.entry_ids ?? []

  for (let i = 0; i < entries.length; i++) {
    const id = sortedIds[i]?.[0] // Sacamos el ID real de esta posición
    if (!id) continue

    const cita = citeprocHtmlToPlainText(entries[i] ?? '')
    citations[id] = cita
  }

  return citations
}
