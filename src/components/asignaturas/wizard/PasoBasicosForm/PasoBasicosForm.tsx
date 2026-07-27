import { useStore } from '@tanstack/react-form'
import { Hash, Plus } from 'lucide-react'

import type { AnyFieldMeta } from '@tanstack/react-form'
import type { CSSProperties } from 'react'

import { withForm } from '@/components/form'
import { Button } from '@/components/ui/button'
import { EditableNumber } from '@/components/ui/editable-number'
import { EditableSelect } from '@/components/ui/editable-select'
import { EditableText } from '@/components/ui/editable-text'
import { EtiquetaEnFoco } from '@/components/ui/etiqueta-en-foco'
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

const fieldInvalid = (meta: AnyFieldMeta): boolean =>
  meta.isTouched && !meta.isValid
const SIN_ASIGNAR = 'Sin asignar'

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
    const creditosCalculados = useStore(form.store, (s) =>
      calcularCreditos(
        s.values.datosBasicos.horasAcademicas,
        s.values.datosBasicos.horasIndependientes,
      ),
    )

    const { data: plan } = usePlan(planId)
    const { data: lineas = [] } = usePlanLineas(planId)
    return (
      <div className="space-y-7">
        <div className="space-y-2">
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
                  className="border-border/70 focus:border-primary block w-full rounded-none border-b px-0 pb-2 text-3xl leading-tight font-bold"
                />
                <FieldErrorText meta={field.state.meta} id="nombre-error" />
              </div>
            )}
          </form.AppField>

          <form.AppField name="datosBasicos.codigo">
            {(field) => (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Hash className="size-4 shrink-0" aria-hidden />
                <span>Clave</span>
                <EditableText
                  value={field.state.value || ''}
                  onSave={field.handleChange}
                  placeholder="Pendiente"
                  maxLength={100}
                  ariaLabel="Clave de la asignatura"
                  className="text-foreground min-w-16 font-mono font-medium"
                />
              </div>
            )}
          </form.AppField>
        </div>

        {/* La fórmula se comporta como una frase editable: `grupo-enfoque` apaga
            todo lo que no se está tocando —incluida la otra cifra, que antes se
            quedaba a plena tinta y hacía parecer que el atenuado había fallado—
            y cada número lleva su etiqueta diferida. */}
        <div className="grupo-enfoque flex flex-wrap items-center justify-center gap-x-2 gap-y-2 py-3 text-2xl sm:text-3xl">
          <form.AppField name="datosBasicos.horasAcademicas">
            {(field) => (
              <span className="inline-flex items-baseline gap-1">
                <EtiquetaEnFoco etiqueta="Horas docente">
                  <EditableNumber
                    value={field.state.value ?? 0}
                    onSave={field.handleChange}
                    min={0}
                    max={999}
                    size="lg"
                    underline
                    overlayControls
                    ariaLabel="Horas docente"
                  />
                </EtiquetaEnFoco>
                <span
                  data-atenuar
                  className="text-muted-foreground text-sm font-semibold transition-opacity"
                >
                  HD
                </span>
              </span>
            )}
          </form.AppField>
          <span className="text-muted-foreground/50" aria-hidden>
            +
          </span>
          <form.AppField name="datosBasicos.horasIndependientes">
            {(field) => (
              <span className="inline-flex items-baseline gap-1">
                <EtiquetaEnFoco etiqueta="Horas independientes">
                  <EditableNumber
                    value={field.state.value ?? 0}
                    onSave={field.handleChange}
                    min={0}
                    max={999}
                    size="lg"
                    underline
                    overlayControls
                    ariaLabel="Horas independientes"
                  />
                </EtiquetaEnFoco>
                <span
                  data-atenuar
                  className="text-muted-foreground text-sm font-semibold transition-opacity"
                >
                  HI
                </span>
              </span>
            )}
          </form.AppField>
          <span className="text-muted-foreground/50" aria-hidden>
            =
          </span>
          <span className="inline-flex items-baseline gap-1 font-bold tabular-nums">
            {creditosCalculados.toFixed(2)}
            <span className="text-primary text-sm font-semibold">CR</span>
          </span>
        </div>

        <div className="border-border grid grid-cols-1 items-center gap-3 border-y py-5 sm:grid-cols-[minmax(11rem,0.7fr)_minmax(16rem,1.3fr)] sm:gap-4">
          <form.AppField name="datosBasicos.numeroCiclo">
            {(field) => {
              const nombreCiclo = plan?.tipo_ciclo || 'Ciclo'
              return (
                <div className="grupo-enfoque border-border/70 bg-muted/10 flex h-14 min-w-0 items-center justify-center gap-1 rounded-xl border px-4">
                  <span className="text-foreground/80 text-sm font-medium">
                    {nombreCiclo}
                  </span>
                  {field.state.value === null ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => field.handleChange(1)}
                    >
                      <Plus className="size-4" />
                      Añadir
                    </Button>
                  ) : (
                    <EtiquetaEnFoco etiqueta={`Número de ${nombreCiclo}`}>
                      <EditableNumber
                        value={field.state.value}
                        onSave={field.handleChange}
                        min={1}
                        max={Math.max(plan?.numero_ciclos ?? 1, 1)}
                        underline
                        overlayControls
                        ariaLabel={nombreCiclo}
                        className="text-foreground text-lg font-semibold"
                      />
                    </EtiquetaEnFoco>
                  )}
                </div>
              )
            }}
          </form.AppField>

          <form.AppField name="datosBasicos.lineaPlanId">
            {(field) => (
              <Select
                value={field.state.value ?? ''}
                onValueChange={(value) =>
                  field.handleChange(value === SIN_ASIGNAR ? null : value)
                }
                disabled={lineas.length === 0}
              >
                <SelectTrigger
                  size="lg"
                  className="relative w-full min-w-0 overflow-hidden border px-4 text-left shadow-none"
                >
                  <SelectValue placeholder="Elegir línea curricular" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                  {lineas.map((linea) => (
                    <SelectItem
                      key={linea.id}
                      value={linea.id}
                      // Mismo tratamiento que el selector de línea del mapa
                      // (`mapa.tsx`): la opción se tiñe con el color de su
                      // propia línea al enfocarla, no con el gris genérico, y
                      // usa la misma altura. Elegir la línea aquí y en el mapa
                      // tiene que sentirse el mismo acto.
                      className="focus:text-foreground! py-3 transition-colors focus:bg-(--linea-hover)!"
                      style={
                        {
                          '--linea-hover': linea.color
                            ? `color-mix(in oklab, ${linea.color} 16%, transparent)`
                            : 'var(--accent)',
                        } as CSSProperties
                      }
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className="bg-border h-6 w-1 rounded-full"
                          style={{ backgroundColor: linea.color ?? undefined }}
                        />
                        {linea.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </form.AppField>
        </div>

        <form.AppField
          name="datosBasicos.tipo"
          validators={{
            onChange: ({ value }) => primerError(tipoAsignaturaSchema, value),
          }}
        >
          {(field) => (
            <div className="grid gap-1">
              <EtiquetaEnFoco etiqueta="Tipo de asignatura" side="top">
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
                  className="justify-center uppercase"
                />
              </EtiquetaEnFoco>
              <FieldErrorText meta={field.state.meta} id="tipo-error" />
            </div>
          )}
        </form.AppField>
      </div>
    )
  },
})
