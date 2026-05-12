import { useNavigate } from '@tanstack/react-router'
import CSL from 'citeproc'
import {
  Globe,
  Link as LinkIcon,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { BuscarBibliografiaRequest } from '@/data'
import type {
  EndpointResult,
  GoogleBooksVolume,
  OpenLibraryDoc,
} from '@/data/api/subjects.api'
import type { TablesInsert } from '@/types/supabase'

import { defineStepper } from '@/components/stepper'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { WizardLayout } from '@/components/wizard/WizardLayout'
import { WizardResponsiveHeader } from '@/components/wizard/WizardResponsiveHeader'
import { buscar_bibliografia } from '@/data'
import { useCreateBibliografia } from '@/data/hooks/useSubjects'
import { cn } from '@/lib/utils'

type BibliotecaOption = {
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

type BibliotecaOptionTemplate = Omit<BibliotecaOption, 'id'>

// Hardcodeado: 3 conjuntos de coincidencias (0, 2 y 5).
const BIBLIOTECA_MATCH_SETS: Array<Array<BibliotecaOptionTemplate>> = [
  [],
  [
    {
      title: 'Coincidencia en biblioteca (Ejemplar 1)',
      authors: ['Autor A', 'Autor B'],
      publisher: 'Editorial X',
      year: 2020,
      isbn: '9780000000001',
      shelf: 'QA76.9 .A1 2020',
      badgeText: 'Coincidencia ISBN',
    },
    {
      title: 'Coincidencia en biblioteca (Ejemplar 2)',
      authors: ['Autor C'],
      publisher: 'Editorial Y',
      year: 2016,
      shelf: 'QA76.9 .A2 2016',
    },
  ],
  [
    {
      title: 'Coincidencia en biblioteca (Ejemplar 1)',
      authors: ['Autor A', 'Autor B'],
      publisher: 'Editorial X',
      year: 2020,
      isbn: '9780000000001',
      shelf: 'QA76.9 .A1 2020',
      badgeText: 'Coincidencia ISBN',
    },
    {
      title: 'Coincidencia en biblioteca (Ejemplar 2)',
      authors: ['Autor C'],
      publisher: 'Editorial Y',
      year: 2016,
      shelf: 'QA76.9 .A2 2016',
    },
    {
      title: 'Coincidencia en biblioteca (Ejemplar 3)',
      authors: ['Autor D', 'Autor E'],
      publisher: 'Editorial Z',
      year: 2014,
      shelf: 'QA76.9 .A3 2014',
    },
    {
      title: 'Coincidencia en biblioteca (Ejemplar 4)',
      authors: ['Autor F'],
      publisher: 'Editorial W',
      year: 2011,
      shelf: 'QA76.9 .A4 2011',
    },
    {
      title: 'Coincidencia en biblioteca (Ejemplar 5)',
      authors: ['Autor G'],
      publisher: 'Editorial V',
      year: 2009,
      shelf: 'QA76.9 .A5 2009',
    },
  ],
]

export function BookSelectionAccordion({
  onlineSourceLabel,
  online,
  options,
  value,
  onValueChange,
}: {
  onlineSourceLabel: string
  online: {
    id: string
    title: string
    subtitle?: string
    authorsLine: string
    year?: number
    isbn?: string
  }
  options: Array<BibliotecaOption>
  value: string | undefined
  onValueChange: (value: string) => void
}) {
  // Estado inicial indefinido para que nada esté seleccionado por defecto
  const [selectedBook, setSelectedBook] = useState<string | undefined>(value)

  useEffect(() => {
    setSelectedBook(value)
  }, [value])

  const onlineValue = `online:${online.id}`

  const optionBaseClass =
    'relative flex items-start space-x-3 rounded-lg border p-4 transition-colors'

  const optionClass = (isSelected: boolean) =>
    cn(
      optionBaseClass,
      isSelected
        ? 'border-primary bg-primary/5'
        : 'hover:border-primary/30 hover:bg-accent/50',
    )

  return (
    <>
      {/* Un solo RadioGroup controla ambos lados */}
      <RadioGroup
        value={selectedBook}
        onValueChange={(v) => {
          setSelectedBook(v)
          onValueChange(v)
        }}
        className="flex flex-col gap-6 md:flex-row"
      >
        {/* --- LADO IZQUIERDO: Sugerencia Online --- */}
        <div className="flex-1 space-y-4">
          <h4 className="text-muted-foreground text-sm font-medium">
            Sugerencia Original ({onlineSourceLabel})
          </h4>

          <div className={optionClass(selectedBook === onlineValue)}>
            <RadioGroupItem
              value={onlineValue}
              id={onlineValue}
              className="mt-1"
            />
            <Label
              htmlFor={onlineValue}
              className="flex flex-1 cursor-pointer flex-col"
            >
              <span className="font-semibold">{online.title}</span>
              {online.subtitle ? (
                <span className="text-muted-foreground text-sm">
                  {online.subtitle}
                </span>
              ) : null}
              <span className="text-muted-foreground text-sm">
                {online.authorsLine}
                {online.year ? ` (${online.year})` : ''}
              </span>
              {online.isbn ? (
                <span className="text-muted-foreground mt-1 text-xs">
                  ISBN: {online.isbn}
                </span>
              ) : null}
            </Label>
          </div>
        </div>

        {/* Separador vertical para escritorio, horizontal en móviles */}
        <Separator orientation="vertical" className="hidden h-auto md:block" />
        <Separator orientation="horizontal" className="md:hidden" />

        {/* --- LADO DERECHO: Alternativas de Biblioteca --- */}
        <div className="flex-1 space-y-4">
          <h4 className="text-muted-foreground text-sm font-medium">
            Disponibles en Biblioteca
          </h4>

          <div className="max-h-75 space-y-3 overflow-y-auto pr-2">
            {options.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No se encontraron alternativas.
              </div>
            ) : (
              options.map((opt) => {
                const optValue = `biblio:${opt.id}`
                const authorsLine = opt.authors.join('; ')
                const isSelected = selectedBook === optValue
                return (
                  <div key={opt.id} className={optionClass(isSelected)}>
                    <RadioGroupItem
                      value={optValue}
                      id={optValue}
                      className="mt-1 cursor-pointer"
                    />
                    <Label
                      htmlFor={optValue}
                      className="flex flex-1 cursor-pointer flex-col"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{opt.title}</span>
                        {opt.badgeText ? (
                          <Badge variant="secondary">{opt.badgeText}</Badge>
                        ) : null}
                      </div>
                      {opt.subtitle ? (
                        <span className="text-muted-foreground text-sm">
                          {opt.subtitle}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground text-sm">
                        {authorsLine}
                        {opt.year ? ` (${opt.year})` : ''}
                      </span>
                      {opt.shelf ? (
                        <span className="bg-muted mt-2 w-fit rounded px-1 font-mono text-xs">
                          Estante: {opt.shelf}
                        </span>
                      ) : null}
                    </Label>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </RadioGroup>
    </>
  )
}

type MetodoBibliografia = 'MANUAL' | 'EN_LINEA' | null
export type FormatoCita = 'apa' | 'ieee' | 'vancouver' | 'chicago'

type IdiomaBibliografia =
  | 'ALL'
  | 'ES'
  | 'EN'
  | 'DE'
  | 'ZH'
  | 'FR'
  | 'IT'
  | 'JA'
  | 'RU'

const IDIOMA_LABEL: Record<IdiomaBibliografia, string> = {
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

const IDIOMA_TO_GOOGLE: Record<IdiomaBibliografia, string | undefined> = {
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
const IDIOMA_TO_OPEN_LIBRARY: Record<IdiomaBibliografia, string | undefined> = {
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

const MIN_YEAR = 1450
const MAX_YEAR = new Date().getFullYear() + 1

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

type BibliografiaAsignaturaInsert = TablesInsert<'bibliografia_asignatura'>
type BibliografiaTipo = BibliografiaAsignaturaInsert['tipo']

type BibliografiaRef = {
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
}

type WizardState = {
  metodo: MetodoBibliografia
  ia: {
    q: string
    idioma: IdiomaBibliografia
    showConservacionTooltip: boolean
    sugerencias: Array<{
      id: string
      selected: boolean
      endpoint: EndpointResult['endpoint']
      item: GoogleBooksVolume | OpenLibraryDoc
      biblioteca?: {
        options?: Array<BibliotecaOption>
        choiceId?: string
      }
    }>
    isLoading: boolean
    errorMessage: string | null
  }
  manual: {
    draft: {
      title: string
      authorsText: string
      publisher: string
      yearText: string
      isbn: string
    }
    refs: Array<BibliografiaRef>
  }
  formato: FormatoCita | null
  refs: Array<BibliografiaRef>
  citaEdits: Record<FormatoCita, Record<string, string>>
  generatingIds: Set<string>
  isSaving: boolean
  errorMessage: string | null
}

type IASugerencia = WizardState['ia']['sugerencias'][number]
function iaSugerenciaToEndpointResult(s: IASugerencia): EndpointResult {
  return s.endpoint === 'google'
    ? { endpoint: 'google', item: s.item as GoogleBooksVolume }
    : { endpoint: 'open_library', item: s.item }
}

const Wizard = defineStepper(
  { id: 'metodo', title: 'Método', description: 'Manual o Buscar en línea' },
  {
    id: 'paso2',
    title: 'Datos básicos',
    description: 'Seleccionar o capturar',
  },
  {
    id: 'biblioteca',
    title: 'Biblioteca',
    description: 'Comparar con alternativas de la biblioteca',
  },
  { id: 'paso3', title: 'Detalles', description: 'Formato y citas' },
  { id: 'resumen', title: 'Resumen', description: 'Confirmar' },
)

type BibliotecaStepHandle = {
  validateBeforeNext: () => boolean
}

function bibliotecaOptionToRef(opt: BibliotecaOption): BibliografiaRef {
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
  }
}

function getOnlineSuggestionTitle(s: IASugerencia): string {
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

function getOnlineSuggestionSubtitle(s: IASugerencia): string | undefined {
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

function getOnlineSuggestionAuthors(s: IASugerencia): Array<string> {
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

function getOnlineSuggestionIsbn(s: IASugerencia): string | undefined {
  if (s.endpoint === 'google') {
    const info = (s.item as GoogleBooksVolume).volumeInfo
    const isbn = info?.industryIdentifiers?.find(
      (x) => x.identifier,
    )?.identifier
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

function getOnlineSuggestionYear(s: IASugerencia): number | undefined {
  return s.endpoint === 'google'
    ? tryParseYear((s.item as GoogleBooksVolume).volumeInfo?.publishedDate)
    : tryParseYearFromOpenLibrary(s.item)
}

function iaSugerenciaToChosenRef(s: IASugerencia): BibliografiaRef {
  const choiceId = s.biblioteca?.choiceId
  const options = s.biblioteca?.options

  if (choiceId && choiceId !== 'online' && Array.isArray(options)) {
    const chosen = options.find((o) => o.id === choiceId)
    if (chosen) return bibliotecaOptionToRef(chosen)
  }

  return endpointResultToRef(iaSugerenciaToEndpointResult(s))
}

function parsearAutor(nombreCompleto: string): CSLAuthor {
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

function tryParseYear(publishedDate?: string): number | undefined {
  if (!publishedDate) return undefined
  const match = String(publishedDate).match(/\d{4}/)
  if (!match) return undefined
  const year = Number.parseInt(match[0], 10)
  return Number.isFinite(year) ? year : undefined
}

function sanitizeYearInput(value: string): string {
  return value.replace(/[^\d]/g, '').slice(0, 4)
}

function tryParseStrictYear(value: string): number | undefined {
  const cleaned = sanitizeYearInput(value)
  if (!/^\d{4}$/.test(cleaned)) return undefined
  const year = Number.parseInt(cleaned, 10)
  if (!Number.isFinite(year)) return undefined
  if (year < MIN_YEAR || year > MAX_YEAR) return undefined
  return year
}

function randomUUID(): string {
  try {
    const c = (globalThis as any).crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function tryParseYearFromOpenLibrary(doc: OpenLibraryDoc): number | undefined {
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

function getEndpointResultId(result: EndpointResult): string {
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

function endpointResultToRef(result: EndpointResult): BibliografiaRef {
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
    const isbn =
      info.industryIdentifiers?.find((x) => x.identifier)?.identifier ??
      undefined

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
  }
}

function getResultYear(result: EndpointResult): number | undefined {
  if (result.endpoint === 'google') {
    const info = result.item.volumeInfo ?? {}
    return tryParseYear(info.publishedDate)
  }
  return tryParseYearFromOpenLibrary(result.item)
}

function sortResultsByMostRecent(a: EndpointResult, b: EndpointResult) {
  const ya = getResultYear(a)
  const yb = getResultYear(b)
  if (typeof ya === 'number' && typeof yb === 'number') return yb - ya
  if (typeof ya === 'number') return -1
  if (typeof yb === 'number') return 1
  return 0
}

function citeprocHtmlToPlainText(value: string) {
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

export function NuevaBibliografiaModalContainer({
  planId,
  asignaturaId,
}: {
  planId: string
  asignaturaId: string
}) {
  const navigate = useNavigate()
  const createBibliografia = useCreateBibliografia()

  const formatoStepRef = useRef<FormatoYCitasStepHandle | null>(null)
  const bibliotecaStepRef = useRef<BibliotecaStepHandle | null>(null)

  const [wizard, setWizard] = useState<WizardState>({
    metodo: null,
    ia: {
      q: '',
      idioma: 'ALL',
      showConservacionTooltip: false,
      sugerencias: [],
      isLoading: false,
      errorMessage: null,
    },
    manual: {
      draft: {
        title: '',
        authorsText: '',
        publisher: '',
        yearText: '',
        isbn: '',
      },
      refs: [],
    },
    formato: null,
    refs: [],
    citaEdits: {
      apa: {},
      ieee: {},
      chicago: {},
      vancouver: {},
    },
    generatingIds: new Set(),
    isSaving: false,
    errorMessage: null,
  })

  const styleCacheRef = useRef(new Map<string, string>())
  const localeCacheRef = useRef(new Map<string, string>())

  const titleOverrides: Record<string, string> =
    wizard.metodo === 'EN_LINEA'
      ? { paso2: 'Sugerencias', biblioteca: 'Biblioteca', paso3: 'Estructura' }
      : { paso2: 'Datos básicos', paso3: 'Detalles' }

  const handleClose = () => {
    navigate({
      to: `/planes/${planId}/asignaturas/${asignaturaId}/bibliografia/`,
      resetScroll: false,
    })
  }

  const refsForStep3: Array<BibliografiaRef> =
    wizard.metodo === 'EN_LINEA'
      ? wizard.ia.sugerencias
          .filter((s) => s.selected)
          .map((s) => iaSugerenciaToChosenRef(s))
      : wizard.manual.refs

  // Mantener `wizard.refs` como snapshot para pasos 3/4.
  useEffect(() => {
    setWizard((w) => ({ ...w, refs: refsForStep3 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.metodo, wizard.ia.sugerencias, wizard.manual.refs])

  const citationsForFormato = useMemo(() => {
    if (!wizard.formato) return {}
    return wizard.citaEdits[wizard.formato]
  }, [wizard.citaEdits, wizard.formato])

  const allCitationsReady = useMemo(() => {
    if (!wizard.formato) return false
    if (wizard.refs.length === 0) return false
    const map = wizard.citaEdits[wizard.formato]
    return wizard.refs.every(
      (r) => typeof map[r.id] === 'string' && map[r.id].trim().length > 0,
    )
  }, [wizard.citaEdits, wizard.formato, wizard.refs])

  const canContinueDesdeMetodo =
    wizard.metodo === 'MANUAL' || wizard.metodo === 'EN_LINEA'

  const canContinueDesdePaso2 =
    wizard.metodo === 'EN_LINEA'
      ? wizard.ia.sugerencias.some((s) => s.selected)
      : wizard.manual.refs.length > 0

  const canContinueDesdePaso3 = Boolean(wizard.formato) && allCitationsReady

  async function handleBuscarSugerencias() {
    const hadNoSugerenciasBefore = wizard.ia.sugerencias.length === 0

    if (wizard.ia.sugerencias.filter((s) => s.selected).length >= 20) return

    const q = wizard.ia.q.trim()
    if (!q) return

    setWizard((w) => ({
      ...w,
      ia: {
        ...w.ia,
        // Conservar únicamente las sugerencias seleccionadas.
        sugerencias: w.ia.sugerencias.filter((s) => s.selected),
        showConservacionTooltip: false,
        isLoading: true,
        errorMessage: null,
      },
      errorMessage: null,
    }))

    try {
      const idioma = wizard.ia.idioma
      const googleLangRestrict = IDIOMA_TO_GOOGLE[idioma]
      const openLibraryLanguage = IDIOMA_TO_OPEN_LIBRARY[idioma]

      const google: BuscarBibliografiaRequest['google'] = {
        orderBy: 'newest',
        startIndex: 0,
      }
      if (googleLangRestrict) google.langRestrict = googleLangRestrict

      const openLibrary: BuscarBibliografiaRequest['openLibrary'] = {
        sort: 'new',
        page: 1,
      }
      if (openLibraryLanguage) openLibrary.language = openLibraryLanguage

      const req: BuscarBibliografiaRequest = {
        searchTerms: { q },
        google,
        openLibrary,
      }

      const items = (await buscar_bibliografia(req))
        .slice()
        .sort(sortResultsByMostRecent)

      setWizard((w) => {
        const existingById = new Map(w.ia.sugerencias.map((s) => [s.id, s]))

        const newOnes = items
          .map((r) => ({
            id: getEndpointResultId(r),
            selected: false,
            endpoint: r.endpoint,
            item: r.item,
          }))
          .filter((it) => !existingById.has(it.id))

        const merged = [...w.ia.sugerencias, ...newOnes].slice()
        merged.sort(
          (a, b) =>
            sortResultsByMostRecent(
              iaSugerenciaToEndpointResult(a),
              iaSugerenciaToEndpointResult(b),
            ) || a.id.localeCompare(b.id),
        )

        return {
          ...w,
          ia: {
            ...w.ia,
            sugerencias: merged,
            showConservacionTooltip:
              hadNoSugerenciasBefore && newOnes.length > 0,
            isLoading: false,
            errorMessage: null,
          },
        }
      })
    } catch (e: any) {
      setWizard((w) => ({
        ...w,
        ia: {
          ...w.ia,
          isLoading: false,
          errorMessage:
            typeof e?.message === 'string'
              ? e.message
              : 'Error al buscar bibliografía',
        },
      }))
    }
  }

  async function generateCitasForFormato(
    formato: FormatoCita,
    refs: Array<BibliografiaRef>,
    options?: {
      force?: boolean
    },
  ) {
    const force = Boolean(options?.force)
    setWizard((w) => {
      const nextIds = new Set(w.generatingIds)
      refs.forEach((r) => nextIds.add(r.id))
      return {
        ...w,
        generatingIds: nextIds,
      }
    })

    try {
      const xmlStyle = await fetchTextCached(
        CSL_STYLE_URL[formato],
        styleCacheRef.current,
      )
      const xmlLocale = await fetchTextCached(
        CSL_LOCALE_URL,
        localeCacheRef.current,
      )

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
      const meta = result?.[0] as
        | { entry_ids?: Array<Array<string>> }
        | undefined
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

      setWizard((w) => {
        const nextEdits = { ...w.citaEdits }
        const existing = nextEdits[formato]
        const merged: Record<string, string> = { ...existing }

        for (const id of Object.keys(citations)) {
          merged[id] =
            force || !merged[id] || merged[id].trim().length === 0
              ? (citations[id] ?? '')
              : merged[id]
        }
        nextEdits[formato] = merged

        const nextIds = new Set(w.generatingIds)
        refs.forEach((r) => nextIds.delete(r.id))

        return {
          ...w,
          citaEdits: nextEdits,
          generatingIds: nextIds,
        }
      })
    } catch (e: any) {
      setWizard((w) => {
        const nextIds = new Set(w.generatingIds)
        refs.forEach((r) => nextIds.delete(r.id))
        return {
          ...w,
          generatingIds: nextIds,
          errorMessage:
            typeof e?.message === 'string'
              ? e.message
              : 'Error al generar citas',
        }
      })
    }
  }

  useEffect(() => {
    if (!wizard.formato) return
    if (wizard.refs.length === 0) return
    const map = wizard.citaEdits[wizard.formato]
    const missing = wizard.refs.some(
      (r) => !map[r.id] || map[r.id].trim().length === 0,
    )
    if (!missing) return
    if (wizard.generatingIds.size > 0) return
    void generateCitasForFormato(wizard.formato, wizard.refs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.formato, wizard.refs])

  async function handleCreate() {
    setWizard((w) => ({ ...w, isSaving: true, errorMessage: null }))

    try {
      if (!wizard.formato) throw new Error('Selecciona un formato')
      const map = wizard.citaEdits[wizard.formato]
      if (wizard.refs.length === 0) throw new Error('No hay referencias')

      await Promise.all(
        wizard.refs.map((r) =>
          createBibliografia.mutateAsync({
            asignatura_id: asignaturaId,
            tipo: r.tipo,
            cita: map[r.id] ?? '',
            // tipo_fuente: r.source,
            // biblioteca_item_id: null,
          }),
        ),
      )

      setWizard((w) => ({ ...w, isSaving: false }))
      handleClose()
    } catch (e: any) {
      setWizard((w) => ({
        ...w,
        isSaving: false,
        errorMessage:
          typeof e?.message === 'string'
            ? e.message
            : 'Error al guardar bibliografía',
      }))
    }
  }

  const WizardDef = Wizard as any

  return (
    <WizardDef.Stepper.Provider
      initialStep={WizardDef.utils.getFirst().id}
      className="flex h-full flex-col"
    >
      {({ methods }: any) => {
        const idx = WizardDef.utils.getIndex(methods.current.id)
        const isLast = idx >= WizardDef.steps.length - 1
        const currentId = methods.current.id as string

        return (
          <WizardLayout
            title="Agregar Bibliografía"
            onClose={handleClose}
            headerSlot={
              <WizardResponsiveHeader
                wizard={WizardDef}
                methods={methods}
                titleOverrides={titleOverrides}
                hiddenStepIds={
                  wizard.metodo === 'MANUAL' ? ['biblioteca'] : undefined
                }
              />
            }
            footerSlot={
              <WizardDef.Stepper.Controls>
                <div className="flex grow items-center justify-between">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const goToStep = (targetId: string) => {
                        if (typeof methods?.goTo === 'function') {
                          methods.goTo(targetId)
                          return
                        }
                        if (typeof methods?.setStep === 'function') {
                          methods.setStep(targetId)
                          return
                        }
                        if (typeof methods?.navigation?.goTo === 'function') {
                          methods.navigation.goTo(targetId)
                          return
                        }

                        const targetIdx = WizardDef.utils.getIndex(targetId)

                        const stepOnce = () => {
                          const currentIdx = WizardDef.utils.getIndex(
                            methods.current.id,
                          )
                          if (currentIdx === targetIdx) return
                          if (currentIdx < targetIdx) methods.next()
                          else methods.prev()
                          queueMicrotask(stepOnce)
                        }

                        stepOnce()
                      }

                      if (
                        wizard.metodo === 'MANUAL' &&
                        methods.current.id === 'paso3'
                      ) {
                        goToStep('paso2')
                        return
                      }

                      methods.prev()
                    }}
                    disabled={
                      idx === 0 || wizard.ia.isLoading || wizard.isSaving
                    }
                  >
                    Anterior
                  </Button>
                  {isLast ? (
                    <Button onClick={handleCreate} disabled={wizard.isSaving}>
                      {wizard.isSaving
                        ? 'Agregando...'
                        : 'Agregar Bibliografía'}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        const goToStep = (targetId: string) => {
                          if (typeof methods?.goTo === 'function') {
                            methods.goTo(targetId)
                            return
                          }
                          if (typeof methods?.setStep === 'function') {
                            methods.setStep(targetId)
                            return
                          }
                          if (typeof methods?.navigation?.goTo === 'function') {
                            methods.navigation.goTo(targetId)
                            return
                          }

                          const targetIdx = WizardDef.utils.getIndex(targetId)

                          const stepOnce = () => {
                            const currentIdx = WizardDef.utils.getIndex(
                              methods.current.id,
                            )
                            if (currentIdx === targetIdx) return
                            if (currentIdx < targetIdx) methods.next()
                            else methods.prev()
                            queueMicrotask(stepOnce)
                          }

                          stepOnce()
                        }

                        if (
                          wizard.metodo === 'MANUAL' &&
                          currentId === 'paso2'
                        ) {
                          goToStep('paso3')
                          return
                        }

                        if (currentId === 'biblioteca') {
                          const ok =
                            bibliotecaStepRef.current?.validateBeforeNext() ??
                            true
                          if (!ok) return
                        }

                        if (currentId === 'paso3') {
                          const ok =
                            formatoStepRef.current?.validateBeforeNext() ?? true
                          if (!ok) return
                          if (wizard.metodo === 'EN_LINEA' && wizard.formato) {
                            void generateCitasForFormato(
                              wizard.formato,
                              wizard.refs,
                              {
                                force: true,
                              },
                            )
                          }
                        }
                        methods.next()
                      }}
                      disabled={
                        wizard.ia.isLoading ||
                        wizard.isSaving ||
                        (currentId === 'metodo' && !canContinueDesdeMetodo) ||
                        (currentId === 'paso2' && !canContinueDesdePaso2) ||
                        (currentId === 'paso3' && !canContinueDesdePaso3)
                      }
                    >
                      Siguiente
                    </Button>
                  )}
                </div>
              </WizardDef.Stepper.Controls>
            }
          >
            <div className="mx-auto max-w-3xl">
              {wizard.errorMessage ? (
                <Card className="border-destructive/40 mb-4">
                  <CardHeader>
                    <CardTitle className="text-destructive">
                      {wizard.errorMessage}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ) : null}

              {currentId === 'metodo' && (
                <WizardDef.Stepper.Panel>
                  <MetodoStep
                    metodo={wizard.metodo}
                    onChange={(metodo) =>
                      setWizard((w) => ({
                        ...w,
                        metodo,
                        formato: null,
                        errorMessage: null,
                      }))
                    }
                  />
                </WizardDef.Stepper.Panel>
              )}

              {currentId === 'paso2' && (
                <WizardDef.Stepper.Panel>
                  {wizard.metodo === 'EN_LINEA' ? (
                    <SugerenciasStep
                      q={wizard.ia.q}
                      idioma={wizard.ia.idioma}
                      isLoading={wizard.ia.isLoading}
                      errorMessage={wizard.ia.errorMessage}
                      sugerencias={wizard.ia.sugerencias}
                      showConservacionTooltip={
                        wizard.ia.showConservacionTooltip
                      }
                      onDismissConservacionTooltip={() =>
                        setWizard((w) => ({
                          ...w,
                          ia: { ...w.ia, showConservacionTooltip: false },
                        }))
                      }
                      onChange={(patch) =>
                        setWizard((w) => ({
                          ...w,
                          ia: {
                            ...w.ia,
                            ...patch,
                          },
                          errorMessage: null,
                        }))
                      }
                      onGenerate={handleBuscarSugerencias}
                    />
                  ) : (
                    <DatosBasicosManualStep
                      draft={wizard.manual.draft}
                      refs={wizard.manual.refs}
                      onChangeDraft={(draft) =>
                        setWizard((w) => ({
                          ...w,
                          manual: { ...w.manual, draft },
                          errorMessage: null,
                        }))
                      }
                      onAddRef={(ref) =>
                        setWizard((w) => ({
                          ...w,
                          manual: {
                            ...w.manual,
                            refs: [...w.manual.refs, ref],
                          },
                          errorMessage: null,
                        }))
                      }
                      onRemoveRef={(id) =>
                        setWizard((w) => ({
                          ...w,
                          manual: {
                            ...w.manual,
                            refs: w.manual.refs.filter((r) => r.id !== id),
                          },
                        }))
                      }
                    />
                  )}
                </WizardDef.Stepper.Panel>
              )}

              {currentId === 'biblioteca' && wizard.metodo === 'EN_LINEA' && (
                <WizardDef.Stepper.Panel>
                  <BibliotecaStep
                    ref={bibliotecaStepRef}
                    sugerencias={wizard.ia.sugerencias.filter(
                      (s) => s.selected,
                    )}
                    onPatchSugerencia={(id, patch) =>
                      setWizard((w) => ({
                        ...w,
                        ia: {
                          ...w.ia,
                          sugerencias: w.ia.sugerencias.map((s) =>
                            s.id === id ? { ...s, ...patch } : s,
                          ),
                        },
                      }))
                    }
                  />
                </WizardDef.Stepper.Panel>
              )}

              {currentId === 'paso3' && (
                <WizardDef.Stepper.Panel>
                  <FormatoYCitasStep
                    ref={formatoStepRef}
                    refs={wizard.refs}
                    formato={wizard.formato}
                    citations={citationsForFormato}
                    generatingIds={wizard.generatingIds}
                    onChangeFormato={(formato) => {
                      setWizard((w) => ({ ...w, formato, errorMessage: null }))
                      if (formato) {
                        void generateCitasForFormato(formato, wizard.refs)
                      }
                    }}
                    onRegenerate={() => {
                      if (!wizard.formato) return
                      void generateCitasForFormato(
                        wizard.formato,
                        wizard.refs,
                        {
                          force: true,
                        },
                      )
                    }}
                    onChangeRef={(id, patch) =>
                      setWizard((w) => ({
                        ...w,
                        refs: w.refs.map((r) =>
                          r.id === id ? { ...r, ...patch } : r,
                        ),
                      }))
                    }
                    onChangeTipo={(id, tipo) =>
                      setWizard((w) => ({
                        ...w,
                        refs: w.refs.map((r) =>
                          r.id === id ? { ...r, tipo } : r,
                        ),
                      }))
                    }
                  />
                </WizardDef.Stepper.Panel>
              )}

              {currentId === 'resumen' && (
                <WizardDef.Stepper.Panel>
                  <ResumenStep
                    metodo={wizard.metodo}
                    formato={wizard.formato}
                    refs={wizard.refs}
                    citations={
                      wizard.formato ? wizard.citaEdits[wizard.formato] : {}
                    }
                  />
                </WizardDef.Stepper.Panel>
              )}
            </div>
          </WizardLayout>
        )
      }}
    </WizardDef.Stepper.Provider>
  )
}

function MetodoStep({
  metodo,
  onChange,
}: {
  metodo: MetodoBibliografia
  onChange: (metodo: MetodoBibliografia) => void
}) {
  const isSelected = (m: Exclude<MetodoBibliografia, null>) => metodo === m

  return (
    <div className="grid gap-4">
      <Card
        className={cn(
          'cursor-pointer transition-all',
          isSelected('MANUAL') && 'ring-ring ring-2',
        )}
        role="button"
        tabIndex={0}
        onClick={() => onChange('MANUAL')}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="text-primary h-5 w-5" /> Manual
          </CardTitle>
          <CardDescription>
            Captura referencias y edita la cita.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card
        className={cn(
          'cursor-pointer transition-all',
          isSelected('EN_LINEA') && 'ring-ring ring-2',
        )}
        role="button"
        tabIndex={0}
        onClick={() => onChange('EN_LINEA')}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="text-primary h-5 w-5" /> Buscar en línea
          </CardTitle>
          <CardDescription>
            Busca sugerencias y selecciona las mejores.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

function SugerenciasStep({
  q,
  idioma,
  isLoading,
  errorMessage,
  sugerencias,
  showConservacionTooltip,
  onDismissConservacionTooltip,
  onChange,
  onGenerate,
}: {
  q: string
  idioma: IdiomaBibliografia
  isLoading: boolean
  errorMessage: string | null
  sugerencias: Array<{
    id: string
    selected: boolean
    endpoint: EndpointResult['endpoint']
    item: GoogleBooksVolume | OpenLibraryDoc
  }>
  showConservacionTooltip: boolean
  onDismissConservacionTooltip: () => void
  onChange: (
    patch: Partial<{
      q: string
      idioma: IdiomaBibliografia
      sugerencias: any
    }>,
  ) => void
  onGenerate: () => void
}) {
  const selectedCount = sugerencias.filter((s) => s.selected).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Buscar sugerencias</CardTitle>
          <CardDescription>
            Conserva las seleccionadas y agrega nuevas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label>Búsqueda</Label>
            <Input
              value={q}
              maxLength={200}
              onChange={(e) => onChange({ q: e.target.value.slice(0, 200) })}
              placeholder="Ej: ingeniería de software, bases de datos..."
            />
          </div>

          <div className="mt-3 flex w-full flex-col items-end justify-between gap-3 sm:flex-row">
            <div className="w-full sm:w-56">
              <Label className="mb-2 block">Idioma</Label>
              <Select
                value={idioma}
                onValueChange={(v) =>
                  onChange({ idioma: v as IdiomaBibliografia })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(IDIOMA_LABEL) as Array<IdiomaBibliografia>).map(
                    (k) => (
                      <SelectItem key={k} value={k}>
                        {IDIOMA_LABEL[k]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {!isLoading && q.trim().length < 3 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onGenerate}
                      disabled={true}
                      className="gap-2"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {sugerencias.length > 0
                        ? 'Generar más sugerencias'
                        : 'Generar sugerencias'}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="max-w-xs">
                  <p>El query debe ser de al menos 3 caracteres</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={onGenerate}
                disabled={
                  isLoading || q.trim().length < 3 || selectedCount >= 20
                }
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {sugerencias.length > 0
                  ? 'Generar más sugerencias'
                  : 'Generar sugerencias'}
              </Button>
            )}
          </div>

          {errorMessage ? (
            <div className="text-destructive text-sm">{errorMessage}</div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-medium">Sugerencias</h3>
          <Tooltip open={showConservacionTooltip}>
            <TooltipTrigger asChild>
              <div className="bg-muted text-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold">
                <span aria-hidden>📌</span>
                {selectedCount} seleccionadas
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8} className="max-w-xs">
              <div className="flex items-start gap-2">
                <span className="flex-1 text-sm">
                  Al generar más sugerencias, se conservarán las referencias
                  seleccionadas.
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={onDismissConservacionTooltip}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
          {sugerencias.map((s) => {
            const selected = s.selected

            const badgeLabel =
              s.endpoint === 'google' ? 'Google' : 'Open Library'

            const title =
              s.endpoint === 'google'
                ? (
                    (s.item as GoogleBooksVolume).volumeInfo?.title ??
                    'Sin título'
                  ).trim()
                : (typeof (s.item as OpenLibraryDoc)['title'] === 'string'
                    ? ((s.item as OpenLibraryDoc)['title'] as string)
                    : 'Sin título'
                  ).trim()

            const subtitle =
              s.endpoint === 'google'
                ? (typeof (s.item as GoogleBooksVolume).volumeInfo?.subtitle ===
                  'string'
                    ? ((s.item as GoogleBooksVolume).volumeInfo
                        ?.subtitle as string)
                    : ''
                  ).trim()
                : (typeof (s.item as OpenLibraryDoc)['subtitle'] === 'string'
                    ? ((s.item as OpenLibraryDoc)['subtitle'] as string)
                    : ''
                  ).trim()

            const browserHref = (() => {
              if (s.endpoint === 'google') {
                const info = (s.item as GoogleBooksVolume).volumeInfo
                const previewLink =
                  typeof info?.previewLink === 'string'
                    ? info.previewLink
                    : undefined
                const infoLink =
                  typeof info?.infoLink === 'string' ? info.infoLink : undefined
                return previewLink || infoLink
              }

              const key = (s.item as OpenLibraryDoc)['key']
              if (typeof key === 'string' && key.trim()) {
                return `https://openlibrary.org/${key}`
              }
              return undefined
            })()

            const authors =
              s.endpoint === 'google'
                ? (
                    (s.item as GoogleBooksVolume).volumeInfo?.authors ?? []
                  ).join(', ')
                : Array.isArray((s.item as OpenLibraryDoc)['author_name'])
                  ? (
                      (s.item as OpenLibraryDoc)[
                        'author_name'
                      ] as Array<unknown>
                    )
                      .filter((a): a is string => typeof a === 'string')
                      .join(', ')
                  : ''

            const year =
              s.endpoint === 'google'
                ? tryParseYear(
                    (s.item as GoogleBooksVolume).volumeInfo?.publishedDate,
                  )
                : tryParseYearFromOpenLibrary(s.item)

            return (
              <Label
                key={s.id}
                aria-checked={selected}
                className={cn(
                  'border-border hover:border-primary/30 hover:bg-accent/50 has-aria-checked:border-primary has-aria-checked:bg-accent/30 m-0.5 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                )}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) =>
                    onChange({
                      sugerencias: sugerencias.map((x) =>
                        x.id === s.id ? { ...x, selected: !!checked } : x,
                      ),
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0 truncate text-sm font-medium">
                      {title}
                    </div>
                    {subtitle ? (
                      <div className="text-muted-foreground min-w-0 truncate text-xs">
                        {subtitle}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {authors || '—'}
                    {year ? ` • ${year}` : ''}
                  </div>
                  <div className="flex justify-between">
                    <a
                      href={browserHref}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        'text-muted-foreground hover:text-primary visited:text-primary/80 inline-flex items-center gap-1 text-xs underline transition-colors',
                        !browserHref && 'invisible',
                      )}
                    >
                      Ver ficha <LinkIcon className="h-3.5 w-3.5" />
                    </a>
                    <Badge variant="secondary" className="shrink-0">
                      {badgeLabel}
                    </Badge>
                  </div>
                </div>
              </Label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type BibliotecaStepProps = {
  sugerencias: Array<IASugerencia>
  onPatchSugerencia: (id: string, patch: Partial<IASugerencia>) => void
}

const BibliotecaStep = forwardRef<BibliotecaStepHandle, BibliotecaStepProps>(
  function BibliotecaStep({ sugerencias, onPatchSugerencia }, ref) {
    const [openIds, setOpenIds] = useState<Array<string>>([])
    const anchorRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const initializedRef = useRef(new Set<string>())

    const scrollToAccordion = (id: string) => {
      const el = anchorRefs.current[id]
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    useEffect(() => {
      for (const s of sugerencias) {
        const b = s.biblioteca
        const hasOptions = Array.isArray(b?.options)
        if (hasOptions) continue
        if (initializedRef.current.has(s.id)) continue

        initializedRef.current.add(s.id)

        const setIdx = Math.floor(Math.random() * 3)
        const templates = BIBLIOTECA_MATCH_SETS[setIdx] ?? []
        const options: Array<BibliotecaOption> = templates.map((t, i) => ({
          id: `biblio:${s.id}:${i + 1}`,
          ...t,
        }))

        onPatchSugerencia(s.id, {
          biblioteca: {
            options,
            choiceId: options.length === 0 ? 'online' : undefined,
          },
        })
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sugerencias])

    const validateBeforeNext = () => {
      const unresolved = sugerencias.find((s) => {
        const b = s.biblioteca
        if (!b || !Array.isArray(b.options)) return true
        if (b.options.length === 0) return false
        return !b.choiceId
      })

      if (!unresolved) return true

      setOpenIds((prev) =>
        prev.includes(unresolved.id) ? prev : [...prev, unresolved.id],
      )
      requestAnimationFrame(() => scrollToAccordion(unresolved.id))
      return false
    }

    useImperativeHandle(ref, () => ({ validateBeforeNext }))

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Comparar con alternativas de la biblioteca</CardTitle>
            <CardDescription>
              Conserva la sugerencia original o sustitúyela por una
              coincidencia.
            </CardDescription>
          </CardHeader>
        </Card>

        <Accordion
          type="multiple"
          value={openIds}
          onValueChange={setOpenIds}
          className="w-full space-y-2"
        >
          {sugerencias.map((s) => {
            const title = getOnlineSuggestionTitle(s)
            const subtitle = getOnlineSuggestionSubtitle(s)
            const authors = getOnlineSuggestionAuthors(s)
            const authorsLine = authors.join('; ') || '—'
            const year = getOnlineSuggestionYear(s)
            const isbn = getOnlineSuggestionIsbn(s)
            const sourceLabel =
              s.endpoint === 'google' ? 'Google Books' : 'Open Library'

            const b = s.biblioteca
            const options = b?.options ?? []

            const badgeState: 'por_revisar' | 'sustituido' | 'mantenido' =
              !b || !Array.isArray(b.options)
                ? 'por_revisar'
                : options.length === 0
                  ? 'mantenido'
                  : !b.choiceId
                    ? 'por_revisar'
                    : b.choiceId === 'online'
                      ? 'mantenido'
                      : 'sustituido'

            const badge =
              badgeState === 'por_revisar' ? (
                <Badge variant="secondary">Por revisar</Badge>
              ) : badgeState === 'sustituido' ? (
                <Badge variant="outline">Sustituido</Badge>
              ) : (
                <Badge>Mantenido</Badge>
              )

            const radioValue =
              b?.choiceId === 'online' || (options.length === 0 && !b?.choiceId)
                ? `online:${s.id}`
                : typeof b?.choiceId === 'string'
                  ? `biblio:${b.choiceId}`
                  : undefined

            return (
              <AccordionItem
                key={s.id}
                value={s.id}
                className="border-border/60 bg-background/40 rounded-lg border border-b-0 px-3"
              >
                <div
                  ref={(el) => {
                    anchorRefs.current[s.id] = el
                  }}
                />
                <AccordionTrigger className="hover:bg-accent/30 data-[state=open]:bg-accent/20 data-[state=open]:text-accent-foreground -mx-3 px-3">
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="min-w-0 text-wrap">{title}</span>
                    {badge}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground mt-4">
                  <div className="mx-1 grid gap-3 pb-2">
                    <BookSelectionAccordion
                      onlineSourceLabel={sourceLabel}
                      online={{
                        id: s.id,
                        title,
                        subtitle,
                        authorsLine,
                        year,
                        isbn,
                      }}
                      options={options}
                      value={radioValue}
                      onValueChange={(v) => {
                        const nextChoiceId = v.startsWith('online:')
                          ? 'online'
                          : v.startsWith('biblio:')
                            ? v.slice('biblio:'.length)
                            : undefined

                        if (!nextChoiceId) return

                        onPatchSugerencia(s.id, {
                          biblioteca: {
                            options,
                            choiceId: nextChoiceId,
                          },
                        })
                      }}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    )
  },
)

function DatosBasicosManualStep({
  draft,
  refs,
  onChangeDraft,
  onAddRef,
  onRemoveRef,
}: {
  draft: WizardState['manual']['draft']
  refs: Array<BibliografiaRef>
  onChangeDraft: (draft: WizardState['manual']['draft']) => void
  onAddRef: (ref: BibliografiaRef) => void
  onRemoveRef: (id: string) => void
}) {
  const canAdd = draft.title.trim().length > 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Agregar referencia</CardTitle>
          <CardDescription>
            Captura los datos y agrégala a la lista.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2">
            <Label>Título</Label>
            <Input
              value={draft.title}
              maxLength={500}
              onChange={(e) =>
                onChangeDraft({
                  ...draft,
                  title: e.target.value.slice(0, 500),
                })
              }
              onBlur={() => {
                const trimmed = draft.title.trim()
                if (trimmed !== draft.title) {
                  onChangeDraft({ ...draft, title: trimmed })
                }
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label>Autores (uno por línea)</Label>
            <Textarea
              value={draft.authorsText}
              maxLength={2000}
              onChange={(e) =>
                onChangeDraft({
                  ...draft,
                  authorsText: e.target.value.slice(0, 2000),
                })
              }
              className="min-h-22.5"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Editorial</Label>
              <Input
                value={draft.publisher}
                onChange={(e) =>
                  onChangeDraft({
                    ...draft,
                    publisher: e.target.value.slice(0, 300),
                  })
                }
                onBlur={() => {
                  const trimmed = draft.publisher.trim()
                  if (trimmed !== draft.publisher) {
                    onChangeDraft({ ...draft, publisher: trimmed })
                  }
                }}
                maxLength={300}
              />
            </div>
            <div className="grid gap-2">
              <Label>Año</Label>
              <Input
                value={draft.yearText}
                onChange={(e) =>
                  onChangeDraft({
                    ...draft,
                    yearText: sanitizeYearInput(e.target.value),
                  })
                }
                onBlur={() => {
                  if (!draft.yearText) return
                  if (!tryParseStrictYear(draft.yearText)) {
                    onChangeDraft({ ...draft, yearText: '' })
                  }
                }}
                type="number"
                inputMode="numeric"
                step={1}
                min={MIN_YEAR}
                max={MAX_YEAR}
                placeholder={(MAX_YEAR - 1).toString()}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>ISBN</Label>
            <Input
              value={draft.isbn}
              onChange={(e) =>
                onChangeDraft({
                  ...draft,
                  isbn: e.target.value.slice(0, 20),
                })
              }
              maxLength={20}
            />
          </div>

          <Button
            type="button"
            disabled={!canAdd}
            onClick={() => {
              const year = tryParseStrictYear(draft.yearText)
              const title = draft.title.trim()
              if (!title) return

              const ref: BibliografiaRef = {
                id: `manual-${randomUUID()}`,
                title,
                authors: draft.authorsText
                  .split(/\r?\n/)
                  .map((x) => x.trim())
                  .filter(Boolean),
                publisher: draft.publisher.trim() || undefined,
                year,
                isbn: draft.isbn.trim() || undefined,
                tipo: 'BASICA',
              }
              onAddRef(ref)
              onChangeDraft({
                title: '',
                authorsText: '',
                publisher: '',
                yearText: '',
                isbn: '',
              })
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Agregar a la lista
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referencias</CardTitle>
          <CardDescription>{refs.length} en total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {refs.map((r) => (
            <div
              key={r.id}
              className="border-border/60 bg-background flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.title}</div>
                <div className="text-muted-foreground text-xs">
                  {r.authors.join(', ') || '—'}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveRef(r.id)}
              >
                Quitar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

type FormatoYCitasStepHandle = {
  validateBeforeNext: () => boolean
}

type FormatoYCitasStepProps = {
  refs: Array<BibliografiaRef>
  formato: FormatoCita | null
  citations: Record<string, string>
  generatingIds: Set<string>
  onChangeFormato: (formato: FormatoCita | null) => void
  onRegenerate: () => void
  onChangeRef: (id: string, patch: Partial<BibliografiaRef>) => void
  onChangeTipo: (id: string, tipo: BibliografiaTipo) => void
}

const FormatoYCitasStep = forwardRef<
  FormatoYCitasStepHandle,
  FormatoYCitasStepProps
>(function FormatoYCitasStep(
  {
    refs,
    formato,
    citations,
    generatingIds,
    onChangeFormato,
    onRegenerate,
    onChangeRef,
    onChangeTipo,
  },
  ref,
) {
  const isGeneratingAny = generatingIds.size > 0
  const [authorsDraftById, setAuthorsDraftById] = useState<
    Record<string, string>
  >({})
  const [yearDraftById, setYearDraftById] = useState<Record<string, string>>({})
  const [titleErrorsById, setTitleErrorsById] = useState<
    Record<string, string>
  >({})

  const titleInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const scrollToTitle = (id: string) => {
    const el = titleInputRefs.current[id]
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.focus()
  }

  useEffect(() => {
    const ids = new Set(refs.map((r) => r.id))
    setAuthorsDraftById((prev) => {
      let next = prev

      for (const id of Object.keys(prev)) {
        if (!ids.has(id)) {
          if (next === prev) next = { ...prev }
          delete next[id]
        }
      }

      for (const r of refs) {
        if (typeof next[r.id] !== 'string') {
          if (next === prev) next = { ...prev }
          next[r.id] = r.authors.join('\n')
        }
      }

      return next
    })

    setYearDraftById((prev) => {
      let next = prev

      for (const id of Object.keys(prev)) {
        if (!ids.has(id)) {
          if (next === prev) next = { ...prev }
          delete next[id]
        }
      }

      for (const r of refs) {
        if (typeof next[r.id] !== 'string') {
          if (next === prev) next = { ...prev }
          next[r.id] = r.isInPress
            ? ''
            : typeof r.year === 'number'
              ? String(r.year)
              : ''
        }
      }

      return next
    })
  }, [refs])

  const validateBeforeNext = () => {
    const nextErrors: Record<string, string> = {}
    let firstInvalidId: string | undefined

    for (const r of refs) {
      const trimmed = r.title.trim()
      if (r.title !== trimmed) onChangeRef(r.id, { title: trimmed })

      if (!trimmed) {
        nextErrors[r.id] = 'El título es requerido'
        if (!firstInvalidId) firstInvalidId = r.id
      }
    }

    setTitleErrorsById(nextErrors)

    if (firstInvalidId) {
      scrollToTitle(firstInvalidId)
      return false
    }

    return true
  }

  useImperativeHandle(ref, () => ({ validateBeforeNext }))

  return (
    <div className="space-y-6">
      <div className="bg-muted/40 border-border sticky top-0 z-10 rounded-lg border p-4 backdrop-blur-md">
        <div className="flex flex-col items-end justify-between gap-4 sm:flex-row">
          <div className="w-full flex-1 space-y-1.5 sm:max-w-xs">
            <Label className="text-muted-foreground text-xs tracking-wider uppercase">
              Formato de citación
            </Label>
            <Select
              value={formato ?? ''}
              onValueChange={(v) => onChangeFormato(v as any)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apa">APA</SelectItem>
                <SelectItem value="ieee">IEEE</SelectItem>
                <SelectItem value="chicago">Chicago</SelectItem>
                <SelectItem value="vancouver">Vancouver</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full gap-2 sm:w-auto"
            onClick={onRegenerate}
            disabled={!formato || refs.length === 0 || isGeneratingAny}
          >
            <RefreshCw className="h-4 w-4" /> Regenerar citas
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          {refs.map((r) => {
            const isGenerating = generatingIds.has(r.id)

            const titleError = titleErrorsById[r.id]
            const authorsText = authorsDraftById[r.id] ?? r.authors.join('\n')
            const yearText = r.isInPress
              ? ''
              : (yearDraftById[r.id] ??
                (typeof r.year === 'number' ? String(r.year) : ''))
            const isbnText = r.isbn ?? ''
            const publisherText = r.publisher ?? ''

            return (
              <Card key={r.id} className="overflow-hidden">
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="space-y-2 sm:col-span-9">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">Título</Label>
                        {titleError ? (
                          <span className="text-destructive text-xs">
                            {titleError}
                          </span>
                        ) : null}
                      </div>
                      <Input
                        ref={(el) => {
                          titleInputRefs.current[r.id] = el
                        }}
                        value={r.title}
                        maxLength={500}
                        aria-invalid={Boolean(titleError)}
                        className={cn(
                          titleError &&
                            'border-destructive focus-visible:ring-destructive',
                        )}
                        disabled={isGeneratingAny || isGenerating}
                        onChange={(e) => {
                          const nextRaw = e.currentTarget.value.slice(0, 500)
                          const wasNonEmpty = r.title.trim().length > 0
                          const isEmptyNow = nextRaw.trim().length === 0

                          onChangeRef(r.id, { title: nextRaw })

                          if (isEmptyNow) {
                            setTitleErrorsById((prev) => ({
                              ...prev,
                              [r.id]: 'El título es requerido',
                            }))
                            if (wasNonEmpty) scrollToTitle(r.id)
                          } else {
                            setTitleErrorsById((prev) => {
                              if (!prev[r.id]) return prev
                              const next = { ...prev }
                              delete next[r.id]
                              return next
                            })
                          }
                        }}
                        onBlur={() => {
                          const trimmed = r.title.trim()
                          if (trimmed !== r.title)
                            onChangeRef(r.id, { title: trimmed })
                          if (!trimmed) {
                            setTitleErrorsById((prev) => ({
                              ...prev,
                              [r.id]: 'El título es requerido',
                            }))
                          }
                        }}
                      />
                    </div>

                    <div className="flex w-full flex-col items-start gap-2 sm:col-span-3 sm:items-stretch">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={r.tipo}
                        onValueChange={(v) => onChangeTipo(r.id, v as any)}
                        disabled={isGenerating || isGeneratingAny}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BASICA">Básica</SelectItem>
                          <SelectItem value="COMPLEMENTARIA">
                            Complementaria
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="space-y-2 sm:col-span-6">
                      <Label className="text-xs">Autores (uno por línea)</Label>
                      <Textarea
                        value={authorsText}
                        maxLength={2000}
                        disabled={isGeneratingAny || isGenerating}
                        className="min-h-22.5"
                        onChange={(e) => {
                          const nextText = e.currentTarget.value.slice(0, 2000)
                          setAuthorsDraftById((prev) => ({
                            ...prev,
                            [r.id]: nextText,
                          }))

                          onChangeRef(r.id, {
                            authors: nextText
                              .split(/\r?\n/)
                              .map((x) => x.trim())
                              .filter(Boolean),
                          })
                        }}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-6">
                      <Label className="text-xs">Editorial</Label>
                      <Input
                        value={publisherText}
                        maxLength={300}
                        disabled={isGeneratingAny || isGenerating}
                        onChange={(e) => {
                          const raw = e.currentTarget.value.slice(0, 300)
                          onChangeRef(r.id, {
                            publisher: raw.length > 0 ? raw : undefined,
                          })
                        }}
                        onBlur={() => {
                          const trimmed = publisherText.trim()
                          if (trimmed !== publisherText) {
                            onChangeRef(r.id, {
                              publisher: trimmed || undefined,
                            })
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="space-y-2 sm:col-span-3">
                      <Label className="text-xs">Año</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        step={1}
                        min={MIN_YEAR}
                        max={MAX_YEAR}
                        value={yearText}
                        disabled={
                          isGeneratingAny ||
                          isGenerating ||
                          Boolean(r.isInPress)
                        }
                        placeholder={(MAX_YEAR - 1).toString()}
                        onChange={(e) => {
                          const next = sanitizeYearInput(e.currentTarget.value)
                          setYearDraftById((prev) => ({
                            ...prev,
                            [r.id]: next,
                          }))

                          const year = tryParseStrictYear(next)
                          onChangeRef(r.id, {
                            year,
                          })
                        }}
                        onBlur={() => {
                          const current = yearDraftById[r.id] ?? ''
                          if (current.length === 0) return
                          const parsed = tryParseStrictYear(current)
                          if (!parsed) {
                            setYearDraftById((prev) => ({
                              ...prev,
                              [r.id]: '',
                            }))
                            onChangeRef(r.id, { year: undefined })
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={Boolean(r.yearIsApproximate)}
                          disabled={isGeneratingAny || isGenerating}
                          onCheckedChange={(checked) => {
                            const nextChecked = Boolean(checked)
                            onChangeRef(r.id, {
                              yearIsApproximate: nextChecked,
                              isInPress: nextChecked ? false : r.isInPress,
                            })
                          }}
                        />
                        <span className="text-xs">Año aproximado</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={Boolean(r.isInPress)}
                          disabled={isGeneratingAny || isGenerating}
                          onCheckedChange={(checked) => {
                            const nextChecked = Boolean(checked)
                            onChangeRef(r.id, {
                              isInPress: nextChecked,
                              yearIsApproximate: nextChecked
                                ? false
                                : r.yearIsApproximate,
                              year: nextChecked ? undefined : r.year,
                            })

                            if (nextChecked) {
                              setYearDraftById((prev) => ({
                                ...prev,
                                [r.id]: '',
                              }))
                            }
                          }}
                        />
                        <span className="text-xs">En prensa</span>
                      </div>
                    </div>

                    <div className="space-y-2 sm:col-span-6">
                      <Label className="text-xs">ISBN</Label>
                      <Input
                        value={isbnText}
                        maxLength={20}
                        disabled={isGeneratingAny || isGenerating}
                        onChange={(e) => {
                          const next = e.currentTarget.value.slice(0, 20)
                          onChangeRef(r.id, {
                            isbn: next.trim() || undefined,
                          })
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Cita generada</Label>
                    <div className="bg-muted/30 border-border rounded-md border px-3 py-2 text-sm">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {citations[r.id] ? (
                            <p className="wrap-break-word">{citations[r.id]}</p>
                          ) : (
                            <p className="text-muted-foreground">
                              Cita generada…
                            </p>
                          )}
                        </div>
                        {isGenerating ? (
                          <Loader2 className="text-muted-foreground mt-0.5 h-4 w-4 animate-spin" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
})

function ResumenStep({
  metodo,
  formato,
  refs,
  citations,
}: {
  metodo: MetodoBibliografia
  formato: FormatoCita | null
  refs: Array<BibliografiaRef>
  citations: Record<string, string>
}) {
  // 1. Separar las referencias
  const basicas = refs.filter((r) => r.tipo === 'BASICA')
  const complementarias = refs.filter((r) => r.tipo === 'COMPLEMENTARIA')
  const metodoLabel =
    metodo === 'MANUAL'
      ? 'Manual'
      : metodo === 'EN_LINEA'
        ? 'Buscar en línea'
        : '—'

  return (
    <div className="space-y-8">
      {/* Panel de Resumen General */}
      <div className="bg-muted/40 rounded-lg border p-4">
        <h3 className="text-foreground mb-4 text-sm font-semibold">
          Resumen de importación
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs uppercase">Método</p>
            <p className="font-medium">{metodoLabel}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Formato</p>
            <p className="font-medium uppercase">{formato ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Básicas</p>
            <p className="font-medium">{basicas.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">
              Complementarias
            </p>
            <p className="font-medium">{complementarias.length}</p>
          </div>
        </div>
      </div>

      {/* Sección: Bibliografía Básica */}
      {basicas.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-foreground border-b pb-2 text-sm font-medium">
            Bibliografía Básica
          </h4>
          <div className="space-y-2">
            {basicas.map((r) => (
              <div
                key={r.id}
                className="bg-background rounded-md border p-3 text-sm shadow-sm"
              >
                {(() => {
                  const warnings = [
                    r.authors.length === 0 ? 'Falta autor(es)' : null,
                    !r.isInPress && !r.year ? 'Falta año' : null,
                    !r.publisher ? 'Falta editorial' : null,
                    !r.isbn ? 'Falta ISBN' : null,
                  ].filter(Boolean) as Array<string>

                  return (
                    <>
                      <div className="mb-1 flex min-w-0 items-baseline gap-2">
                        <p className="min-w-0 truncate font-medium">
                          {r.title}
                        </p>
                        {r.subtitle ? (
                          <p className="text-muted-foreground min-w-0 truncate text-xs">
                            {r.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground">
                        {citations[r.id] ?? 'Sin cita generada'}
                      </p>
                      {warnings.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {warnings.map((w) => (
                            <p key={w} className="text-destructive text-xs">
                              {w}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección: Bibliografía Complementaria */}
      {complementarias.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-foreground border-b pb-2 text-sm font-medium">
            Bibliografía Complementaria
          </h4>
          <div className="space-y-2">
            {complementarias.map((r) => (
              <div
                key={r.id}
                className="bg-background rounded-md border p-3 text-sm shadow-sm"
              >
                {(() => {
                  const warnings = [
                    r.authors.length === 0 ? 'Falta autor(es)' : null,
                    !r.isInPress && !r.year ? 'Falta año' : null,
                    !r.publisher ? 'Falta editorial' : null,
                    !r.isbn ? 'Falta ISBN' : null,
                  ].filter(Boolean) as Array<string>

                  return (
                    <>
                      <div className="mb-1 flex min-w-0 items-baseline gap-2">
                        <p className="min-w-0 truncate font-medium">
                          {r.title}
                        </p>
                        {r.subtitle ? (
                          <p className="text-muted-foreground min-w-0 truncate text-xs">
                            {r.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground">
                        {citations[r.id] ?? 'Sin cita generada'}
                      </p>
                      {warnings.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {warnings.map((w) => (
                            <p key={w} className="text-destructive text-xs">
                              {w}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )
                })()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
