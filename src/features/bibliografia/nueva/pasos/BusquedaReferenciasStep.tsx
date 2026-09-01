import { useStore } from '@tanstack/react-form'
import {
  BookOpen,
  ExternalLink,
  Library,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo } from 'react'
import { useDebounce } from 'use-debounce'

import {
  bibliotecaItemToRef,
  computeRefsParaDetalle,
  getEndpointResultId,
  getBibliotecaInstitutionalHref,
  getOnlineSuggestionAuthors,
  getOnlineSuggestionSubtitle,
  getOnlineSuggestionTitle,
  getOnlineSuggestionYear,
  sortResultsByMostRecent,
} from '../lib'
import { nuevaBibliografiaFormOpts } from '../schema'
import {
  IDIOMA_LABEL,
  IDIOMA_TO_GOOGLE,
  IDIOMA_TO_OPEN_LIBRARY,
} from '../types'

import type {
  BibliografiaRef,
  BibliografiaTipo,
  FuenteBusquedaBibliografia,
  IASugerencia,
  IdiomaBibliografia,
} from '../types'
import type {
  BuscarBibliografiaRequest,
  EndpointResult,
  GoogleBooksVolume,
  OpenLibraryDoc,
} from '@/data'

import { withForm } from '@/components/form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useBusquedaBibliografiaEnLinea,
  useBusquedaBibliografiaInstitucional,
} from '@/data/hooks/useRepositories'
import { cn } from '@/lib/utils'

const MIN_QUERY_LENGTH = 3
export const BIBLIOGRAPHY_SEARCH_DEBOUNCE_MS = 350
const MAX_SELECTIONS = 20

export function construirBusquedaEnLinea(
  query: string,
  idioma: IdiomaBibliografia,
): BuscarBibliografiaRequest | null {
  const q = query.trim()
  if (q.length < MIN_QUERY_LENGTH) return null

  const google: BuscarBibliografiaRequest['google'] = {
    orderBy: 'newest',
    startIndex: 0,
  }
  const openLibrary: BuscarBibliografiaRequest['openLibrary'] = {
    sort: 'new',
    page: 1,
  }
  const googleLanguage = IDIOMA_TO_GOOGLE[idioma]
  const openLibraryLanguage = IDIOMA_TO_OPEN_LIBRARY[idioma]
  if (googleLanguage) google.langRestrict = googleLanguage
  if (openLibraryLanguage) openLibrary.language = openLibraryLanguage

  return {
    searchTerms: { q },
    google,
    openLibrary,
  }
}

export function construirBusquedaInstitucional(query: string) {
  const titulo = query.trim()
  if (titulo.length < MIN_QUERY_LENGTH) return null

  const posibleIsbn = titulo.replace(/[\s-]/g, '')
  const esIsbn = /^(?:\d{9}[\dxX]|\d{13})$/.test(posibleIsbn)
  return esIsbn ? { titulo, isbn: posibleIsbn } : { titulo }
}

function onlineHref(sugerencia: IASugerencia): string | undefined {
  if (sugerencia.endpoint === 'google') {
    const info = (sugerencia.item as GoogleBooksVolume).volumeInfo
    return info?.previewLink || info?.infoLink
  }
  const key = (sugerencia.item as OpenLibraryDoc)['key']
  return typeof key === 'string' && key.trim()
    ? `https://openlibrary.org/${key}`
    : undefined
}

