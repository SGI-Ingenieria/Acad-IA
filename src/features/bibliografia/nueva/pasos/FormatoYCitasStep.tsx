import { useStore } from '@tanstack/react-form'
import { Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { sanitizeYearInput, tryParseStrictYear } from '../lib'
import {
  nuevaBibliografiaFormOpts,
  primerError,
  tituloReferenciaSchema,
} from '../schema'
import { MAX_YEAR, MIN_YEAR } from '../types'

import type { BibliografiaTipo, FormatoCita } from '../types'

import { withForm } from '@/components/form'
import { Button } from '@/components/ui/button'
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

export const FormatoYCitasStep = withForm({
  ...nuevaBibliografiaFormOpts,
  props: {} as {
    /** Referencias cuya cita se está generando (estado efímero del contenedor). */
    generatingIds: ReadonlySet<string>
    /** Genera las citas del formato recién elegido. */
    onFormatoChange: (formato: FormatoCita) => void
    onRegenerate: () => void
  },
  render: function Render({
    form,
    generatingIds,
    onFormatoChange,
    onRegenerate,
  }) {
    const refs = useStore(form.store, (s) => s.values.refs)
    const formato = useStore(form.store, (s) => s.values.formato)
    const citations = useStore(form.store, (s) =>
      s.values.formato ? s.values.citaEdits[s.values.formato] : SIN_CITAS,
    )

    const isGeneratingAny = generatingIds.size > 0

    // Borradores de texto locales: permiten teclear líneas vacías de autores
    // o años parciales sin ensuciar los valores canónicos del form. Se
    // resuelven con fallback perezoso (sin useEffect de resiembra): en este
    // paso no se agregan ni quitan referencias, solo se editan.
    const [authorsDraftById, setAuthorsDraftById] = useState<
      Record<string, string>
    >({})
    const [yearDraftById, setYearDraftById] = useState<Record<string, string>>(
      {},
    )

    return (
      <div className="space-y-6">
        <div className="bg-muted/40 border-border sticky top-0 z-10 rounded-lg border p-4 backdrop-blur-md">
          <div className="flex flex-col items-end justify-between gap-4 sm:flex-row">
            <div className="w-full flex-1 space-y-1.5 sm:max-w-xs">
              <Label className="text-muted-foreground text-xs tracking-wider uppercase">
                Formato de citación
              </Label>
              <form.AppField name="formato">
                {(field) => (
                  <Select
                    value={field.state.value ?? ''}
                    onValueChange={(v) => {
                      const next = v as FormatoCita
                      field.handleChange(next)
                      field.handleBlur()
                      onFormatoChange(next)
                    }}
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
                )}
              </form.AppField>
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
            {refs.map((r, i) => {
              const isGenerating = generatingIds.has(r.id)
              const disabled = isGeneratingAny || isGenerating

              return (
                <Card key={r.id} className="overflow-hidden">
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <form.AppField
                        name={`refs[${i}].title`}
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
                                (e): e is string =>
                                  typeof e === 'string' && e.length > 0,
                              ) ?? 'El título es requerido')
                            : null

                          return (
                            <div className="space-y-2 sm:col-span-9">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs" htmlFor={field.name}>
                                  Título
                                </Label>
                                {titleError ? (
                                  <span className="text-destructive text-xs">
                                    {titleError}
                                  </span>
                                ) : null}
                              </div>
                              <Input
                                id={field.name}
                                value={field.state.value}
                                maxLength={500}
                                aria-invalid={Boolean(titleError)}
                                className={cn(
                                  titleError &&
                                    'border-destructive focus-visible:ring-destructive',
                                )}
                                disabled={disabled}
                                onChange={(e) =>
                                  field.handleChange(
                                    e.currentTarget.value.slice(0, 500),
                                  )
                                }
                                onBlur={() => {
                                  const trimmed = field.state.value.trim()
                                  if (trimmed !== field.state.value) {
                                    field.handleChange(trimmed)
                                  }
                                  field.handleBlur()
                                }}
                              />
                            </div>
                          )
                        }}
                      </form.AppField>

                      <div className="flex w-full flex-col items-start gap-2 sm:col-span-3 sm:items-stretch">
                        <Label className="text-xs">Tipo</Label>
                        <form.AppField name={`refs[${i}].tipo`}>
                          {(field) => (
                            <Select
                              value={field.state.value}
                              onValueChange={(v) => {
                                field.handleChange(v as BibliografiaTipo)
                                field.handleBlur()
                              }}
                              disabled={disabled}
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

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <div className="space-y-2 sm:col-span-6">
                        <Label className="text-xs">
                          Autores (uno por línea)
                        </Label>
                        <form.AppField name={`refs[${i}].authors`}>
                          {(field) => (
                            <Textarea
                              value={
                                authorsDraftById[r.id] ??
                                field.state.value.join('\n')
                              }
                              maxLength={2000}
                              disabled={disabled}
                              className="min-h-22.5"
                              onChange={(e) => {
                                const nextText = e.currentTarget.value.slice(
                                  0,
                                  2000,
                                )
                                setAuthorsDraftById((prev) => ({
                                  ...prev,
                                  [r.id]: nextText,
                                }))
                                field.handleChange(
                                  nextText
                                    .split(/\r?\n/)
                                    .map((x) => x.trim())
                                    .filter(Boolean),
                                )
                              }}
                              onBlur={field.handleBlur}
                            />
                          )}
                        </form.AppField>
                      </div>

                      <div className="space-y-2 sm:col-span-6">
                        <Label className="text-xs">Editorial</Label>
                        <form.AppField name={`refs[${i}].publisher`}>
                          {(field) => (
                            <Input
                              value={field.state.value ?? ''}
                              maxLength={300}
                              disabled={disabled}
                              onChange={(e) => {
                                const raw = e.currentTarget.value.slice(0, 300)
                                field.handleChange(
                                  raw.length > 0 ? raw : undefined,
                                )
                              }}
                              onBlur={() => {
                                const current = field.state.value ?? ''
                                const trimmed = current.trim()
                                if (trimmed !== current) {
                                  field.handleChange(trimmed || undefined)
                                }
                                field.handleBlur()
                              }}
                            />
                          )}
                        </form.AppField>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <div className="space-y-2 sm:col-span-3">
                        <Label className="text-xs">Año</Label>
                        <form.AppField name={`refs[${i}].year`}>
                          {(field) => (
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
                              disabled={disabled || Boolean(r.isInPress)}
                              placeholder={(MAX_YEAR - 1).toString()}
                              onChange={(e) => {
                                const next = sanitizeYearInput(
                                  e.currentTarget.value,
                                )
                                setYearDraftById((prev) => ({
                                  ...prev,
                                  [r.id]: next,
                                }))
                                field.handleChange(tryParseStrictYear(next))
                              }}
                              onBlur={() => {
                                const current = yearDraftById[r.id] ?? ''
                                if (current.length > 0) {
                                  const parsed = tryParseStrictYear(current)
                                  if (!parsed) {
                                    setYearDraftById((prev) => ({
                                      ...prev,
                                      [r.id]: '',
                                    }))
                                    field.handleChange(undefined)
                                  }
                                }
                                field.handleBlur()
                              }}
                            />
                          )}
                        </form.AppField>
                      </div>

                      <div className="space-y-2 sm:col-span-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={Boolean(r.yearIsApproximate)}
                            disabled={disabled}
                            onCheckedChange={(checked) => {
                              const nextChecked = Boolean(checked)
                              form.setFieldValue(
                                `refs[${i}].yearIsApproximate`,
                                nextChecked,
                              )
                              if (nextChecked) {
                                form.setFieldValue(
                                  `refs[${i}].isInPress`,
                                  false,
                                )
                              }
                            }}
                          />
                          <span className="text-xs">Año aproximado</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={Boolean(r.isInPress)}
                            disabled={disabled}
                            onCheckedChange={(checked) => {
                              const nextChecked = Boolean(checked)
                              form.setFieldValue(
                                `refs[${i}].isInPress`,
                                nextChecked,
                              )
                              if (nextChecked) {
                                form.setFieldValue(
                                  `refs[${i}].yearIsApproximate`,
                                  false,
                                )
                                form.setFieldValue(`refs[${i}].year`, undefined)
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
                        <form.AppField name={`refs[${i}].isbn`}>
                          {(field) => (
                            <Input
                              value={field.state.value ?? ''}
                              maxLength={20}
                              disabled={disabled}
                              onChange={(e) => {
                                const next = e.currentTarget.value.slice(0, 20)
                                field.handleChange(next.trim() || undefined)
                              }}
                              onBlur={field.handleBlur}
                            />
                          )}
                        </form.AppField>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Cita generada</Label>
                      <div className="bg-muted/30 border-border rounded-md border px-3 py-2 text-sm">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            {citations[r.id] ? (
                              <p className="wrap-break-word">
                                {citations[r.id]}
                              </p>
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
  },
})
