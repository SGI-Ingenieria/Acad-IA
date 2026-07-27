import { useStore } from '@tanstack/react-form'
import {
  AlertTriangle,
  Award,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { CarreraRow, FacultadRow, TipoCiclo } from '@/data/types/domain'
import type { AnyFieldMeta } from '@tanstack/react-form'

import { withForm } from '@/components/form'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EditableNumber } from '@/components/ui/editable-number'
import { EditableSelect } from '@/components/ui/editable-select'
import { EditableText } from '@/components/ui/editable-text'
import { EtiquetaEnFoco } from '@/components/ui/etiqueta-en-foco'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  resolveAcademicScope,
  useAcademicScope,
} from '@/data/auth/academicScope'
import { isPostgradoNivel } from '@/data/auth/planCapabilities'
import { usePermissions } from '@/data/hooks/usePermissions'
import { useCatalogosPlanes } from '@/data/hooks/usePlans'
import { NIVELES, TIPOS_CICLO } from '@/features/planes/nuevo/catalogs'
import {
  errorFechaImparticion,
  facultadSeleccionadaSchema,
  carreraSeleccionadaSchema,
  nombrePlanSchema,
  numCiclosSchema,
  nuevoPlanFormOpts,
  primerError,
  tipoEstructuraPlanSchema,
} from '@/features/planes/nuevo/schema'
import { formatFacultadNombre } from '@/lib/facultad-utils'
import {
  formatMesAnioEs,
  formatNombrePlanCurricular,
  isFechaCurricularPasada,
  parseFechaMes,
  toMonthStartDateString,
} from '@/lib/plan-curricular'
import { cn } from '@/lib/utils'

function getDefaultsForNivel(nivel: string): {
  tipoCiclo?: TipoCiclo
  numCiclos?: number | null
} {
  if (nivel === 'Maestría' || nivel === 'Especialidad') {
    return { tipoCiclo: 'Cuatrimestre', numCiclos: 6 }
  }
  if (nivel === 'Licenciatura') {
    return { tipoCiclo: 'Semestre', numCiclos: 9 }
  }
  if (nivel === 'Doctorado') {
    return { tipoCiclo: 'Semestre', numCiclos: 8 }
  }
  return {}
}

function getDefaultPlanName(carrera: CarreraRow | undefined) {
  return carrera ? `${carrera.nombre} (${new Date().getFullYear()})` : ''
}

function pluralizarTipoCiclo(tipo: string, cantidad: number | null): string {
  const normalizado = tipo.trim().toLocaleLowerCase('es-MX')
  const singular =
    normalizado === 'otro' || !normalizado ? 'ciclo' : normalizado
  return cantidad === 1 ? singular : `${singular}s`
}

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

/** Las dos naturalezas de plan, con la ayuda que aclara a qué corresponde cada
 *  una. El texto va visible y también en el tooltip: es la decisión que más
 *  arrastra del asistente y no puede quedar sólo detrás del hover. */
const TIPOS_ESTRUCTURA = [
  {
    value: 'CURRICULAR',
    label: 'Curricular',
    icono: GraduationCap,
    ayuda: 'Acorde al plan de estudios de la SEP.',
  },
  {
    value: 'NO_CURRICULAR',
    label: 'No curricular',
    icono: Award,
    ayuda: 'Talleres, cursos, certificaciones, diplomados, etcétera.',
  },
] as const

const GLOBAL_PLAN_ROLES = new Set(['ADMIN', 'VICERRECTOR_ACADEMICO'])
const FACULTY_PLAN_ROLES = new Set([
  'DIRECTOR_FACULTAD',
  'SECRETARIO_ACADEMICO',
])

function canCreatePlanInCarrera(
  carrera: CarreraRow,
  roleAssignments: ReturnType<typeof usePermissions>['roleAssignments'],
  isAdmin: boolean,
) {
  if (isAdmin) return true
  if (roleAssignments.length === 0) return true

  return roleAssignments.some((assignment) => {
    if (GLOBAL_PLAN_ROLES.has(assignment.clave)) return true
    if (FACULTY_PLAN_ROLES.has(assignment.clave)) {
      return assignment.facultad_id === carrera.facultad_id
    }
    if (assignment.clave === 'JEFE_CARRERA') {
      return assignment.carrera_id === carrera.id
    }
    if (assignment.clave === 'JEFE_POSGRADO') {
      return (
        assignment.facultad_id === carrera.facultad_id &&
        isPostgradoNivel(carrera.nivel)
      )
    }
    return false
  })
}

