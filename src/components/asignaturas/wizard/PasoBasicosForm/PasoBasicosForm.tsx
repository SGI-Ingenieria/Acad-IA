import { useStore } from '@tanstack/react-form'

import type { AnyFieldMeta } from '@tanstack/react-form'
import type { CSSProperties } from 'react'

import { withForm } from '@/components/form'
import { EditableSelect } from '@/components/ui/editable-select'
import { EditableText } from '@/components/ui/editable-text'
import { InlineNumberEditor } from '@/components/ui/inline-number-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePlan, usePlanLineas } from '@/data'
import { TIPOS_MATERIA } from '@/features/asignaturas/nueva/catalogs'
import {
  nombreAsignaturaSchema,
  nuevaAsignaturaFormOpts,
  primerError,
  tipoAsignaturaSchema,
} from '@/features/asignaturas/nueva/schema'
import { calcularCreditos } from '@/lib/creditos-utils'
import { colorLineaCurricular } from '@/lib/linea-curricular-colors'

const fieldInvalid = (meta: AnyFieldMeta): boolean =>
  meta.isTouched && !meta.isValid
const SIN_ASIGNAR = 'Sin asignar'
const colorSubrayadoTipo = {
  OBLIGATORIA: 'border-primary',
  OPTATIVA: 'border-destructive',
  TRONCAL: 'border-chart-4',
  OTRA: 'border-chart-3',
} as const

function FieldErrorText({ meta, id }: { meta: AnyFieldMeta; id: string }) {
  if (!fieldInvalid(meta)) return null
  const message = meta.errors
    .map((e: unknown) =>
      typeof e === 'string' ? e : ((e as { message?: string }).message ?? ''),
    )
    .filter(Boolean)
    .join(', ')
  return (
    <p id={id} className="text-destructive text-sm">
      {message}
    </p>
  )
}

