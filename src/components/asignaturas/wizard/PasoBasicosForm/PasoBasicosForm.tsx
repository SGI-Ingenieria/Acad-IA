import { useStore } from '@tanstack/react-form'
import { AlertTriangle } from 'lucide-react'

import PasoSugerenciasForm from './PasoSugerenciasForm'

import type { TipoAsignatura } from '@/features/asignaturas/nueva/types'
import type { Database } from '@/types/supabase'
import type { AnyFieldMeta } from '@tanstack/react-form'

import { withForm } from '@/components/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSubjectEstructuras } from '@/data'
import { TIPOS_MATERIA } from '@/features/asignaturas/nueva/catalogs'
import {
  estructuraSchema,
  nombreAsignaturaSchema,
  nuevaAsignaturaFormOpts,
  primerError,
  tipoAsignaturaSchema,
} from '@/features/asignaturas/nueva/schema'
import { calcularCreditos } from '@/lib/creditos-utils'
import { cn } from '@/lib/utils'

/** Coerción original: naturales sin cero, truncados y limitados a 999. */
const coerceHoras = (raw: string): number | null => {
  if (raw === '') return null
  const asNumber = Number(raw)
  if (Number.isNaN(asNumber)) return null
  const n = Math.floor(Math.abs(asNumber))
  return Math.min(n >= 1 ? n : 1, 999)
}

const fieldInvalid = (meta: AnyFieldMeta): boolean =>
  meta.isTouched && !meta.isValid

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

// Anotación explícita (no `as`): tipa las props extra que acepta withForm.
const defaultProps: {
  estructuraFuenteId?: string | null
  estructuraPlanId?: string | null
} = {}

