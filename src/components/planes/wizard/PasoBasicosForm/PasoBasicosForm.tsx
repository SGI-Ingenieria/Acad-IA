import { useStore } from '@tanstack/react-form'
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Scale,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { SelectorCiclosInline } from './SelectorCiclosInline'

import type { CarreraRow } from '@/data/types/domain'

import { withForm } from '@/components/form'
import { FieldErrorText, fieldInvalid } from '@/components/form/field-error'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EditableText } from '@/components/ui/editable-text'
import { EtiquetaEnFoco } from '@/components/ui/etiqueta-en-foco'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { TIPOS_CICLO } from '@/features/planes/nuevo/catalogs'
import { useAmbitoPlan } from '@/features/planes/nuevo/hooks/useAmbitoPlan'
import {
  errorFechaImparticion,
  nombrePlanSchema,
  numCiclosSchema,
  nuevoPlanFormOpts,
  primerError,
  semanasPorCicloSchema,
} from '@/features/planes/nuevo/schema'
import {
  proponerEstructuraCiclos,
  requiereSemanasPorCiclo,
} from '@/lib/ciclo-utils'
import { formatFacultadNombre } from '@/lib/facultad-utils'
import {
  formatMesAnioEs,
  formatNombrePlanCurricular,
  isFechaCurricularPasada,
  parseFechaMes,
  partesNombrePlanCurricular,
  recomendarEstructuraVigente,
  toMonthStartDateString,
} from '@/lib/plan-curricular'
import { cn } from '@/lib/utils'

const MESES_CORTOS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

/**
 * Rejilla de meses con navegación de año.
 *
 * Vive dentro del `PopoverContent`, que Radix desmonta al cerrar: por eso el
 * año navegado y el modo de la rejilla se inicializan al montar y no necesitan
 * resincronizarse con el valor confirmado.
 */