export const PasoBasicosForm = withForm({
  ...nuevaAsignaturaFormOpts,
  render: function Render({ form }) {
    const planId = useStore(form.store, (s) => s.values.plan_estudio_id)
    const lineaPlanId = useStore(
      form.store,
      (s) => s.values.datosBasicos.lineaPlanId,
    )
    const creditosCalculados = useStore(form.store, (s) =>
      calcularCreditos(
        s.values.datosBasicos.horasAcademicas,
        s.values.datosBasicos.horasIndependientes,
      ),
    )

    const { data: plan } = usePlan(planId)
    const { data: lineas = [] } = usePlanLineas(planId)
    const lineasConColor = lineas.map((linea, index) => ({
      ...linea,
      colorVisual: colorLineaCurricular(linea, index),
    }))
    const lineaSeleccionada = lineasConColor.find(
      (linea) => linea.id === lineaPlanId,
    )
    return (
      <div
        className="asignatura-acento mx-auto w-full max-w-3xl space-y-7"
        style={
          {
            '--asignatura-acento':
              lineaSeleccionada?.colorVisual ?? 'var(--primary)',
          } as CSSProperties
        }
      >
        <header className="mx-auto w-full max-w-2xl space-y-4 text-center">
          <form.AppField
            name="datosBasicos.nombre"
            validators={{ onChange: nombreAsignaturaSchema }}
          >
            {(field) => (
              <div className="grid gap-1">
                <EditableText
                  value={field.state.value}
                  onSave={field.handleChange}
                  placeholder="Nombre de la asignatura"
                  maxLength={200}
                  ariaLabel="Nombre de la asignatura"
                  className={`border-border/70 block w-full rounded-none border-b px-0 pb-2 text-3xl leading-tight font-bold ${
                    lineaSeleccionada
                      ? 'subrayado-acento'
                      : 'focus:border-primary'
                  }`}
                />
                <FieldErrorText meta={field.state.meta} id="nombre-error" />
              </div>
            )}
          </form.AppField>
        </header>

        <div className="grid gap-8 pt-7 lg:grid-cols-2">
          <section
            aria-labelledby="ubicacion-academica-title"
            className="space-y-6"
          >
            <div className="space-y-1">
              <h2 id="ubicacion-academica-title" className="font-semibold">
                Ubicación académica
              </h2>
            </div>

            <form.AppField
              name="datosBasicos.tipo"
              validators={{
                onChange: ({ value }) =>
                  primerError(tipoAsignaturaSchema, value),
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <span className="text-muted-foreground text-xs font-medium">
                    Tipo de asignatura
                  </span>
                  <EditableSelect
                    value={
                      TIPOS_MATERIA.find(
                        (tipo) => tipo.value === field.state.value,
                      )?.label ?? ''
                    }
                    options={TIPOS_MATERIA.map((tipo) => tipo.label)}
                    placeholder="Tipo de asignatura"
                    ariaLabel="Tipo de asignatura"
                    underline
                    onSave={(label) => {
                      const selected = TIPOS_MATERIA.find(
                        (tipo) => tipo.label === label,
                      )
                      if (selected) field.handleChange(selected.value)
                    }}
                    className={`h-10 justify-start text-left uppercase ${
                      lineaSeleccionada
                        ? 'subrayado-acento'
                        : field.state.value
                          ? colorSubrayadoTipo[field.state.value]
                          : ''
                    }`}
                  />
                  <FieldErrorText meta={field.state.meta} id="tipo-error" />
                </div>
              )}
            </form.AppField>

            <div className="grid items-start gap-5 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(12rem,1.3fr)]">
              <form.AppField name="datosBasicos.numeroCiclo">
                {(field) => {
                  const nombreCiclo = plan?.tipo_ciclo || 'Ciclo'
                  return (
                    <div className="grid min-w-0 justify-items-start gap-2">
                      <span className="text-muted-foreground text-xs font-medium">
                        {nombreCiclo}
                      </span>
                      <InlineNumberEditor
                        value={field.state.value}
                        min={1}
                        max={Math.max(plan?.numero_ciclos ?? 1, 1)}
                        onValueChange={field.handleChange}
                        className={`h-10 w-[5ch] text-2xl ${
                          lineaSeleccionada ? 'subrayado-acento' : ''
                        }`}
                      />
                    </div>
                  )
                }}
              </form.AppField>

              <form.AppField name="datosBasicos.lineaPlanId">
                {(field) => {
                  return (
                    <div className="grid gap-2">
                      <span className="text-muted-foreground text-xs font-medium">
                        Línea curricular
                      </span>
                      <Select
                        value={field.state.value ?? ''}
                        onValueChange={(value) =>
                          field.handleChange(
                            value === SIN_ASIGNAR ? null : value,
                          )
                        }
                        disabled={lineas.length === 0}
                      >
                        <SelectTrigger
                          size="default"
                          className={`relative w-full min-w-0 overflow-hidden rounded-none border-0 border-b-2 bg-transparent px-2 text-left shadow-none data-[size=default]:h-10 ${
                            lineaSeleccionada ? 'subrayado-acento' : ''
                          }`}
                          style={
                            lineaSeleccionada
                              ? {
                                  backgroundColor: `color-mix(in oklab, ${lineaSeleccionada.colorVisual} 10%, transparent)`,
                                }
                              : undefined
                          }
                        >
                          <SelectValue placeholder="Elegir línea curricular" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SIN_ASIGNAR}>
                            Sin asignar
                          </SelectItem>
                          {lineasConColor.map((linea) => (
                            <SelectItem
                              key={linea.id}
                              value={linea.id}
                              className="focus:text-foreground! py-3 transition-colors focus:bg-(--linea-hover)!"
                              style={
                                {
                                  '--linea-hover': `color-mix(in oklab, ${linea.colorVisual} 16%, transparent)`,
                                } as CSSProperties
                              }
                            >
                              <span className="flex items-center gap-3">
                                <span
                                  className="bg-border h-3 w-3 rounded-full"
                                  style={{
                                    backgroundColor: linea.colorVisual,
                                  }}
                                />
                                {linea.nombre}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                }}
              </form.AppField>
            </div>
          </section>

          <section
            aria-labelledby="carga-academica-title"
            className="space-y-6 lg:border-l lg:pl-8"
          >
            <div className="space-y-1">
              <h2 id="carga-academica-title" className="font-semibold">
                Carga académica
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-x-5 gap-y-6">
              <form.AppField name="datosBasicos.horasAcademicas">
                {(field) => (
                  <div className="grid justify-items-start gap-2">
                    <span className="text-muted-foreground text-xs font-medium">
                      Horas docentes
                    </span>
                    <span className="inline-flex h-10 items-center gap-2">
                      <InlineNumberEditor
                        value={field.state.value ?? 0}
                        min={0}
                        max={999}
                        onValueChange={field.handleChange}
                        className={`h-10 ${
                          lineaSeleccionada ? 'subrayado-acento' : ''
                        }`}
                      />
                      <span className="text-muted-foreground text-xs">
                        horas
                      </span>
                    </span>
                  </div>
                )}
              </form.AppField>

              <form.AppField name="datosBasicos.horasIndependientes">
                {(field) => (
                  <div className="grid justify-items-start gap-2">
                    <span className="text-muted-foreground text-xs font-medium">
                      Horas independientes
                    </span>
                    <span className="inline-flex h-10 items-center gap-2">
                      <InlineNumberEditor
                        value={field.state.value ?? 0}
                        min={0}
                        max={999}
                        onValueChange={field.handleChange}
                        className={`h-10 ${
                          lineaSeleccionada ? 'subrayado-acento' : ''
                        }`}
                      />
                      <span className="text-muted-foreground text-xs">
                        horas
                      </span>
                    </span>
                  </div>
                )}
              </form.AppField>

              <div className="col-span-2 pt-6">
                <div className="flex h-10 items-center justify-between gap-4">
                  <span className="text-muted-foreground text-sm">
                    Equivalencia
                  </span>
                  <span className="inline-flex items-baseline gap-1 font-bold tabular-nums">
                    <span className="text-2xl">
                      {creditosCalculados.toFixed(2)}
                    </span>
                    <span
                      className="text-primary text-xs font-semibold"
                      style={
                        lineaSeleccionada
                          ? { color: lineaSeleccionada.colorVisual }
                          : undefined
                      }
                    >
                      créditos
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  },
})
