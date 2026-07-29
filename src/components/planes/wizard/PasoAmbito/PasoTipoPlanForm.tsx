import { useStore } from '@tanstack/react-form'
import { Award, GraduationCap } from 'lucide-react'

import { withForm } from '@/components/form'
import { FieldErrorText } from '@/components/form/field-error'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAmbitoPlan } from '@/features/planes/nuevo/hooks/useAmbitoPlan'
import { nombrePlanCurricularDerivado } from '@/features/planes/nuevo/nombre-plan'
import {
  nuevoPlanFormOpts,
  primerError,
  tipoEstructuraPlanSchema,
} from '@/features/planes/nuevo/schema'
import { cn } from '@/lib/utils'

/** Las dos naturalezas de plan, con la ayuda que aclara a qué corresponde cada
 *  una. El texto va visible y también en el tooltip: es la decisión que más
 *  arrastra del asistente y no puede quedar sólo detrás del hover.
 *
 *  «No curricular» se anuncia pero todavía no se puede elegir: un diplomado o
 *  una certificación no se describen con ciclos ni con una versión normativa de
 *  la SEP, sino con días, semanas y modalidad, y ese recorrido está sin
 *  construir. Se deja visible —no oculto— para que quien lo busca sepa que está
 *  contemplado y no intente forzarlo dentro de un plan curricular. */
const TIPOS_ESTRUCTURA = [
  {
    value: 'CURRICULAR',
    label: 'Curricular',
    icono: GraduationCap,
    ayuda: 'Acorde al plan de estudios de la SEP.',
    detalle:
      'Se organiza en ciclos, se rige por una versión normativa y su nombre se deriva de la carrera y del inicio de impartición.',
    proximamente: false,
  },
  {
    value: 'NO_CURRICULAR',
    label: 'No curricular',
    icono: Award,
    ayuda: 'Talleres, cursos, certificaciones, diplomados, etcétera.',
    detalle:
      'Se planea por días, semanas y modalidad, con un nombre propio y sin versión normativa de la SEP.',
    proximamente: true,
  },
] as const

// Anotación explícita (no `as`): tipa las props extra que acepta withForm.
const pasoTipoProps: {
  /** El tipo elegido resuelve el paso: el asistente puede avanzar solo. */
  onSeleccionado?: () => void
} = {}

/**
 * Naturaleza del plan, como vista dedicada dentro de Datos básicos.
 *
 * No es un campo más de los datos básicos: decide qué plantilla normativa se
 * aplica, si el nombre se deriva de la carrera o se escribe a mano y si hace
 * falta un inicio de impartición. Preguntarlo junto al resto llevaba a
 * rellenar campos que esta misma elección invalidaba después.
 */