function RejillaMesAnio({
  fecha,
  onElegir,
}: {
  fecha: string | null
  onElegir: (year: number, monthIndex: number) => void
}) {
  const currentYear = new Date().getFullYear()
  const minYear = currentYear - 5
  const maxYear = currentYear + 10

  const fechaParsed = fecha ? parseFechaMes(fecha) : new Date()
  const selectedYear = fechaParsed.getFullYear()
  const selectedMonth = fechaParsed.getMonth()

  // Año que se está navegando. Es independiente del valor confirmado: sólo al
  // hacer clic en un mes se compromete la fecha.
  const [viewYear, setViewYear] = useState(fecha ? selectedYear : currentYear)
  // Los años del rango son dieciséis: llegar al último desde el actual a golpe
  // de flecha son diez clics, y el año suele saberse de antemano. El propio año
  // pasa a ser el conmutador de la rejilla.
  const [eligiendoAnio, setEligiendoAnio] = useState(false)
  const anios = Array.from(
    { length: maxYear - minYear + 1 },
    (_, index) => minYear + index,
  )

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-7 w-7', eligiendoAnio && 'invisible')}
          aria-label="Año anterior"
          disabled={viewYear <= minYear}
          onClick={() => setViewYear((y) => Math.max(minYear, y - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-sm font-semibold tabular-nums"
          aria-expanded={eligiendoAnio}
          aria-label={
            eligiendoAnio
              ? `Volver a los meses de ${viewYear}`
              : `Elegir otro año. Año mostrado: ${viewYear}`
          }
          onClick={() => setEligiendoAnio((v) => !v)}
        >
          {viewYear}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              eligiendoAnio && 'rotate-180',
            )}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-7 w-7', eligiendoAnio && 'invisible')}
          aria-label="Año siguiente"
          disabled={viewYear >= maxYear}
          onClick={() => setViewYear((y) => Math.min(maxYear, y + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {eligiendoAnio ? (
        // Elegir año no confirma la fecha: devuelve a los meses de ese año, que
        // es donde se compromete.
        <div
          role="group"
          aria-label="Años disponibles"
          className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto"
        >
          {anios.map((anio) => {
            const isSelected = !!fecha && anio === selectedYear
            return (
              <Button
                key={anio}
                type="button"
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                className={cn('h-9 tabular-nums', !isSelected && 'font-normal')}
                onClick={() => {
                  setViewYear(anio)
                  setEligiendoAnio(false)
                }}
              >
                {anio}
              </Button>
            )
          })}
        </div>
      ) : (
        /* Rejilla de meses: cada clic confirma, aunque coincida con el valor
           actual, evitando el estado que no se actualizaba. */
        <div className="grid grid-cols-3 gap-1.5">
          {MESES_CORTOS.map((mes, index) => {
            const isSelected =
              !!fecha && index === selectedMonth && viewYear === selectedYear
            return (
              <Button
                key={mes}
                type="button"
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-auto min-h-9 flex-col gap-0 py-1',
                  !isSelected && 'font-normal',
                )}
                onClick={() => onElegir(viewYear, index)}
              >
                {mes}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Anotación explícita (no `as`): tipa las props extra que acepta withForm.
const fechaFieldProps: {
  esCurricular?: boolean
  /** Notifica la fecha confirmada para derivar el nombre curricular. */
  onFechaChange?: (fecha: string) => void
  /**
   * Parte del nombre que precede a la fecha —«Licenciatura en X - Plan »—.
   *
   * Definido (aunque sea `null`) significa que la fecha se escribe **dentro**
   * del nombre del plan: no hay campo de fecha, hay una frase con un trozo
   * accionable. Sin él, la fecha va en su propia fila, que es lo que necesita
   * el clonado tradicional, donde el nombre lo trae el archivo.
   */
  nombrePrefijo?: string | null
} = {}

const FechaInicioImparticionField = withForm({
  ...nuevoPlanFormOpts,
  props: fechaFieldProps,
  render: function Render({
    form,
    esCurricular = false,
    onFechaChange,
    nombrePrefijo,
  }) {
    const [open, setOpen] = useState(false)
    const enLinea = nombrePrefijo !== undefined

    return (
      <form.AppField
        name="datosBasicos.fechaInicioImparticion"
        // Se valida al continuar, no mientras se elige: ver la nota de
        // `PasoBasicosForm`. El aviso de fecha pasada no es esta validación
        // —aparece en cuanto el mes es anterior al actual— y sigue siendo
        // inmediato.
        validators={{
          onSubmit: ({ value, fieldApi }) =>
            errorFechaImparticion(
              esCurricular,
              value,
              fieldApi.form.getFieldValue('confirmarFechaPasada'),
            ),
        }}
      >
        {(field) => {
          const fecha = field.state.value
          const esPasada = isFechaCurricularPasada(fecha)

          const setMesAnio = (year: number, monthIndex: number) => {
            const next = toMonthStartDateString(year, monthIndex)
            field.handleChange(next)
            form.setFieldValue('confirmarFechaPasada', false)
            onFechaChange?.(next)
            setOpen(false)
          }

          const popover = (disparador: React.ReactNode) => (
            <Popover open={open} onOpenChange={setOpen}>
              {disparador}
              <PopoverContent align="start" className="w-72 p-3">
                <RejillaMesAnio fecha={fecha} onElegir={setMesAnio} />
              </PopoverContent>
            </Popover>
          )

          return (
            <div
              className={cn(
                'grid gap-2',
                !enLinea && 'justify-items-center gap-2',
              )}
            >
              {enLinea ? (
                /* El nombre del plan se deriva entero salvo por el mes: en vez
                   de pedir la fecha aparte y repetir el resultado debajo, la
                   frase se escribe una sola vez y el mes va marcado como lo
                   único que se puede tocar.
                   La marca es un marcatextos —el texto conserva su color y lo
                   que cambia es el fondo— y no un tramo teñido de primario con
                   subrayado: la frase es el nombre del plan, no un enlace, y
                   recolorearla sugería que esa parte era de otra naturaleza.
                   Es el mismo gesto con el que ya se marcan los tramos
                   comentados de un campo (`comment-highlights`). */
                <p
                  data-guia="nombre-plan-construido"
                  className="border-border/70 border-b px-0 pb-2 text-3xl leading-tight font-bold text-balance"
                >
                  <span
                    className={cn(
                      !nombrePrefijo && 'text-muted-foreground italic',
                    )}
                  >
                    {nombrePrefijo ?? 'Plan de estudios · '}
                  </span>
                  {popover(
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <button
                            data-guia="inicio-imparticion"
                            id="fechaInicioImparticion"
                            type="button"
                            aria-label={`Cambiar el inicio de impartición. Actualmente ${formatMesAnioEs(fecha) || 'sin definir'}`}
                            aria-describedby="fechaInicioImparticion-error"
                            // `data-invalid` y no `aria-invalid`: el rol button
                            // no admite ese estado. El error lo anuncia el
                            // texto asociado por `aria-describedby`.
                            data-invalid={
                              fieldInvalid(field.state.meta) || undefined
                            }
                            className={cn(
                              'bg-primary/15 hover:bg-primary/25 focus-visible:ring-ring data-invalid:bg-destructive/15 data-invalid:text-destructive rounded-[3px] px-1.5 text-inherit transition-colors outline-none focus-visible:ring-2',
                              !fecha && 'text-muted-foreground italic',
                            )}
                          >
                            {formatMesAnioEs(fecha) || 'elige el mes'}
                          </button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        Mes en que inicia la primera generación de este plan.
                        Haz clic para cambiarlo.
                      </TooltipContent>
                    </Tooltip>,
                  )}
                </p>
              ) : (
                <div className="grupo-enfoque flex flex-wrap items-center justify-center gap-2">
                  <span className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                    Inicia en
                  </span>
                  {popover(
                    <EtiquetaEnFoco etiqueta="Inicio de impartición" side="top">
                      <PopoverTrigger asChild>
                        <Button
                          id="fechaInicioImparticion"
                          type="button"
                          variant="ghost"
                          aria-label="Elegir inicio de impartición"
                          aria-describedby="fechaInicioImparticion-error"
                          aria-invalid={fieldInvalid(field.state.meta)}
                          className={cn(
                            'organic-interactive h-auto gap-2 rounded-none border-b px-1 py-1 text-lg font-semibold',
                            !fecha &&
                              'text-muted-foreground font-normal italic opacity-70',
                          )}
                        >
                          <CalendarDays className="h-4 w-4" />
                          {formatMesAnioEs(fecha) || 'Seleccionar mes y año'}
                        </Button>
                      </PopoverTrigger>
                    </EtiquetaEnFoco>,
                  )}
                </div>
              )}

              <FieldErrorText
                meta={field.state.meta}
                id="fechaInicioImparticion-error"
              />

              {esPasada && (
                <div className="border-destructive/25 bg-destructive/4 grid gap-2 rounded-lg border p-3">
                  <p className="text-destructive flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    El inicio seleccionado es anterior al mes actual.
                  </p>
                  <form.AppField name="confirmarFechaPasada">
                    {(confirmField) => (
                      <Label
                        htmlFor="confirmarFechaPasada"
                        className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                      >
                        <Checkbox
                          id="confirmarFechaPasada"
                          checked={confirmField.state.value}
                          onCheckedChange={(checked) => {
                            confirmField.handleChange(checked === true)
                            // Confirmar el mes pasado corrige el error de la
                            // fecha, pero es otro campo el que cambia: hay que
                            // revalidarla para que el mensaje se retire solo.
                            void form.validateField(
                              'datosBasicos.fechaInicioImparticion',
                              'change',
                            )
                          }}
                        />
                        Confirmo que el mes es correcto y deseo continuar.
                      </Label>
                    )}
                  </form.AppField>
                </div>
              )}
            </div>
          )
        }}
      </form.AppField>
    )
  },
})

const pasoBasicosProps: {
  /** Devuelve al paso dedicado para corregir el ámbito ya elegido. */
  onCambiarAmbito?: (ambito: 'facultad' | 'carrera') => void
} = {}

export const PasoBasicosForm = withForm({
  ...nuevoPlanFormOpts,
  props: pasoBasicosProps,
  render: function Render({ form, onCambiarAmbito }) {
    const ambito = useAmbitoPlan()
    const facultadesList = ambito.todasFacultades
    const rawCarreras = ambito.todasCarreras
    const estructurasPlanList = ambito.estructurasPlan
    const tipoOrigen = useStore(form.store, (s) => s.values.tipoOrigen)
    const facultadIdActual = useStore(
      form.store,
      (s) => s.values.datosBasicos.facultad.id,
    )
    const carreraIdActual = useStore(
      form.store,
      (s) => s.values.datosBasicos.carrera.id,
    )
    const estructuraPlanIdActual = useStore(
      form.store,
      (s) => s.values.datosBasicos.estructuraPlanId,
    )
    const tipoEstructuraActual = useStore(
      form.store,
      (s) => s.values.datosBasicos.tipoEstructura,
    )
    const fechaInicioImparticion = useStore(
      form.store,
      (s) => s.values.datosBasicos.fechaInicioImparticion,
    )

    const esCurricular = tipoEstructuraActual === 'CURRICULAR'
    const estructuraRecomendada = tipoEstructuraActual
      ? recomendarEstructuraVigente(
          estructurasPlanList,
          tipoEstructuraActual,
          fechaInicioImparticion,
        )
      : null
    const estructuraSeleccionada = estructurasPlanList.find(
      (estructura) => estructura.id === estructuraPlanIdActual,
    )
    const seleccionManual =
      Boolean(estructuraRecomendada) &&
      estructuraPlanIdActual !== estructuraRecomendada?.id

    useEffect(() => {
      if (!tipoEstructuraActual || !estructuraRecomendada) return
      const recomendadaAnterior = form.getFieldValue(
        'datosBasicos.estructuraRecomendadaId',
      )
      const seleccionActual = form.getFieldValue(
        'datosBasicos.estructuraPlanId',
      )
      const eraAutomatica =
        !seleccionActual ||
        !recomendadaAnterior ||
        seleccionActual === recomendadaAnterior

      form.setFieldValue(
        'datosBasicos.estructuraRecomendadaId',
        estructuraRecomendada.id,
      )
      if (eraAutomatica) {
        form.setFieldValue(
          'datosBasicos.estructuraPlanId',
          estructuraRecomendada.id,
        )
        form.setFieldValue('datosBasicos.motivoEstructuraManual', '')
      }
    }, [estructuraRecomendada, form, tipoEstructuraActual])

    const carreraSeleccionada = rawCarreras.find(
      (c: any) => c.id === carreraIdActual,
    )

    /**
     * Estructura que la carrera propone. Se recalcula al leer —no se copia a
     * estado— porque sólo sirve para dos cosas: prellenar los campos cuando se
     * elige carrera y explicar de dónde salen los números que ya están puestos.
     */
    const propuestaCiclos = useMemo(
      () => proponerEstructuraCiclos(carreraSeleccionada),
      [carreraSeleccionada],
    )

    /**
     * Nombre curricular derivado (sustituye al antiguo useEffect de
     * autonombre): se calcula al leer para la vista previa y se escribe en
     * `datosBasicos.nombrePlan` desde los handlers de los campos de los que
     * deriva (carrera, inicio de impartición y estructura).
     */
    const nombreCurricularPara = (
      carrera: CarreraRow | undefined,
      fecha: string | null,
      estructuraId: string | null,
    ): string | null => {
      const estructura = estructurasPlanList.find((e) => e.id === estructuraId)
      if (estructura?.tipo !== 'CURRICULAR') return null
      if (!carrera || !fecha) return null
      return formatNombrePlanCurricular(carrera.nivel, carrera.nombre, fecha)
    }

    const syncNombreCurricular = (
      carrera: CarreraRow | undefined,
      fecha: string | null,
      estructuraId: string | null,
    ) => {
      if (tipoOrigen === 'CLONADO_TRADICIONAL') return
      const nombre = nombreCurricularPara(carrera, fecha, estructuraId)
      if (nombre && form.getFieldValue('datosBasicos.nombrePlan') !== nombre) {
        form.setFieldValue('datosBasicos.nombrePlan', nombre)
      }
    }

    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return (
        <div className="flex flex-col gap-4">
          {esCurricular && (
            <FechaInicioImparticionField
              form={form}
              esCurricular={esCurricular}
            />
          )}
        </div>
      )
    }

    const facultadSeleccionada = facultadesList.find(
      (f) => f.id === facultadIdActual,
    )
    const ambitoResuelto = Boolean(carreraSeleccionada)

    /** Ámbito ya resuelto: se lee como un rastro y se toca para corregirlo. */
    const chipAmbito = (
      contenido: React.ReactNode,
      puedeCambiar: boolean,
      etiqueta: string,
      onCambiar: () => void,
    ) =>
      puedeCambiar ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={etiqueta}
              onClick={onCambiar}
              className="organic-interactive text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2"
            >
              {contenido}
            </button>
          </TooltipTrigger>
          <TooltipContent>{etiqueta}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-muted-foreground inline-flex min-w-0 items-center gap-2">
          {contenido}
        </span>
      )

    // El prefijo del nombre no depende del mes; la fecha se pinta dentro del
    // propio nombre, no en un campo aparte.
    const prefijoNombreCurricular = carreraSeleccionada
      ? partesNombrePlanCurricular(
          carreraSeleccionada.nivel,
          carreraSeleccionada.nombre,
          fechaInicioImparticion ?? new Date(),
        ).prefijo
      : null

    return (
      <div className="flex min-h-full flex-col">
        <div className="flex flex-1 flex-col justify-center gap-8 px-2 pt-2 pb-8">
          <div className="grid gap-4 sm:grid-cols-2">
            {ambitoResuelto && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:col-span-2">
                {facultadSeleccionada &&
                  !ambito.ocultarFacultad &&
                  chipAmbito(
                    <>
                      <FacultadIconPill facultad={facultadSeleccionada} />
                      <span className="truncate">
                        {formatFacultadNombre(facultadSeleccionada)}
                      </span>
                    </>,
                    ambito.puedeCambiarFacultad,
                    `Cambiar de facultad. Ahora: ${formatFacultadNombre(facultadSeleccionada)}`,
                    () => onCambiarAmbito?.('facultad'),
                  )}
                {facultadSeleccionada &&
                  !ambito.ocultarFacultad &&
                  !ambito.ocultarCarrera && (
                    <span className="text-muted-foreground/60" aria-hidden>
                      ·
                    </span>
                  )}
                {!ambito.ocultarCarrera &&
                  chipAmbito(
                    <span className="truncate font-medium">
                      {carreraSeleccionada?.nombre}
                    </span>,
                    ambito.puedeCambiarCarrera,
                    `Cambiar de carrera. Ahora: ${carreraSeleccionada?.nombre ?? ''}`,
                    () => onCambiarAmbito?.('carrera'),
                  )}
              </div>
            )}

            {ambitoResuelto && (
              <div className="grid gap-1 sm:col-span-2">
                {esCurricular ? (
                  <FechaInicioImparticionField
                    form={form}
                    esCurricular={esCurricular}
                    nombrePrefijo={prefijoNombreCurricular}
                    onFechaChange={(next) =>
                      syncNombreCurricular(
                        carreraSeleccionada,
                        next,
                        estructuraPlanIdActual,
                      )
                    }
                  />
                ) : (
                  <form.AppField
                    name="datosBasicos.nombrePlan"
                    validators={{ onSubmit: nombrePlanSchema }}
                  >
                    {(field) => (
                      <div className="grid gap-1">
                        <EditableText
                          value={field.state.value}
                          onSave={field.handleChange}
                          editable={Boolean(carreraIdActual)}
                          placeholder="Nombre del plan"
                          maxLength={200}
                          ariaLabel="Nombre del plan"
                          className="border-border/70 focus:border-primary block w-full rounded-none border-b px-0 pb-2 text-3xl leading-tight font-bold"
                        />
                        <FieldErrorText
                          meta={field.state.meta}
                          id="nombrePlan-error"
                        />
                      </div>
                    )}
                  </form.AppField>
                )}
              </div>
            )}
          </div>

          <form.AppField
            name="datosBasicos.numCiclos"
            validators={{
              onSubmit: ({ value }) => primerError(numCiclosSchema, value),
            }}
          >
            {(cantidadField) => (
              <form.AppField name="datosBasicos.tipoCiclo">
                {(tipoField) => (
                  <form.AppField
                    name="datosBasicos.semanasPorCiclo"
                    validators={{
                      onSubmit: ({ value }) =>
                        primerError(semanasPorCicloSchema, value),
                    }}
                  >
                    {(semanasField) => (
                      <SelectorCiclosInline
                        cantidad={Math.max(1, cantidadField.state.value ?? 1)}
                        tipo={tipoField.state.value}
                        semanasPorCiclo={semanasField.state.value}
                        tiposDisponibles={TIPOS_CICLO}
                        onCantidadChange={cantidadField.handleChange}
                        onTipoChange={(selected) => {
                          tipoField.handleChange(selected)
                          // «Otro» es un ciclo personalizado: si la carrera no
                          // declaró duración, empieza en el mínimo válido.
                          semanasField.handleChange(
                            requiereSemanasPorCiclo(selected)
                              ? (semanasField.state.value ??
                                  propuestaCiclos.semanasPorCiclo ??
                                  1)
                              : null,
                          )
                        }}
                        onSemanasChange={semanasField.handleChange}
                        errorCantidad={
                          <FieldErrorText
                            meta={cantidadField.state.meta}
                            id="numCiclos-error"
                          />
                        }
                        errorSemanas={
                          <FieldErrorText
                            meta={semanasField.state.meta}
                            id="semanasPorCiclo-error"
                          />
                        }
                        className={cn('py-5', !ambitoResuelto && 'hidden')}
                      />
                    )}
                  </form.AppField>
                )}
              </form.AppField>
            )}
          </form.AppField>
        </div>

        {estructuraSeleccionada && ambitoResuelto && (
          <div
            className="border-primary/20 bg-primary/5 grid gap-3 border-y px-4 py-4"
            data-guia="version-normativa"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Scale className="text-primary size-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    Se aplicará{' '}
                    {estructuraSeleccionada.autoridad_normativa
                      ? `${estructuraSeleccionada.autoridad_normativa} · `
                      : ''}
                    {estructuraSeleccionada.etiqueta_version ??
                      estructuraSeleccionada.nombre}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {seleccionManual
                      ? 'Versión elegida manualmente'
                      : 'Recomendada para el inicio de impartición'}
                  </p>
                </div>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="sm">
                    Cambiar
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-2">
                  <div className="px-2 py-2">
                    <p className="font-semibold">Versiones disponibles</p>
                  </div>
                  <div className="grid gap-1">
                    {estructurasPlanList
                      .filter(
                        (estructura) =>
                          estructura.tipo === tipoEstructuraActual &&
                          estructura.estado_publicacion === 'PUBLICADA',
                      )
                      .map((estructura) => (
                        <Button
                          key={estructura.id}
                          type="button"
                          variant={
                            estructura.id === estructuraPlanIdActual
                              ? 'secondary'
                              : 'ghost'
                          }
                          className="h-auto justify-start px-3 py-2 text-left"
                          onClick={() => {
                            form.setFieldValue(
                              'datosBasicos.estructuraPlanId',
                              estructura.id,
                            )
                            if (estructura.id === estructuraRecomendada?.id) {
                              form.setFieldValue(
                                'datosBasicos.motivoEstructuraManual',
                                '',
                              )
                            }
                          }}
                        >
                          <span className="grid">
                            <span className="font-medium">
                              {estructura.etiqueta_version ?? estructura.nombre}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {estructura.id === estructuraRecomendada?.id
                                ? 'Recomendada'
                                : [
                                    estructura.aplicable_desde,
                                    estructura.aplicable_hasta,
                                  ]
                                    .filter(Boolean)
                                    .join(' – ') || 'Vigencia no indicada'}
                            </span>
                          </span>
                        </Button>
                      ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {seleccionManual && (
              <form.AppField
                name="datosBasicos.motivoEstructuraManual"
                validators={{
                  onSubmit: ({ value }) =>
                    value.trim()
                      ? undefined
                      : 'Escribe por qué se aplica una versión distinta a la recomendada.',
                }}
              >
                {(field) => (
                  <div className="grid gap-1">
                    <Input
                      value={field.state.value}
                      placeholder="Motivo para aplicar esta versión"
                      aria-label="Motivo para aplicar una versión distinta"
                      aria-invalid={fieldInvalid(field.state.meta)}
                      aria-describedby="motivoEstructura-error"
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                    <FieldErrorText
                      meta={field.state.meta}
                      id="motivoEstructura-error"
                      className="text-xs"
                    />
                  </div>
                )}
              </form.AppField>
            )}
          </div>
        )}
      </div>
    )
  },
})
