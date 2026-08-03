import { useStore } from '@tanstack/react-form'
import { Plus } from 'lucide-react'

import {
  conCamposFaltantes,
  computeRefsParaDetalle,
  randomUUID,
  tryParseStrictYear,
  sanitizeYearInput,
} from '../lib'
import { nuevaBibliografiaFormOpts } from '../schema'
import { MAX_YEAR, MIN_YEAR } from '../types'

import type { BibliografiaRef } from '../types'

import { withForm } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const DatosBasicosManualStep = withForm({
  ...nuevaBibliografiaFormOpts,
  render: function Render({ form }) {
    const canAdd = useStore(
      form.store,
      (s) => s.values.manual.draft.title.trim().length > 0,
    )
    const refsCount = useStore(form.store, (s) => s.values.manual.refs.length)

    return (
      <div className="space-y-7">
        <header className="space-y-1 text-center">
          <h2 className="text-xl font-semibold">Captura las referencias</h2>
          <p className="text-muted-foreground text-sm">
            Registra cada obra y agrégala a la selección.
          </p>
        </header>

        <section className="grid gap-4" aria-labelledby="captura-referencia">
          <h3 id="captura-referencia" className="font-semibold">
            Nueva referencia
          </h3>
          <form.AppField name="manual.draft.title">
            {(field) => (
              <div className="grid gap-2">
                <Label>Título</Label>
                <Input
                  value={field.state.value}
                  maxLength={500}
                  onChange={(e) =>
                    field.handleChange(e.target.value.slice(0, 500))
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
            )}
          </form.AppField>

          <form.AppField name="manual.draft.authorsText">
            {(field) => (
              <div className="grid gap-2">
                <Label>Autores (uno por línea)</Label>
                <Textarea
                  value={field.state.value}
                  maxLength={2000}
                  onChange={(e) =>
                    field.handleChange(e.target.value.slice(0, 2000))
                  }
                  onBlur={field.handleBlur}
                  className="min-h-22.5"
                />
              </div>
            )}
          </form.AppField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <form.AppField name="manual.draft.publisher">
              {(field) => (
                <div className="grid gap-2">
                  <Label>Editorial</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(e.target.value.slice(0, 300))
                    }
                    onBlur={() => {
                      const trimmed = field.state.value.trim()
                      if (trimmed !== field.state.value) {
                        field.handleChange(trimmed)
                      }
                      field.handleBlur()
                    }}
                    maxLength={300}
                  />
                </div>
              )}
            </form.AppField>
            <form.AppField name="manual.draft.yearText">
              {(field) => (
                <div className="grid gap-2">
                  <Label>Año</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(sanitizeYearInput(e.target.value))
                    }
                    onBlur={() => {
                      if (
                        field.state.value &&
                        !tryParseStrictYear(field.state.value)
                      ) {
                        field.handleChange('')
                      }
                      field.handleBlur()
                    }}
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={MIN_YEAR}
                    max={MAX_YEAR}
                    placeholder={(MAX_YEAR - 1).toString()}
                  />
                </div>
              )}
            </form.AppField>
          </div>

          <form.AppField name="manual.draft.isbn">
            {(field) => (
              <div className="grid gap-2">
                <Label>ISBN</Label>
                <Input
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(e.target.value.slice(0, 20))
                  }
                  onBlur={field.handleBlur}
                  maxLength={20}
                />
              </div>
            )}
          </form.AppField>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={!canAdd}
              onClick={() => {
                const draft = form.state.values.manual.draft
                const year = tryParseStrictYear(draft.yearText)
                const title = draft.title.trim()
                if (!title) return

                const ref: BibliografiaRef = conCamposFaltantes({
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
                })
                const nextRefs = [...form.state.values.manual.refs, ref]
                form.setFieldValue('manual.refs', nextRefs)
                form.setFieldValue('manual.draft', {
                  title: '',
                  authorsText: '',
                  publisher: '',
                  yearText: '',
                  isbn: '',
                })
                form.setFieldValue(
                  'refs',
                  computeRefsParaDetalle({
                    ...form.state.values,
                    manual: {
                      ...form.state.values.manual,
                      refs: nextRefs,
                    },
                  }),
                )
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Agregar referencia
            </Button>
          </div>
        </section>

        <section
          className="border-border space-y-3 border-t pt-5"
          aria-labelledby="referencias-capturadas"
        >
          <div className="flex items-end justify-between gap-3">
            <h3 id="referencias-capturadas" className="font-semibold">
              Selección
            </h3>
            <span className="text-muted-foreground text-sm">
              {refsCount} en total
            </span>
          </div>
          <form.AppField name="manual.refs" mode="array">
            {(field) => (
              <>
                {field.state.value.map((r, index) => (
                  <div
                    key={r.id}
                    className="border-border/60 bg-background flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {r.title}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {r.authors.join(', ') || '—'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const nextRefs = field.state.value.filter(
                          (_, currentIndex) => currentIndex !== index,
                        )
                        form.setFieldValue('manual.refs', nextRefs)
                        form.setFieldValue(
                          'refs',
                          computeRefsParaDetalle({
                            ...form.state.values,
                            manual: {
                              ...form.state.values.manual,
                              refs: nextRefs,
                            },
                          }),
                        )
                      }}
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
              </>
            )}
          </form.AppField>
        </section>
      </div>
    )
  },
})