export const PasoTipoPlanForm = withForm({
  ...nuevoPlanFormOpts,
  props: pasoTipoProps,
  render: function Render({ form, onSeleccionado }) {
    const { cargando, estructurasPlan, todasCarreras } = useAmbitoPlan()
    const carreraId = useStore(
      form.store,
      (s) => s.values.datosBasicos.carrera.id,
    )
    const fechaInicioImparticion = useStore(
      form.store,
      (s) => s.values.datosBasicos.fechaInicioImparticion,
    )
    const tipoOrigen = useStore(form.store, (s) => s.values.tipoOrigen)

    return (
      <section className="grid gap-5" data-guia="tipo-plan">
        <header className="grid gap-1">
          <h3 className="text-xl font-semibold">
            ¿Qué tipo de plan vas a crear?
          </h3>
        </header>

        <form.AppField
          name="datosBasicos.tipoEstructura"
          validators={{
            onSubmit: ({ value }) => {
              const error = primerError(tipoEstructuraPlanSchema, value)
              if (error) return error
              return estructurasPlan.some(
                (estructura) => estructura.tipo === value,
              )
                ? undefined
                : 'No hay una plantilla disponible para este tipo de plan.'
            },
          }}
        >
          {(field) => (
            <div className="grid gap-2">
              <div className="grid gap-4 sm:grid-cols-2">
                {TIPOS_ESTRUCTURA.map(
                  ({
                    value,
                    label,
                    icono: Icono,
                    ayuda,
                    detalle,
                    proximamente,
                  }) => {
                    const seleccionado = field.state.value === value
                    const disponible = estructurasPlan.some(
                      (estructura) => estructura.tipo === value,
                    )
                    const bloqueado = proximamente || cargando || !disponible
                    return (
                      <Tooltip key={value}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-pressed={seleccionado}
                            // `aria-disabled` y no `disabled`: sigue siendo
                            // enfocable y con hover, así que puede explicar por
                            // qué todavía no se puede elegir.
                            aria-disabled={bloqueado || undefined}
                            onClick={() => {
                              if (bloqueado) return
                              const latest = estructurasPlan.find(
                                (estructura) => estructura.tipo === value,
                              )
                              field.handleChange(value)
                              form.setFieldValue(
                                'datosBasicos.estructuraPlanId',
                                latest?.id ?? null,
                              )
                              form.setFieldValue(
                                'datosBasicos.estructuraRecomendadaId',
                                latest?.id ?? null,
                              )
                              form.setFieldValue(
                                'datosBasicos.motivoEstructuraManual',
                                '',
                              )
                              form.setFieldValue('confirmarFechaPasada', false)
                              // Cambiar de naturaleza cambia cómo se llama el
                              // plan: el nombre vuelve a derivarse en vez de
                              // arrastrar el de la elección anterior.
                              const nombre =
                                tipoOrigen === 'CLONADO_TRADICIONAL'
                                  ? null
                                  : nombrePlanCurricularDerivado(
                                      todasCarreras.find(
                                        (carrera) => carrera.id === carreraId,
                                      ),
                                      fechaInicioImparticion,
                                      value,
                                    )
                              if (nombre) {
                                form.setFieldValue(
                                  'datosBasicos.nombrePlan',
                                  nombre,
                                )
                              }
                              onSeleccionado?.()
                            }}
                            className={cn(
                              'organic-interactive bg-card focus-visible:ring-ring grid min-h-40 content-start gap-2 rounded-xl border p-5 text-left shadow-xs transition-colors outline-none focus-visible:ring-2 dark:bg-transparent dark:shadow-none',
                              bloqueado
                                ? 'border-border/60 cursor-not-allowed opacity-60'
                                : seleccionado
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/40 hover:bg-accent/30',
                            )}
                          >
                            <Icono
                              className={cn(
                                'size-7 shrink-0',
                                seleccionado && !proximamente
                                  ? 'text-primary'
                                  : 'text-muted-foreground',
                              )}
                            />
                            <span className="flex items-center gap-2 text-lg leading-tight font-semibold">
                              {label}
                              {proximamente && (
                                <span className="organic-chip text-muted-foreground text-[0.625rem] font-semibold tracking-[0.08em] uppercase">
                                  Próximamente
                                </span>
                              )}
                            </span>
                            <span className="text-muted-foreground text-sm leading-snug">
                              {ayuda}
                            </span>
                            <span className="text-muted-foreground/80 text-xs leading-snug">
                              {detalle}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {proximamente
                            ? 'Todavía no disponible: un diplomado o una certificación se planean por días y semanas, no por ciclos, y ese recorrido está en construcción.'
                            : cargando
                              ? 'Cargando las versiones normativas disponibles.'
                              : !disponible
                                ? 'No hay una versión normativa disponible para este tipo de plan.'
                                : ayuda}
                        </TooltipContent>
                      </Tooltip>
                    )
                  },
                )}
              </div>
              <FieldErrorText
                meta={field.state.meta}
                id="tipoEstructura-error"
              />
            </div>
          )}
        </form.AppField>
      </section>
    )
  },
})