const fieldInvalid = (meta: AnyFieldMeta): boolean =>
  meta.isTouched && !meta.isValid

function FieldErrorText({
  meta,
  id,
  className,
}: {
  meta: AnyFieldMeta
  id: string
  className?: string
}) {
  if (!fieldInvalid(meta)) return null
  const message = meta.errors
    .map((e: unknown) =>
      typeof e === 'string' ? e : ((e as { message?: string }).message ?? ''),
    )
    .filter(Boolean)
    .join(', ')
  return (
    <p id={id} className={cn('text-destructive text-sm', className)}>
      {message}
    </p>
  )
}

// Anotación explícita (no `as`): tipa las props extra que acepta withForm.
const fechaFieldProps: {
  esCurricular?: boolean
  /** Notifica la fecha confirmada para derivar el nombre curricular. */
  onFechaChange?: (fecha: string) => void
} = {}

const FechaInicioImparticionField = withForm({
  ...nuevoPlanFormOpts,
  props: fechaFieldProps,
  render: function Render({ form, esCurricular = false, onFechaChange }) {
    const [open, setOpen] = useState(false)
    const currentYear = new Date().getFullYear()
    const minYear = currentYear - 5
    const maxYear = currentYear + 10

    // Año que se está navegando dentro del popover. Es independiente del valor
    // confirmado: sólo al hacer clic en un mes se compromete la fecha. Se
    // resincroniza cada vez que se abre el popover.
    const [viewYear, setViewYear] = useState(currentYear)
    // Los años del rango son dieciséis: llegar al último desde el actual a
    // golpe de flecha son diez clics, y el año suele saberse de antemano. El
    // propio año pasa a ser el conmutador de la rejilla.
    const [eligiendoAnio, setEligiendoAnio] = useState(false)
    const anios = Array.from(
      { length: maxYear - minYear + 1 },
      (_, index) => minYear + index,
    )

    return (
      <form.AppField
        name="datosBasicos.fechaInicioImparticion"
        validators={{
          onChangeListenTo: ['confirmarFechaPasada'],
          onChange: ({ value, fieldApi }) =>
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
          const fechaParsed = fecha ? parseFechaMes(fecha) : new Date()
          const selectedYear = fechaParsed.getFullYear()
          const selectedMonth = fechaParsed.getMonth()

          const setMesAnio = (year: number, monthIndex: number) => {
            const next = toMonthStartDateString(year, monthIndex)
            field.handleChange(next)
            form.setFieldValue('confirmarFechaPasada', false)
            onFechaChange?.(next)
          }

          return (
            <div className="grid gap-2">
              <div className="grid gap-1">
                <Label htmlFor="fechaInicioImparticion">
                  Inicio de impartición
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Popover
                  open={open}
                  onOpenChange={(next) => {
                    setOpen(next)
                    if (next) {
                      setViewYear(fecha ? selectedYear : currentYear)
                      setEligiendoAnio(false)
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="fechaInicioImparticion"
                      type="button"
                      variant="outline"
                      aria-invalid={fieldInvalid(field.state.meta)}
                      className={cn(
                        'w-full justify-start gap-2 font-medium',
                        !fecha &&
                          'text-muted-foreground font-normal italic opacity-70',
                      )}
                    >
                      <CalendarDays className="h-4 w-4" />
                      {fecha ? formatMesAnioEs(fecha) : 'Seleccionar mes y año'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-3">
                    <div className="grid gap-3">
                      {/* Navegación de año */}
                      <div className="flex items-center justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-7 w-7',
                            eligiendoAnio && 'invisible',
                          )}
                          aria-label="Año anterior"
                          disabled={viewYear <= minYear}
                          onClick={() =>
                            setViewYear((y) => Math.max(minYear, y - 1))
                          }
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
                          className={cn(
                            'h-7 w-7',
                            eligiendoAnio && 'invisible',
                          )}
                          aria-label="Año siguiente"
                          disabled={viewYear >= maxYear}
                          onClick={() =>
                            setViewYear((y) => Math.min(maxYear, y + 1))
                          }
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      {eligiendoAnio ? (
                        // Elegir año no confirma la fecha: devuelve a los meses
                        // de ese año, que es donde se compromete.
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
                                className={cn(
                                  'h-9 tabular-nums',
                                  !isSelected && 'font-normal',
                                )}
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
                        /* Rejilla de meses: cada clic confirma, aunque coincida
                           con el valor actual, evitando el estado que no se
                           actualizaba. */
                        <div className="grid grid-cols-3 gap-1.5">
                          {MESES_CORTOS.map((mes, index) => {
                            const isSelected =
                              !!fecha &&
                              index === selectedMonth &&
                              viewYear === selectedYear
                            return (
                              <Button
                                key={mes}
                                type="button"
                                variant={isSelected ? 'default' : 'ghost'}
                                size="sm"
                                className={cn(
                                  'h-9',
                                  !isSelected && 'font-normal',
                                )}
                                onClick={() => {
                                  setMesAnio(viewYear, index)
                                  setOpen(false)
                                }}
                              >
                                {mes}
                              </Button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <FieldErrorText
                  meta={field.state.meta}
                  id="fechaInicioImparticion-error"
                />
              </div>

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
                          onCheckedChange={(checked) =>
                            confirmField.handleChange(checked === true)
                          }
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

export const PasoBasicosForm = withForm({
  ...nuevoPlanFormOpts,
  render: function Render({ form }) {
    const { data: catalogos } = useCatalogosPlanes()
    const academicScope = useAcademicScope()
    const { roleAssignments, isAdmin } = usePermissions()

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
    const numCiclosActual = useStore(
      form.store,
      (s) => s.values.datosBasicos.numCiclos,
    )
    const fechaInicioImparticion = useStore(
      form.store,
      (s) => s.values.datosBasicos.fechaInicioImparticion,
    )

    // Preferir los catálogos remotos si están disponibles; si no, usar los locales
    const facultadesList = useMemo(
      () => catalogos?.facultades ?? [],
      [catalogos?.facultades],
    )
    const rawCarreras = useMemo(
      () => catalogos?.carreras ?? [],
      [catalogos?.carreras],
    )
    const estructurasPlanList = useMemo(
      () => catalogos?.estructurasPlan ?? [],
      [catalogos?.estructurasPlan],
    )

    const baseScope = useMemo(
      () => resolveAcademicScope(academicScope, facultadesList, rawCarreras),
      [academicScope, facultadesList, rawCarreras],
    )

    const scope = useMemo(() => {
      const visibleCarreras = baseScope.visibleCarreras.filter((carrera) =>
        canCreatePlanInCarrera(carrera, roleAssignments, isAdmin),
      )
      const visibleCarreraIds = new Set(
        visibleCarreras.map((carrera) => carrera.id),
      )
      const visibleFacultadIds = new Set(
        visibleCarreras.map((carrera) => carrera.facultad_id),
      )
      const visibleFacultades = baseScope.visibleFacultades.filter((facultad) =>
        visibleFacultadIds.has(facultad.id),
      )

      const forcedCarreraId =
        baseScope.forcedCarreraId &&
        visibleCarreraIds.has(baseScope.forcedCarreraId)
          ? baseScope.forcedCarreraId
          : visibleCarreras.length === 1
            ? visibleCarreras[0].id
            : null
      const forcedFacultadId =
        baseScope.forcedFacultadId &&
        visibleFacultadIds.has(baseScope.forcedFacultadId)
          ? baseScope.forcedFacultadId
          : visibleFacultades.length === 1
            ? visibleFacultades[0].id
            : null

      return {
        ...baseScope,
        forcedFacultadId,
        forcedCarreraId,
        visibleFacultades,
        visibleCarreras,
        canChooseFacultad:
          baseScope.canChooseFacultad && visibleFacultades.length > 1,
        canChooseCarrera:
          baseScope.canChooseCarrera && visibleCarreras.length > 1,
      }
    }, [baseScope, isAdmin, roleAssignments])

    // Sincronización con sistemas externos al form (catálogos remotos y
    // scope de autorización): precarga la estructura más reciente y la
    // facultad/carrera forzadas por rol. Solo escribe campos vacíos, por lo
    // que nunca pisa una elección del usuario ni un borrador restaurado.
    useEffect(() => {
      if (!catalogos) return

      const current = form.getFieldValue('datosBasicos')
      const estructuraActual = estructurasPlanList.find(
        (estructura) => estructura.id === current.estructuraPlanId,
      )
      const tipoEfectivo = current.tipoEstructura ?? estructuraActual?.tipo
      const latestEstructuraId =
        estructurasPlanList.find(
          (estructura) => estructura.tipo === tipoEfectivo,
        )?.id ?? null
      const forcedCarrera = scope.forcedCarreraId
        ? rawCarreras.find((c) => c.id === scope.forcedCarreraId)
        : undefined
      const forcedFacultadId =
        forcedCarrera?.facultad_id ?? scope.forcedFacultadId ?? null
      const forcedFacultad = forcedFacultadId
        ? facultadesList.find((f) => f.id === forcedFacultadId)
        : undefined

      if (
        !latestEstructuraId &&
        !estructuraActual &&
        !forcedFacultad &&
        !forcedCarrera
      )
        return

      const next = { ...current }
      let changed = false

      if (!next.tipoEstructura && estructuraActual?.tipo) {
        next.tipoEstructura = estructuraActual.tipo
        changed = true
      }

      if (
        latestEstructuraId &&
        (!next.estructuraPlanId ||
          (tipoEfectivo && estructuraActual?.tipo !== tipoEfectivo))
      ) {
        next.estructuraPlanId = latestEstructuraId
        changed = true
      }

      if (forcedFacultad && current.facultad.id !== forcedFacultad.id) {
        next.facultad = {
          id: forcedFacultad.id,
          nombre: forcedFacultad.nombre,
        }
        changed = true
      }

      if (forcedCarrera && current.carrera.id !== forcedCarrera.id) {
        const defaults = getDefaultsForNivel(String(forcedCarrera.nivel))
        next.carrera = {
          id: forcedCarrera.id,
          nombre: forcedCarrera.nombre,
        }
        if (!next.nombrePlan)
          next.nombrePlan = getDefaultPlanName(forcedCarrera)
        next.tipoCiclo = next.tipoCiclo || defaults.tipoCiclo || ''
        next.numCiclos = next.numCiclos ?? defaults.numCiclos ?? null
        changed = true
      }

      if (changed) form.setFieldValue('datosBasicos', next)
    }, [
      catalogos,
      estructurasPlanList,
      facultadesList,
      form,
      rawCarreras,
      scope.forcedCarreraId,
      scope.forcedFacultadId,
      estructuraPlanIdActual,
      tipoEstructuraActual,
    ])

    const esCurricular = tipoEstructuraActual === 'CURRICULAR'

    const carreraSeleccionada = rawCarreras.find(
      (c: any) => c.id === carreraIdActual,
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

    const nombreDisplayPreview =
      nombreCurricularPara(
        carreraSeleccionada,
        fechaInicioImparticion,
        estructuraPlanIdActual,
      ) ?? ''

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

    if (catalogos && scope.visibleCarreras.length === 0) {
      return (
        <div className="border-warning/30 bg-warning/5 flex flex-col gap-3 rounded-lg border p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-warning mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex flex-col gap-2">
              <p className="text-foreground text-sm font-semibold">
                Sin carreras asignadas
              </p>
              <p className="text-muted-foreground text-sm">
                {isAdmin ||
                roleAssignments.some(
                  (r) =>
                    r.clave === 'JEFE_POSGRADO' ||
                    r.clave === 'DIRECTOR_FACULTAD' ||
                    r.clave === 'SECRETARIO_ACADEMICO',
                )
                  ? 'No tienes carreras configuradas aún en tu facultad. Crea una carrera primero para poder continuar.'
                  : 'Tu usuario no tiene ninguna carrera o facultad asignada. Contacta al administrador para configurar tu acceso.'}
              </p>
              {(isAdmin ||
                roleAssignments.some(
                  (r) =>
                    r.clave === 'JEFE_POSGRADO' ||
                    r.clave === 'DIRECTOR_FACULTAD' ||
                    r.clave === 'SECRETARIO_ACADEMICO',
                )) && (
                <a
                  href="/administracion/facultades/carrera/nuevo"
                  className="text-primary text-sm font-medium underline underline-offset-2"
                >
                  Ir a crear carrera →
                </a>
              )}
            </div>
          </div>
        </div>
      )
    }

    const carrerasFiltradas = scope.visibleCarreras.filter((c: any) => {
      const facId = facultadIdActual
      if (!facId) return true
      // soportar ambos shapes: `facultad_id` (BD) o `facultadId` (local)
      return c.facultad_id ? c.facultad_id === facId : c.facultadId === facId
    })

    /* El tipo de plan no es un campo más: decide qué plantilla se aplica, si
       el nombre se deriva de la carrera o se escribe a mano, y si hace falta
       una fecha de inicio de impartición. Preguntarlo junto al resto llevaba a
       rellenar campos que la elección posterior invalidaba, así que abre el
       paso en solitario y nada más se muestra hasta que está resuelto. */
    const tipoEstructuraControl = (
      <form.AppField
        name="datosBasicos.tipoEstructura"
        validators={{
          onChange: ({ value }) => {
            const error = primerError(tipoEstructuraPlanSchema, value)
            if (error) return error
            return estructurasPlanList.some(
              (estructura) => estructura.tipo === value,
            )
              ? undefined
              : 'No hay una plantilla disponible para este tipo de plan.'
          },
        }}
      >
        {(field) => (
          <div className="grid gap-2 sm:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2">
              {TIPOS_ESTRUCTURA.map(({ value, label, icono: Icono, ayuda }) => {
                const seleccionado = field.state.value === value
                return (
                  <Tooltip key={value}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-pressed={seleccionado}
                        onClick={() => {
                          const latest = estructurasPlanList.find(
                            (estructura) => estructura.tipo === value,
                          )
                          field.handleChange(value)
                          form.setFieldValue(
                            'datosBasicos.estructuraPlanId',
                            latest?.id ?? null,
                          )
                          form.setFieldValue('confirmarFechaPasada', false)
                        }}
                        className={cn(
                          'organic-interactive flex items-center gap-3 rounded-xl border p-4 text-left transition-colors outline-none',
                          'focus-visible:ring-ring focus-visible:ring-2',
                          seleccionado
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40 hover:bg-accent/30',
                        )}
                      >
                        <Icono
                          className={cn(
                            'size-6 shrink-0',
                            seleccionado
                              ? 'text-primary'
                              : 'text-muted-foreground',
                          )}
                        />
                        <span className="grid gap-0.5">
                          <span className="text-base leading-tight font-semibold">
                            {label}
                          </span>
                          <span className="text-muted-foreground text-xs leading-snug">
                            {ayuda}
                          </span>
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{ayuda}</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
            <FieldErrorText meta={field.state.meta} id="tipoEstructura-error" />
          </div>
        )}
      </form.AppField>
    )

    if (!tipoEstructuraActual) {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            ¿Qué tipo de plan vas a crear?
          </p>
          {tipoEstructuraControl}
        </div>
      )
    }

    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return (
        <div className="flex flex-col gap-4">
          {tipoEstructuraControl}

          {esCurricular && (
            <FechaInicioImparticionField
              form={form}
              esCurricular={esCurricular}
            />
          )}
        </div>
      )
    }

    const carrerasPorNivel = carrerasFiltradas.reduce<
      Record<string, Array<any>>
    >((acc, carrera: any) => {
      const nivel = String(carrera.nivel ?? '').trim() || 'Otro'
      acc[nivel] = acc[nivel] ?? []
      acc[nivel].push(carrera)
      return acc
    }, {})

    const nivelesCarreras = [
      ...NIVELES.filter((nivel) => (carrerasPorNivel[nivel] ?? []).length > 0),
      ...Object.keys(carrerasPorNivel).filter(
        (nivel) => !NIVELES.includes(nivel as (typeof NIVELES)[number]),
      ),
    ]

    const hasFacultad = Boolean(facultadIdActual)
    const hasCarreras = carrerasFiltradas.length > 0
    const isCarreraDisabled = !hasFacultad || !hasCarreras
    const carreraPlaceholder = !hasFacultad
      ? 'Selecciona primero una facultad'
      : !hasCarreras
        ? 'Esta facultad no tiene carreras'
        : 'Ej. Ingeniería en Cibernética y Sistemas Computacionales'
    const tieneRolDeFacultad = roleAssignments.some((assignment) =>
      ['JEFE_POSGRADO', 'SECRETARIO_ACADEMICO', 'DIRECTOR_FACULTAD'].includes(
        assignment.clave,
      ),
    )
    const ocultarFacultad =
      !isAdmin && (tieneRolDeFacultad || Boolean(scope.forcedFacultadId))
    const tieneRolDeCarrera = roleAssignments.some(
      (assignment) => assignment.clave === 'JEFE_CARRERA',
    )
    const ocultarCarrera =
      !isAdmin && tieneRolDeCarrera && Boolean(scope.forcedCarreraId)

    return (
      <div className="flex flex-col gap-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Facultad y carrera van primero: son las que acotan todo lo demás
              —qué plantillas aplican, qué nivel, cuántos ciclos por defecto— y
              preguntarlas después obligaba a rehacer elecciones ya tomadas. */}
          <form.AppField
            name="datosBasicos.facultad"
            validators={{
              onChange: ({ value }) =>
                primerError(facultadSeleccionadaSchema, value),
            }}
          >
            {(field) => (
              <div className={cn('grid gap-1', ocultarFacultad && 'hidden')}>
                <Label htmlFor="facultad">Facultad</Label>
                <Select
                  value={field.state.value.id}
                  onValueChange={(value) => {
                    field.handleChange({
                      id: value,
                      nombre:
                        facultadesList.find((f) => f.id === value)?.nombre ||
                        '',
                    })
                    form.setFieldValue('datosBasicos.carrera', {
                      id: '',
                      nombre: '',
                    })
                  }}
                  disabled={!scope.canChooseFacultad}
                >
                  <SelectTrigger
                    id="facultad"
                    aria-invalid={fieldInvalid(field.state.meta)}
                    className={cn(
                      'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                      !field.state.value.id
                        ? 'text-muted-foreground font-normal italic opacity-70'
                        : 'font-medium not-italic',
                    )}
                  >
                    <SelectValue placeholder="Ej. Ingeniería" />
                  </SelectTrigger>
                  <SelectContent>
                    {scope.visibleFacultades.map((f: FacultadRow) => (
                      <SelectItem
                        key={f.id}
                        value={f.id}
                        textValue={formatFacultadNombre(f)}
                      >
                        <span className="flex items-center gap-2">
                          <FacultadIconPill facultad={f} />
                          {formatFacultadNombre(f)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldErrorText meta={field.state.meta} id="facultad-error" />
              </div>
            )}
          </form.AppField>

          <form.AppField
            name="datosBasicos.carrera"
            validators={{
              onChange: ({ value }) =>
                primerError(carreraSeleccionadaSchema, value),
            }}
          >
            {(field) => (
              <div
                className={cn(
                  'grid gap-1',
                  ocultarCarrera && 'hidden',
                  ocultarFacultad && !ocultarCarrera && 'sm:col-span-2',
                )}
              >
                <Label htmlFor="carrera">Carrera</Label>
                <Select
                  value={field.state.value.id}
                  onValueChange={(value) => {
                    const selected = carrerasFiltradas.find(
                      (c: any) => c.id === value,
                    )
                    const nivel = String(selected?.nivel ?? '').trim()

                    const defaults = getDefaultsForNivel(nivel)
                    const defaultNombre = esCurricular
                      ? (nombreCurricularPara(
                          selected,
                          fechaInicioImparticion,
                          estructuraPlanIdActual,
                        ) ?? '')
                      : getDefaultPlanName(selected)

                    field.handleChange({
                      id: value,
                      nombre: selected?.nombre || '',
                    })
                    form.setFieldValue('datosBasicos.nombrePlan', defaultNombre)
                    form.setFieldValue(
                      'datosBasicos.tipoCiclo',
                      defaults.tipoCiclo || '',
                    )
                    form.setFieldValue(
                      'datosBasicos.numCiclos',
                      defaults.numCiclos ?? null,
                    )
                  }}
                  disabled={isCarreraDisabled || !scope.canChooseCarrera}
                >
                  <SelectTrigger
                    id="carrera"
                    aria-invalid={fieldInvalid(field.state.meta)}
                    className={cn(
                      'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                      !field.state.value.id
                        ? 'text-muted-foreground font-normal italic opacity-70'
                        : 'font-medium not-italic',
                    )}
                  >
                    <SelectValue placeholder={carreraPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {nivelesCarreras.map((nivel, index) => (
                      <SelectGroup key={nivel}>
                        <SelectLabel>{nivel}</SelectLabel>
                        {(carrerasPorNivel[nivel] ?? []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                        {index < nivelesCarreras.length - 1 ? (
                          <SelectSeparator />
                        ) : null}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <FieldErrorText meta={field.state.meta} id="carrera-error" />
              </div>
            )}
          </form.AppField>

          {tipoEstructuraControl}

          {esCurricular && (
            <div className="grid gap-1 sm:col-span-2">
              <FechaInicioImparticionField
                form={form}
                esCurricular={esCurricular}
                onFechaChange={(next) =>
                  syncNombreCurricular(
                    carreraSeleccionada,
                    next,
                    estructuraPlanIdActual,
                  )
                }
              />
            </div>
          )}

          <div className="grid gap-1 sm:col-span-2">
            {esCurricular ? (
              <p
                className={cn(
                  'border-border/70 border-b px-0 pb-2 text-3xl leading-tight font-bold text-balance',
                  !nombreDisplayPreview && 'text-muted-foreground italic',
                )}
              >
                {nombreDisplayPreview ||
                  'Selecciona carrera e inicio de impartición'}
              </p>
            ) : (
              <form.AppField
                name="datosBasicos.nombrePlan"
                validators={{ onChange: nombrePlanSchema }}
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

          {/* `grupo-enfoque` apaga todo lo que no se está tocando; cada control
              lleva su `EtiquetaEnFoco`, que hace de label mientras dura el
              foco. Entre las dos cosas la frase se comporta como un formulario
              sin parecerlo. */}
          <div className="grupo-enfoque border-border flex flex-wrap items-center justify-center gap-2 border-y py-5 sm:col-span-2">
            <span className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
              Tiene
            </span>
            <form.AppField
              name="datosBasicos.numCiclos"
              validators={{
                onChange: ({ value }) => primerError(numCiclosSchema, value),
              }}
            >
              {(field) => (
                // El error se saca del flujo: en una fila `flex-wrap`, su ancho
                // era el que mandaba y una frase de seis palabras partía la
                // frase «Tiene N semestres» en tres renglones.
                <EtiquetaEnFoco
                  etiqueta="Número de ciclos"
                  className="relative"
                >
                  <EditableNumber
                    value={field.state.value}
                    onSave={field.handleChange}
                    min={1}
                    max={99}
                    underline
                    overlayControls
                    ariaLabel="Número de ciclos"
                    className="text-foreground text-xl font-bold"
                  />
                  <FieldErrorText
                    meta={field.state.meta}
                    id="numCiclos-error"
                    className="absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap"
                  />
                </EtiquetaEnFoco>
              )}
            </form.AppField>

            <form.AppField name="datosBasicos.tipoCiclo">
              {(field) => (
                <EtiquetaEnFoco etiqueta="Tipo de ciclo" side="top">
                  <EditableSelect
                    value={pluralizarTipoCiclo(
                      field.state.value,
                      numCiclosActual,
                    ).toLocaleUpperCase('es-MX')}
                    options={[...TIPOS_CICLO]}
                    placeholder="CICLOS"
                    ariaLabel="Tipo de ciclo"
                    underline
                    onSave={(value) => {
                      const selected = TIPOS_CICLO.find(
                        (tipo) => tipo === value,
                      )
                      if (selected) field.handleChange(selected)
                    }}
                    className="w-auto min-w-0 [&_span]:text-sm [&_span]:font-semibold [&_span]:tracking-[0.08em]"
                  />
                </EtiquetaEnFoco>
              )}
            </form.AppField>
          </div>
        </div>
      </div>
    )
  },
})
