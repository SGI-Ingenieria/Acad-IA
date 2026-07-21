import { useStore } from '@tanstack/react-form'
import { Link as LinkIcon, Loader2, RefreshCw, X } from 'lucide-react'

import {
  computeRefsParaDetalle,
  tryParseYear,
  tryParseYearFromOpenLibrary,
} from '../lib'
import { nuevaBibliografiaFormOpts } from '../schema'
import { IDIOMA_LABEL } from '../types'

import type { IdiomaBibliografia } from '../types'
import type { GoogleBooksVolume, OpenLibraryDoc } from '@/data/api/subjects.api'

import { withForm } from '@/components/form'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const SugerenciasStep = withForm({
  ...nuevaBibliografiaFormOpts,
  props: {} as {
    /** Estado de la mutación de búsqueda en línea (vive en el contenedor). */
    isSearching: boolean
    searchError: string | null
    showConservacionTooltip: boolean
    onDismissConservacionTooltip: () => void
    onGenerate: () => void
  },
  render: function Render({
    form,
    isSearching,
    searchError,
    showConservacionTooltip,
    onDismissConservacionTooltip,
    onGenerate,
  }) {
    const q = useStore(form.store, (s) => s.values.ia.q)
    const sugerencias = useStore(form.store, (s) => s.values.ia.sugerencias)
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
            <form.AppField name="ia.q">
              {(field) => (
                <div className="grid gap-2">
                  <Label>Búsqueda</Label>
                  <Input
                    value={field.state.value}
                    maxLength={200}
                    onChange={(e) =>
                      field.handleChange(e.target.value.slice(0, 200))
                    }
                    onBlur={field.handleBlur}
                    placeholder="Ej: ingeniería de software, bases de datos..."
                  />
                </div>
              )}
            </form.AppField>

            <div className="mt-3 flex w-full flex-col items-end justify-between gap-3 sm:flex-row">
              <div className="w-full sm:w-56">
                <Label className="mb-2 block">Idioma</Label>
                <form.AppField name="ia.idioma">
                  {(field) => (
                    <Select
                      value={field.state.value}
                      onValueChange={(v) => {
                        field.handleChange(v as IdiomaBibliografia)
                        field.handleBlur()
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.keys(IDIOMA_LABEL) as Array<IdiomaBibliografia>
                        ).map((k) => (
                          <SelectItem key={k} value={k}>
                            {IDIOMA_LABEL[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </form.AppField>
              </div>

              {!isSearching && q.trim().length < 3 ? (
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
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="max-w-xs"
                  >
                    <p>El query debe ser de al menos 3 caracteres</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onGenerate}
                  disabled={
                    isSearching || q.trim().length < 3 || selectedCount >= 20
                  }
                  className="gap-2"
                >
                  {isSearching ? (
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

            {searchError ? (
              <div className="text-destructive text-sm">{searchError}</div>
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
          <form.AppField name="ia.sugerencias">
            {(field) => (
              <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
                {field.state.value.map((s) => {
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
                      ? (typeof (s.item as GoogleBooksVolume).volumeInfo
                          ?.subtitle === 'string'
                          ? ((s.item as GoogleBooksVolume).volumeInfo
                              ?.subtitle as string)
                          : ''
                        ).trim()
                      : (typeof (s.item as OpenLibraryDoc)['subtitle'] ===
                        'string'
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
                        typeof info?.infoLink === 'string'
                          ? info.infoLink
                          : undefined
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
                          (s.item as GoogleBooksVolume).volumeInfo?.authors ??
                          []
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
                          (s.item as GoogleBooksVolume).volumeInfo
                            ?.publishedDate,
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
                        onCheckedChange={(checked) => {
                          field.handleChange(
                            field.state.value.map((x) =>
                              x.id === s.id ? { ...x, selected: !!checked } : x,
                            ),
                          )
                          // La selección alimenta el snapshot del paso Detalles.
                          form.setFieldValue(
                            'refs',
                            computeRefsParaDetalle(form.state.values),
                          )
                        }}
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
                              'text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-xs underline transition-colors visited:text-[#551a8b] dark:visited:text-[#d0adf0]',
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
            )}
          </form.AppField>
        </div>
      </div>
    )
  },
})