export const PasoBasicosForm = withForm({
  ...nuevaAsignaturaFormOpts,
  props: defaultProps,
  render: function Render({ form, estructuraFuenteId, estructuraPlanId }) {
    const tipoOrigen = useStore(form.store, (s) => s.values.tipoOrigen)
    const estructuraIdActual = useStore(
      form.store,
      (s) => s.values.datosBasicos.estructuraId,
    )
    const creditosCalculados = useStore(form.store, (s) =>
      calcularCreditos(
        s.values.datosBasicos.horasAcademicas,
        s.values.datosBasicos.horasIndependientes,
      ),
    )

    const { data: estructuras } = useSubjectEstructuras(estructuraPlanId)

    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return (
        <div className="grid gap-4">
          <form.AppField
            name="datosBasicos.estructuraId"
            validators={{
              onChange: ({ value }) => primerError(estructuraSchema, value),
            }}
          >
            {(field) => (
              <div className="grid gap-1">
                <Label htmlFor="estructura">Estructura de la asignatura</Label>
                <Select
                  value={field.state.value ?? ''}
                  onValueChange={(val) => field.handleChange(val)}
                >
                  <SelectTrigger
                    id="estructura"
                    aria-invalid={fieldInvalid(field.state.meta)}
                    className={cn(
                      'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                      !field.state.value
                        ? 'text-muted-foreground font-normal italic opacity-70'
                        : 'font-medium not-italic',
                    )}
                  >
                    <SelectValue placeholder="Selecciona plantilla..." />
                  </SelectTrigger>
                  <SelectContent>
                    {estructuras?.map(
                      (
                        e: Database['public']['Tables']['estructuras_asignatura']['Row'],
                      ) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nombre}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <FieldErrorText meta={field.state.meta} id="estructura-error" />
              </div>
            )}
          </form.AppField>
        </div>
      )
    }

    if (tipoOrigen !== 'IA_MULTIPLE') {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <form.AppField
            name="datosBasicos.nombre"
            validators={{ onChange: nombreAsignaturaSchema }}
          >
            {(field) => (
              <div className="grid gap-1 sm:col-span-2">
                <Label htmlFor="nombre">Nombre de la asignatura</Label>
                <Input
                  id="nombre"
                  placeholder="Ej. Matemáticas Discretas"
                  maxLength={200}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={fieldInvalid(field.state.meta)}
                  aria-describedby={
                    fieldInvalid(field.state.meta) ? 'nombre-error' : undefined
                  }
                  className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
                />
                <FieldErrorText meta={field.state.meta} id="nombre-error" />
              </div>
            )}
          </form.AppField>

          <form.AppField name="datosBasicos.codigo">
            {(field) => (
              <div className="grid gap-1">
                <Label htmlFor="codigo">
                  Código
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    (Opcional)
                  </span>
                </Label>
                <Input
                  id="codigo"
                  placeholder="Ej. MAT-101"
                  maxLength={200}
                  value={field.state.value || ''}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="placeholder:text-muted-foreground/70 placeholder:italicplaceholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
                />
              </div>
            )}
          </form.AppField>

          <form.AppField
            name="datosBasicos.tipo"
            validators={{
              onChange: ({ value }) => primerError(tipoAsignaturaSchema, value),
            }}
          >
            {(field) => (
              <div className="grid gap-1">
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={field.state.value ?? ''}
                  onValueChange={(value: string) =>
                    field.handleChange(value as TipoAsignatura)
                  }
                >
                  <SelectTrigger
                    id="tipo"
                    aria-invalid={fieldInvalid(field.state.meta)}
                    className={cn(
                      'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                      !field.state.value
                        ? 'text-muted-foreground font-normal italic opacity-70'
                        : 'font-medium not-italic',
                    )}
                  >
                    <SelectValue placeholder="Ej. Obligatoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_MATERIA.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldErrorText meta={field.state.meta} id="tipo-error" />
              </div>
            )}
          </form.AppField>

          <div className="grid gap-1">
            <Label>Créditos</Label>
            <div className="border-input bg-muted/40 text-foreground flex h-9 items-center rounded-md border px-3 text-sm font-semibold">
              {creditosCalculados.toFixed(2)}
            </div>
            <p className="text-muted-foreground text-xs">
              Calculado automáticamente: (HD + HI) ÷ 16, truncado a centésimas.
            </p>
          </div>

          <form.AppField
            name="datosBasicos.estructuraId"
            validators={{
              onChange: ({ value }) => primerError(estructuraSchema, value),
            }}
          >
            {(field) => (
              <div className="grid gap-1">
                <Label htmlFor="estructura">Estructura de la asignatura</Label>
                <Select
                  value={field.state.value ?? ''}
                  onValueChange={(val) => field.handleChange(val)}
                >
                  <SelectTrigger
                    id="estructura"
                    aria-invalid={fieldInvalid(field.state.meta)}
                    className="w-full min-w-0 [&>span]:block! [&>span]:truncate!"
                  >
                    <SelectValue placeholder="Selecciona plantilla..." />
                  </SelectTrigger>
                  <SelectContent>
                    {estructuras?.map(
                      (
                        e: Database['public']['Tables']['estructuras_asignatura']['Row'],
                      ) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nombre}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                {estructuraFuenteId &&
                estructuraIdActual &&
                estructuraIdActual !== estructuraFuenteId ? (
                  <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border p-2 text-xs">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                    <span>
                      Es posible que se pierdan datos generales al seleccionar
                      otra estructura.
                    </span>
                  </div>
                ) : null}
                <p className="text-muted-foreground text-xs">
                  Define los campos requeridos (ej. Objetivos, Temario,
                  Evaluación).
                </p>
                <FieldErrorText meta={field.state.meta} id="estructura-error" />
              </div>
            )}
          </form.AppField>

          <form.AppField name="datosBasicos.horasAcademicas">
            {(field) => (
              <div className="grid gap-1">
                <Label htmlFor="horasAcademicas">
                  Horas Académicas
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    (Opcional)
                  </span>
                </Label>
                <Input
                  id="horasAcademicas"
                  type="number"
                  min={1}
                  max={999}
                  step={1}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={field.state.value ?? ''}
                  onBlur={field.handleBlur}
                  onKeyDown={(e) => {
                    if (['.', ',', '-', 'e', 'E', '+'].includes(e.key)) {
                      e.preventDefault()
                    }
                  }}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    field.handleChange(coerceHoras(e.target.value))
                  }
                  className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
                  placeholder="Ej. 48"
                />
              </div>
            )}
          </form.AppField>

          <form.AppField name="datosBasicos.horasIndependientes">
            {(field) => (
              <div className="grid gap-1">
                <Label htmlFor="horasIndependientes">
                  Horas Independientes
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    (Opcional)
                  </span>
                </Label>
                <Input
                  id="horasIndependientes"
                  type="number"
                  min={1}
                  max={999}
                  step={1}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={field.state.value ?? ''}
                  onBlur={field.handleBlur}
                  onKeyDown={(e) => {
                    if (['.', ',', '-', 'e', 'E', '+'].includes(e.key)) {
                      e.preventDefault()
                    }
                  }}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    field.handleChange(coerceHoras(e.target.value))
                  }
                  className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
                  placeholder="Ej. 24"
                />
              </div>
            )}
          </form.AppField>
        </div>
      )
    }

    return <PasoSugerenciasForm form={form} />
  },
})
