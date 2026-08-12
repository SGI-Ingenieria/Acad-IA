import { useStore } from '@tanstack/react-form'
import { BookOpenText, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'

import { sanitizeYearInput, tryParseStrictYear } from '../lib'
import {
  nuevaBibliografiaFormOpts,
  primerError,
  tituloReferenciaSchema,
} from '../schema'
import { MAX_YEAR, MIN_YEAR } from '../types'

import type {
  BibliografiaRef,
  BibliografiaTipo,
  CampoBibliografiaFaltante,
  FormatoCita,
} from '../types'

import { withForm } from '@/components/form'
import { Card, CardContent } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const SIN_CITAS: Record<string, string> = {}
const CITATION_UPDATE_DEBOUNCE_MS = 350

function tieneCampoFaltante(
  campos: ReadonlyArray<CampoBibliografiaFaltante>,
  campo: CampoBibliografiaFaltante,
) {
  return campos.includes(campo)
}

export const FormatoYCitasStep = withForm({
  ...nuevaBibliografiaFormOpts,
  props: {} as {
    /** Referencias cuya cita se está actualizando. */
    generatingIds: ReadonlySet<string>
    /** Genera la previsualización para el formato y los datos vigentes. */
    onGenerateCitations: (
      formato: FormatoCita,
      refs: Array<BibliografiaRef>,
    ) => void | Promise<void>
    /** Descarta una generación anterior cuando cambian sus datos de entrada. */
    onCitationDataChange: () => void
  },
  render: function Render({
    form,
    generatingIds,
    onGenerateCitations,
    onCitationDataChange,
  }) {
    const refs = useStore(form.store, (s) => s.values.refs)
    const formato = useStore(form.store, (s) => s.values.formato)
    const citations = useStore(form.store, (s) =>
      s.values.formato ? s.values.citaEdits[s.values.formato] : SIN_CITAS,
    )
    const [debouncedRefs] = useDebounce(refs, CITATION_UPDATE_DEBOUNCE_MS)

    // Estos borradores permiten escribir autores por líneas y años parciales
    // sin perder el cursor mientras el valor canónico se normaliza.
    const [authorsDraftById, setAuthorsDraftById] = useState<
      Record<string, string>
    >({})
    const [yearDraftById, setYearDraftById] = useState<Record<string, string>>(
      {},
    )

    useEffect(() => {
      if (!formato || debouncedRefs.length === 0) return
      void onGenerateCitations(formato, debouncedRefs)
    }, [debouncedRefs, formato, onGenerateCitations])

    const invalidarCita = (id: string) => {
      onCitationDataChange()
      const currentFormat = form.state.values.formato
      if (!currentFormat) return
      const edits = form.state.values.citaEdits
      form.setFieldValue('citaEdits', {
        ...edits,
        [currentFormat]: {
          ...edits[currentFormat],
          [id]: '',
        },
      })
    }

    return (
      <div className="space-y-seccion">
        <header className="space-y-grupo">
          <div className="space-y-micro">
            <h2 className="text-xl font-semibold">
              Previsualización bibliográfica
            </h2>
            <p className="text-muted-foreground text-sm">
              La cita se actualiza automáticamente. Los datos encontrados se
              conservan y solo puedes completar los que faltan.
            </p>
          </div>

          <div className="space-y-relacionado w-full sm:max-w-xs">
            <Label className="text-muted-foreground text-xs tracking-wider uppercase">
              Formato de citación
            </Label>
            <form.AppField name="formato">
              {(field) => (
                <Select
                  value={field.state.value ?? 'apa'}
                  onValueChange={(value) => {
                    const next = value as FormatoCita
                    const edits = form.state.values.citaEdits
                    onCitationDataChange()
                    field.handleChange(next)
                    field.handleBlur()
                    form.setFieldValue('citaEdits', {
                      ...edits,
                      [next]: {},
                    })
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apa">APA</SelectItem>
                    <SelectItem value="ieee">IEEE</SelectItem>
                    <SelectItem value="chicago">Chicago</SelectItem>
                    <SelectItem value="vancouver">Vancouver</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </form.AppField>
          </div>
        </header>

        <div className="space-y-grupo">
          {refs.map((r, index) => {
            const campos = r.camposFaltantes
            const tituloFaltante = tieneCampoFaltante(campos, 'title')
            const autoresFaltantes = tieneCampoFaltante(campos, 'authors')
            const editorialFaltante = tieneCampoFaltante(campos, 'publisher')
            const anioFaltante = tieneCampoFaltante(campos, 'year')
            const isbnFaltante = tieneCampoFaltante(campos, 'isbn')
            const isGenerating = generatingIds.has(r.id)
            const tieneDatosFaltantes = campos.length > 0

            return (
              <Card key={r.id} className="overflow-hidden">
                <CardContent className="space-y-seccion">
                  <div className="gap-grupo flex flex-col sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-micro min-w-0">
                      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                        Referencia {index + 1}
                      </p>
                      <h3 className="font-semibold wrap-break-word">
                        {tituloFaltante ? 'Referencia por completar' : r.title}
                      </h3>
                      {!tituloFaltante && r.subtitle ? (
                        <p className="text-muted-foreground text-sm">
                          {r.subtitle}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-relacionado w-full sm:w-48">
                      <Label className="text-muted-foreground text-xs">
                        Clasificación
                      </Label>
                      <form.AppField name={`refs[${index}].tipo`}>
                        {(field) => (
                          <Select
                            value={field.state.value}
                            onValueChange={(value) => {
                              field.handleChange(value as BibliografiaTipo)
                              field.handleBlur()
                              invalidarCita(r.id)
                            }}
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
                        )}
                      </form.AppField>
                    </div>
                  </div>

                  <dl className="gap-x-seccion gap-y-control grid text-sm sm:grid-cols-2">
                    {r.authors.length > 0 ? (
                      <div>
                        <dt className="text-muted-foreground text-xs">
                          Autores
                        </dt>
                        <dd>{r.authors.join('; ')}</dd>
                      </div>
                    ) : null}
                    {r.publisher ? (
                      <div>
                        <dt className="text-muted-foreground text-xs">
                          Editorial
                        </dt>
                        <dd>{r.publisher}</dd>
                      </div>
                    ) : null}
                    {typeof r.year === 'number' || r.isInPress ? (
                      <div>
                        <dt className="text-muted-foreground text-xs">Año</dt>
                        <dd>
                          {r.isInPress
                            ? 'En prensa'
                            : `${r.year}${r.yearIsApproximate ? ' (aproximado)' : ''}`}
                        </dd>
                      </div>
                    ) : null}
                    {r.isbn ? (
                      <div>
                        <dt className="text-muted-foreground text-xs">ISBN</dt>
                        <dd>{r.isbn}</dd>
                      </div>
                    ) : null}
                  </dl>

                  {tieneDatosFaltantes ? (
                    <section
                      className="border-border space-y-grupo pt-grupo border-t"
                      aria-labelledby={`faltantes-${r.id}`}
                    >
                      <div className="space-y-micro">
                        <h4
                          id={`faltantes-${r.id}`}
                          className="text-sm font-medium"
                        >
                          Completar datos faltantes
                        </h4>
                      </div>

                      <div className="gap-grupo grid grid-cols-1 sm:grid-cols-2">
                        {tituloFaltante ? (
                          <form.AppField
                            name={`refs[${index}].title`}
                            validators={{
                              onChange: ({ value }) =>
                                primerError(tituloReferenciaSchema, value),
                            }}
                          >
                            {(field) => {
                              const invalid =
                                field.state.meta.isTouched &&
                                !field.state.meta.isValid
                              const titleError = invalid
                                ? (field.state.meta.errors.find(
                                    (error): error is string =>
                                      typeof error === 'string' &&
                                      error.length > 0,
                                  ) ?? 'El título es requerido')
                                : null

                              return (
                                <div className="space-y-relacionado sm:col-span-2">
                                  <Label htmlFor={field.name}>Título</Label>
                                  <Input
                                    id={field.name}
                                    value={
                                      field.state.value.trim().toLowerCase() ===
                                      'sin título'
                                        ? ''
                                        : field.state.value
                                    }
                                    maxLength={500}
                                    placeholder="Título de la obra"
                                    aria-invalid={Boolean(titleError)}
                                    className={cn(
                                      titleError &&
                                        'border-destructive focus-visible:ring-destructive',
                                    )}
                                    onChange={(event) => {
                                      field.handleChange(
                                        event.currentTarget.value.slice(0, 500),
                                      )
                                      invalidarCita(r.id)
                                    }}
                                    onBlur={() => {
                                      const trimmed = field.state.value.trim()
                                      if (trimmed !== field.state.value) {
                                        field.handleChange(trimmed)
                                        invalidarCita(r.id)
                                      }
                                      field.handleBlur()
                                    }}
                                  />
                                  {titleError ? (
                                    <p className="text-destructive text-xs">
                                      {titleError}
                                    </p>
                                  ) : null}
                                </div>
                              )
                            }}
                          </form.AppField>
                        ) : null}

                        {autoresFaltantes ? (
                          <form.AppField name={`refs[${index}].authors`}>
                            {(field) => (
                              <div className="space-y-relacionado sm:col-span-2">
                                <Label>Autores (uno por línea)</Label>
                                <Textarea
                                  value={
                                    authorsDraftById[r.id] ??
                                    field.state.value.join('\n')
                                  }
                                  maxLength={2000}
                                  className="min-h-22.5"
                                  placeholder="Nombre del autor"
                                  onChange={(event) => {
                                    const nextText =
                                      event.currentTarget.value.slice(0, 2000)
                                    setAuthorsDraftById((current) => ({
                                      ...current,
                                      [r.id]: nextText,
                                    }))
                                    field.handleChange(
                                      nextText
                                        .split(/\r?\n/)
                                        .map((author) => author.trim())
                                        .filter(Boolean),
                                    )
                                    invalidarCita(r.id)
                                  }}
                                  onBlur={field.handleBlur}
                                />
                              </div>
                            )}
                          </form.AppField>
                        ) : null}

                        {editorialFaltante ? (
                          <form.AppField name={`refs[${index}].publisher`}>
                            {(field) => (
                              <div className="space-y-relacionado">
                                <Label>Editorial</Label>
                                <Input
                                  value={field.state.value ?? ''}
                                  maxLength={300}
                                  placeholder="Nombre de la editorial"
                                  onChange={(event) => {
                                    const next =
                                      event.currentTarget.value.slice(0, 300)
                                    field.handleChange(next || undefined)
                                    invalidarCita(r.id)
                                  }}
                                  onBlur={() => {
                                    const current = field.state.value ?? ''
                                    const trimmed = current.trim()
                                    if (trimmed !== current) {
                                      field.handleChange(trimmed || undefined)
                                      invalidarCita(r.id)
                                    }
                                    field.handleBlur()
                                  }}
                                />
                              </div>
                            )}
                          </form.AppField>
                        ) : null}

                        {isbnFaltante ? (
                          <form.AppField name={`refs[${index}].isbn`}>
                            {(field) => (
                              <div className="space-y-relacionado">
                                <Label>ISBN</Label>
                                <Input
                                  value={field.state.value ?? ''}
                                  maxLength={20}
                                  placeholder="ISBN-10 o ISBN-13"
                                  onChange={(event) => {
                                    field.handleChange(
                                      event.currentTarget.value.slice(0, 20) ||
                                        undefined,
                                    )
                                    invalidarCita(r.id)
                                  }}
                                  onBlur={() => {
                                    const current = field.state.value ?? ''
                                    const trimmed = current.trim()
                                    if (trimmed !== current) {
                                      field.handleChange(trimmed || undefined)
                                      invalidarCita(r.id)
                                    }
                                    field.handleBlur()
                                  }}
                                />
                              </div>
                            )}
                          </form.AppField>
                        ) : null}

                        {anioFaltante ? (
                          <div className="space-y-control sm:col-span-2">
                            <form.AppField name={`refs[${index}].year`}>
                              {(field) => (
                                <div className="space-y-relacionado sm:max-w-xs">
                                  <Label>Año</Label>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    step={1}
                                    min={MIN_YEAR}
                                    max={MAX_YEAR}
                                    value={
                                      r.isInPress
                                        ? ''
                                        : (yearDraftById[r.id] ??
                                          (typeof field.state.value === 'number'
                                            ? String(field.state.value)
                                            : ''))
                                    }
                                    disabled={Boolean(r.isInPress)}
                                    placeholder={(MAX_YEAR - 1).toString()}
                                    onChange={(event) => {
                                      const next = sanitizeYearInput(
                                        event.currentTarget.value,
                                      )
                                      setYearDraftById((current) => ({
                                        ...current,
                                        [r.id]: next,
                                      }))
                                      field.handleChange(
                                        tryParseStrictYear(next),
                                      )
                                      invalidarCita(r.id)
                                    }}
                                    onBlur={() => {
                                      const current = yearDraftById[r.id] ?? ''
                                      if (
                                        current.length > 0 &&
                                        !tryParseStrictYear(current)
                                      ) {
                                        setYearDraftById((drafts) => ({
                                          ...drafts,
                                          [r.id]: '',
                                        }))
                                        field.handleChange(undefined)
                                        invalidarCita(r.id)
                                      }
                                      field.handleBlur()
                                    }}
                                  />
                                </div>
                              )}
                            </form.AppField>

                            <div className="gap-x-seccion gap-y-relacionado flex flex-wrap">
                              <div className="gap-relacionado flex items-center">
                                <Checkbox
                                  id={`year-approximate-${index}`}
                                  checked={Boolean(r.yearIsApproximate)}
                                  disabled={Boolean(r.isInPress || !r.year)}
                                  onCheckedChange={(checked) => {
                                    form.setFieldValue(
                                      `refs[${index}].yearIsApproximate`,
                                      Boolean(checked),
                                    )
                                    invalidarCita(r.id)
                                  }}
                                />
                                <Label
                                  htmlFor={`year-approximate-${index}`}
                                  className="font-normal"
                                >
                                  Año aproximado
                                </Label>
                              </div>

                              <div className="gap-relacionado flex items-center">
                                <Checkbox
                                  id={`in-press-${index}`}
                                  checked={Boolean(r.isInPress)}
                                  onCheckedChange={(checked) => {
                                    const next = Boolean(checked)
                                    form.setFieldValue(
                                      `refs[${index}].isInPress`,
                                      next,
                                    )
                                    if (next) {
                                      form.setFieldValue(
                                        `refs[${index}].yearIsApproximate`,
                                        false,
                                      )
                                      form.setFieldValue(
                                        `refs[${index}].year`,
                                        undefined,
                                      )
                                      setYearDraftById((current) => ({
                                        ...current,
                                        [r.id]: '',
                                      }))
                                    }
                                    invalidarCita(r.id)
                                  }}
                                />
                                <Label
                                  htmlFor={`in-press-${index}`}
                                  className="font-normal"
                                >
                                  En prensa
                                </Label>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  <section
                    className="bg-muted/30 border-border px-grupo py-control rounded-md border"
                    aria-label={`Cita ${formato?.toUpperCase() ?? 'APA'}`}
                    aria-live="polite"
                  >
                    <div className="gap-control flex items-start">
                      <BookOpenText className="text-muted-foreground mt-micro h-4 w-4 shrink-0" />
                      <div className="space-y-micro min-w-0 flex-1">
                        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                          Cita {formato?.toUpperCase() ?? 'APA'}
                        </p>
                        {citations[r.id] ? (
                          <p className="text-sm wrap-break-word">
                            {citations[r.id]}
                          </p>
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            Actualizando cita…
                          </p>
                        )}
                      </div>
                      {isGenerating ? (
                        <Loader2 className="text-muted-foreground mt-micro h-4 w-4 shrink-0 animate-spin" />
                      ) : null}
                    </div>
                  </section>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  },
})