export const BusquedaReferenciasStep = withForm({
  ...nuevaBibliografiaFormOpts,
  render: function Render({ form }) {
    const fuente = useStore(form.store, (s) => s.values.fuenteBusqueda)
    const tipo = useStore(form.store, (s) => s.values.tipoBusqueda)
    const onlineQuery = useStore(form.store, (s) => s.values.ia.q)
    const bibliotecaQuery = useStore(form.store, (s) => s.values.biblioteca.q)
    const idioma = useStore(form.store, (s) => s.values.ia.idioma)
    const onlineSelected = useStore(form.store, (s) => s.values.ia.sugerencias)
    const bibliotecaSelected = useStore(
      form.store,
      (s) => s.values.biblioteca.refs,
    )

    const [debouncedOnline, onlineDebounce] = useDebounce(
      onlineQuery.trim(),
      BIBLIOGRAPHY_SEARCH_DEBOUNCE_MS,
    )
    const [debouncedBiblioteca, bibliotecaDebounce] = useDebounce(
      bibliotecaQuery.trim(),
      BIBLIOGRAPHY_SEARCH_DEBOUNCE_MS,
    )

    const onlineParams = useMemo<BuscarBibliografiaRequest | null>(() => {
      if (fuente !== 'EN_LINEA' || debouncedOnline.length < MIN_QUERY_LENGTH) {
        return null
      }
      return construirBusquedaEnLinea(debouncedOnline, idioma)
    }, [debouncedOnline, fuente, idioma])

    const bibliotecaParams = useMemo(() => {
      if (
        fuente !== 'BIBLIOTECA' ||
        debouncedBiblioteca.length < MIN_QUERY_LENGTH
      ) {
        return null
      }
      return construirBusquedaInstitucional(debouncedBiblioteca)
    }, [debouncedBiblioteca, fuente])

    const onlineResults = useBusquedaBibliografiaEnLinea(onlineParams)
    const bibliotecaResults =
      useBusquedaBibliografiaInstitucional(bibliotecaParams)

    const currentQuery = fuente === 'EN_LINEA' ? onlineQuery : bibliotecaQuery
    const debouncedQuery =
      fuente === 'EN_LINEA' ? debouncedOnline : debouncedBiblioteca
    const isFetching =
      fuente === 'EN_LINEA'
        ? onlineResults.isFetching
        : bibliotecaResults.isFetching
    const isError =
      fuente === 'EN_LINEA' ? onlineResults.isError : bibliotecaResults.isError

    const totalSelected = onlineSelected.length + bibliotecaSelected.length
    const onlineItems = (onlineResults.data ?? [])
      .slice()
      .sort(sortResultsByMostRecent)
    const bibliotecaItems = bibliotecaResults.data?.results ?? []

    const syncRefs = (overrides: {
      sugerencias?: Array<IASugerencia>
      bibliotecaRefs?: Array<BibliografiaRef>
    }) => {
      const values = form.state.values
      form.setFieldValue(
        'refs',
        computeRefsParaDetalle({
          ...values,
          ia: {
            ...values.ia,
            sugerencias: overrides.sugerencias ?? values.ia.sugerencias,
          },
          biblioteca: {
            ...values.biblioteca,
            refs: overrides.bibliotecaRefs ?? values.biblioteca.refs,
          },
        }),
      )
    }

    const toggleOnline = (result: EndpointResult) => {
      const id = getEndpointResultId(result)
      const exists = onlineSelected.some((item) => item.id === id)
      const next = exists
        ? onlineSelected.filter((item) => item.id !== id)
        : [
            ...onlineSelected,
            {
              id,
              selected: true,
              endpoint: result.endpoint,
              item: result.item,
              tipo,
            } satisfies IASugerencia,
          ]
      form.setFieldValue('ia.sugerencias', next)
      syncRefs({ sugerencias: next })
    }

    const toggleBiblioteca = (item: (typeof bibliotecaItems)[number]) => {
      const ref = bibliotecaItemToRef(item, tipo)
      const exists = bibliotecaSelected.some((current) => current.id === ref.id)
      const next = exists
        ? bibliotecaSelected.filter((current) => current.id !== ref.id)
        : [...bibliotecaSelected, ref]
      form.setFieldValue('biblioteca.refs', next)
      syncRefs({ bibliotecaRefs: next })
    }

    const changeTipo = (nextTipo: BibliografiaTipo) => {
      const nextOnline = onlineSelected.map((item) => ({
        ...item,
        tipo: nextTipo,
      }))
      const nextBiblioteca = bibliotecaSelected.map((item) => ({
        ...item,
        tipo: nextTipo,
      }))
      form.setFieldValue('tipoBusqueda', nextTipo)
      form.setFieldValue('ia.sugerencias', nextOnline)
      form.setFieldValue('biblioteca.refs', nextBiblioteca)
      syncRefs({
        sugerencias: nextOnline,
        bibliotecaRefs: nextBiblioteca,
      })
    }

    const removeSelected = (id: string) => {
      const nextOnline = onlineSelected.filter((item) => item.id !== id)
      const nextBiblioteca = bibliotecaSelected.filter((item) => item.id !== id)
      form.setFieldValue('ia.sugerencias', nextOnline)
      form.setFieldValue('biblioteca.refs', nextBiblioteca)
      syncRefs({
        sugerencias: nextOnline,
        bibliotecaRefs: nextBiblioteca,
      })
    }

    const flushSearch = () => {
      if (fuente === 'EN_LINEA') onlineDebounce.flush()
      else bibliotecaDebounce.flush()
    }

    return (
      <div className="space-y-seccion">
        <header className="space-y-micro text-center">
          <h2 className="text-xl font-semibold">Encuentra las referencias</h2>
          <p className="text-muted-foreground text-sm">
            Busca en ambas fuentes y conserva una sola selección.
          </p>
        </header>

        <Tabs
          value={fuente}
          onValueChange={(next) =>
            form.setFieldValue(
              'fuenteBusqueda',
              next as FuenteBusquedaBibliografia,
            )
          }
        >
          <TabsList className="mx-auto grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="EN_LINEA">
              <BookOpen className="size-4" />
              En línea
            </TabsTrigger>
            <TabsTrigger value="BIBLIOTECA">
              <Library className="size-4" />
              Biblioteca institucional
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-control">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={currentQuery}
              onChange={(event) => {
                if (fuente === 'EN_LINEA') {
                  form.setFieldValue('ia.q', event.target.value.slice(0, 200))
                } else {
                  form.setFieldValue(
                    'biblioteca.q',
                    event.target.value.slice(0, 200),
                  )
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  flushSearch()
                }
              }}
              placeholder={
                fuente === 'EN_LINEA'
                  ? 'Título, autor o tema académico...'
                  : 'Título, autor o ISBN...'
              }
              aria-label={
                fuente === 'EN_LINEA'
                  ? 'Buscar referencias en línea'
                  : 'Buscar en la biblioteca institucional'
              }
              className="pr-pagina pl-pagina"
            />
            {isFetching ? (
              <Loader2 className="text-primary absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
            ) : null}
          </div>

          <div className="gap-control flex flex-col sm:flex-row">
            {fuente === 'EN_LINEA' ? (
              <div className="gap-relacionado grid flex-1">
                <Label htmlFor="bibliografia-idioma">Idioma</Label>
                <Select
                  value={idioma}
                  onValueChange={(next) =>
                    form.setFieldValue('ia.idioma', next as IdiomaBibliografia)
                  }
                >
                  <SelectTrigger id="bibliografia-idioma">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(IDIOMA_LABEL) as Array<IdiomaBibliografia>
                    ).map((key) => (
                      <SelectItem key={key} value={key}>
                        {IDIOMA_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="gap-relacionado grid flex-1">
              <Label htmlFor="bibliografia-tipo">Agregar como</Label>
              <Select
                value={tipo}
                onValueChange={(next) => changeTipo(next as BibliografiaTipo)}
              >
                <SelectTrigger id="bibliografia-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASICA">Bibliografía básica</SelectItem>
                  <SelectItem value="COMPLEMENTARIA">
                    Bibliografía complementaria
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div
          className="border-border/70 min-h-56 overflow-hidden rounded-xl border"
          aria-live="polite"
        >
          {currentQuery.trim().length < MIN_QUERY_LENGTH ? (
            <div className="text-muted-foreground px-seccion flex min-h-56 items-center justify-center text-center text-sm">
              Escribe al menos {MIN_QUERY_LENGTH} caracteres para comenzar.
            </div>
          ) : isError ? (
            <div className="text-destructive px-seccion flex min-h-56 items-center justify-center text-center text-sm">
              No se pudo completar la búsqueda. Intenta nuevamente.
            </div>
          ) : debouncedQuery.length < MIN_QUERY_LENGTH || isFetching ? (
            <div className="text-muted-foreground gap-relacionado px-seccion flex min-h-56 items-center justify-center text-sm">
              <Loader2 className="size-4 animate-spin" />
              Buscando referencias…
            </div>
          ) : fuente === 'EN_LINEA' && onlineItems.length === 0 ? (
            <div className="text-muted-foreground px-seccion flex min-h-56 items-center justify-center text-center text-sm">
              No encontramos obras para esa búsqueda.
            </div>
          ) : fuente === 'BIBLIOTECA' && bibliotecaItems.length === 0 ? (
            <div className="text-muted-foreground px-seccion flex min-h-56 items-center justify-center text-center text-sm">
              No hay coincidencias en el catálogo institucional.
            </div>
          ) : (
            <div className="max-h-80 divide-y overflow-y-auto">
              {fuente === 'EN_LINEA'
                ? onlineItems.map((result) => {
                    const id = getEndpointResultId(result)
                    const suggestion: IASugerencia = {
                      id,
                      selected: true,
                      endpoint: result.endpoint,
                      item: result.item,
                      tipo,
                    }
                    const checked = onlineSelected.some(
                      (item) => item.id === id,
                    )
                    const disabled = !checked && totalSelected >= MAX_SELECTIONS
                    const href = onlineHref(suggestion)
                    return (
                      <Label
                        key={id}
                        className={cn(
                          'hover:bg-accent/35 gap-control p-grupo flex cursor-pointer items-start transition-colors',
                          checked && 'bg-primary/5',
                          disabled && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={() => toggleOnline(result)}
                          className="mt-micro"
                        />
                        <span className="space-y-micro min-w-0 flex-1">
                          <span className="gap-control flex items-start justify-between">
                            <span className="font-medium">
                              {getOnlineSuggestionTitle(suggestion)}
                            </span>
                            <Badge variant="secondary" className="shrink-0">
                              {result.endpoint === 'google'
                                ? 'Google Books'
                                : 'Open Library'}
                            </Badge>
                          </span>
                          {getOnlineSuggestionSubtitle(suggestion) ? (
                            <span className="text-muted-foreground block text-sm">
                              {getOnlineSuggestionSubtitle(suggestion)}
                            </span>
                          ) : null}
                          <span className="text-muted-foreground block text-xs">
                            {getOnlineSuggestionAuthors(suggestion).join(
                              ', ',
                            ) || 'Autor no disponible'}
                            {getOnlineSuggestionYear(suggestion)
                              ? ` · ${getOnlineSuggestionYear(suggestion)}`
                              : ''}
                          </span>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="text-primary gap-micro inline-flex items-center text-xs hover:underline"
                            >
                              Ver ficha
                              <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                        </span>
                      </Label>
                    )
                  })
                : bibliotecaItems.map((item) => {
                    const id = `biblio-${item.id}`
                    const checked = bibliotecaSelected.some(
                      (current) => current.id === id,
                    )
                    const disabled = !checked && totalSelected >= MAX_SELECTIONS
                    const href = getBibliotecaInstitutionalHref(item.id)
                    return (
                      <Label
                        key={item.id}
                        className={cn(
                          'hover:bg-accent/35 gap-control p-grupo flex cursor-pointer items-start transition-colors',
                          checked && 'bg-primary/5',
                          disabled && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={() => toggleBiblioteca(item)}
                          className="mt-micro"
                        />
                        <span className="space-y-micro min-w-0 flex-1">
                          <span className="font-medium">{item.titulo}</span>
                          <span className="text-muted-foreground block text-sm">
                            {item.autor || 'Autor no disponible'}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {[item.editorial, item.anio]
                              .filter(Boolean)
                              .join(' · ') || 'Sin datos editoriales'}
                            {item.isbn ? ` · ISBN ${item.isbn}` : ''}
                          </span>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="text-primary gap-micro inline-flex items-center text-xs hover:underline"
                            >
                              Ver ficha
                              <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                        </span>
                      </Label>
                    )
                  })}
            </div>
          )}
        </div>

        <section className="border-border pt-seccion border-t">
          <div className="mb-control gap-control flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Selección</h3>
              <p className="text-muted-foreground text-xs">
                {totalSelected} de {MAX_SELECTIONS} referencias
              </p>
            </div>
            <Badge variant="secondary">{totalSelected}</Badge>
          </div>

          {totalSelected === 0 ? (
            <p className="text-muted-foreground text-sm">
              Las referencias que elijas aparecerán aquí.
            </p>
          ) : (
            <div className="gap-relacionado grid sm:grid-cols-2">
              {[
                ...onlineSelected.map((item) => ({
                  id: item.id,
                  title: getOnlineSuggestionTitle(item),
                  source: 'En línea',
                })),
                ...bibliotecaSelected.map((item) => ({
                  id: item.id,
                  title: item.title,
                  source: 'Biblioteca',
                })),
              ].map((item) => (
                <div
                  key={item.id}
                  className="bg-muted/45 gap-relacionado px-control py-relacionado flex min-w-0 items-center rounded-lg"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {item.source}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar ${item.title}`}
                    onClick={() => removeSelected(item.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    )
  },
})
