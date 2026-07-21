import { useStore } from '@tanstack/react-form'
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type {
  CarreraRow,
  EstructuraPlanRow,
  FacultadRow,
  TipoCiclo,
} from '@/data/types/domain'
import type { AnyFieldMeta } from '@tanstack/react-form'

import { withForm } from '@/components/form'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field'
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
  resolveAcademicScope,
  useAcademicScope,
} from '@/data/auth/academicScope'
import { isPostgradoNivel } from '@/data/auth/planCapabilities'
import { usePermissions } from '@/data/hooks/usePermissions'
import { useCatalogosPlanes } from '@/data/hooks/usePlans'
import { NIVELES, TIPOS_CICLO } from '@/features/planes/nuevo/catalogs'
import {
  errorFechaImparticion,
  estructuraPlanSchema,
  facultadSeleccionadaSchema,
  carreraSeleccionadaSchema,
  nombrePlanSchema,
  numCiclosSchema,
  nuevoPlanFormOpts,
  primerError,
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
                    if (next) setViewYear(fecha ? selectedYear : currentYear)
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
                          className="h-7 w-7"
                          aria-label="Año anterior"
                          disabled={viewYear <= minYear}
                          onClick={() =>
                            setViewYear((y) => Math.max(minYear, y - 1))
                          }
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-semibold tabular-nums">
                          {viewYear}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Año siguiente"
                          disabled={viewYear >= maxYear}
                          onClick={() =>
                            setViewYear((y) => Math.min(maxYear, y + 1))
                          }
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Rejilla de meses: cada clic confirma, aunque coincida con el
                          valor actual, evitando el estado que no se actualizaba. */}
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

      const latestEstructuraId = estructurasPlanList[0]?.id ?? null
      const forcedCarrera = scope.forcedCarreraId
        ? rawCarreras.find((c) => c.id === scope.forcedCarreraId)
        : undefined
      const forcedFacultadId =
        forcedCarrera?.facultad_id ?? scope.forcedFacultadId ?? null
      const forcedFacultad = forcedFacultadId
        ? facultadesList.find((f) => f.id === forcedFacultadId)
        : undefined

      if (!latestEstructuraId && !forcedFacultad && !forcedCarrera) return

      const current = form.getFieldValue('datosBasicos')
      const next = { ...current }
      let changed = false

      if (!next.estructuraPlanId && latestEstructuraId) {
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
    ])

    const estructuraSeleccionada = estructurasPlanList.find(
      (e: EstructuraPlanRow) => e.id === estructuraPlanIdActual,
    )
    const esCurricular = estructuraSeleccionada?.tipo === 'CURRICULAR'

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
                  href="/facultades/carrera/nuevo"
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

    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return (
        <div className="flex flex-col gap-4">
          <form.AppField
            name="datosBasicos.estructuraPlanId"
            validators={{
              onChange: ({ value }) => primerError(estructuraPlanSchema, value),
            }}
          >
            {(field) => (
              <div className="grid gap-1">
                <Label htmlFor="estructuraPlan">
                  Estructura de plan de estudios
                </Label>
                <Select
                  value={field.state.value ?? ''}
                  onValueChange={(value: string) => field.handleChange(value)}
                >
                  <SelectTrigger
                    id="estructuraPlan"
                    aria-invalid={fieldInvalid(field.state.meta)}
                    className={cn(
                      'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                      !field.state.value
                        ? 'text-muted-foreground font-normal italic opacity-70'
                        : 'font-medium not-italic',
                    )}
                  >
                    <SelectValue placeholder="Ej. Plan base SEP/ULSA (2026)" />
                  </SelectTrigger>
                  <SelectContent>
                    {estructurasPlanList.map((t: EstructuraPlanRow) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldErrorText
                  meta={field.state.meta}
                  id="estructuraPlan-error"
                />
              </div>
            )}
          </form.AppField>

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

    return (
      <div className="flex flex-col gap-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <form.AppField
            name="datosBasicos.facultad"
            validators={{
              onChange: ({ value }) =>
                primerError(facultadSeleccionadaSchema, value),
            }}
          >
            {(field) => (
              <div className="grid gap-1">
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
              <div className="grid gap-1">
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
              <div className="border-primary/20 bg-primary/5 grid gap-2 rounded-md border p-4">
                <Label>Nombre del plan</Label>
                <div className="min-h-14">
                  <p
                    className={cn(
                      'text-foreground text-2xl leading-tight font-semibold text-balance',
                      !nombreDisplayPreview && 'text-muted-foreground italic',
                    )}
                  >
                    {nombreDisplayPreview ||
                      'Selecciona carrera e inicio de impartición'}
                  </p>
                </div>
              </div>
            ) : (
              <form.AppField
                name="datosBasicos.nombrePlan"
                validators={{ onChange: nombrePlanSchema }}
              >
                {(field) => (
                  <>
                    <Label htmlFor="nombrePlan">Nombre propuesto</Label>
                    <Input
                      id="nombrePlan"
                      placeholder="Ej. Programa ejecutivo de actualización"
                      value={field.state.value}
                      disabled={!carreraIdActual}
                      maxLength={200}
                      onBlur={field.handleBlur}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        field.handleChange(e.target.value)
                      }
                      aria-invalid={fieldInvalid(field.state.meta)}
                      aria-describedby={
                        fieldInvalid(field.state.meta)
                          ? 'nombrePlan-error'
                          : undefined
                      }
                      className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
                    />
                    <FieldErrorText
                      meta={field.state.meta}
                      id="nombrePlan-error"
                    />
                  </>
                )}
              </form.AppField>
            )}
          </div>

          <form.AppField name="datosBasicos.tipoCiclo">
            {(field) => (
              <div className="grid gap-1">
                <Label htmlFor="tipoCiclo">Tipo de ciclo</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value: TipoCiclo) =>
                    field.handleChange(value)
                  }
                >
                  <SelectTrigger
                    id="tipoCiclo"
                    className={cn(
                      'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                      !field.state.value
                        ? 'text-muted-foreground font-normal italic opacity-70' // Es Placeholder
                        : 'font-medium not-italic', // Tiene Valor (Medium)
                    )}
                  >
                    <SelectValue placeholder="Ej. Semestre" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CICLO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.AppField>

          <form.AppField
            name="datosBasicos.numCiclos"
            validators={{
              onChange: ({ value }) => primerError(numCiclosSchema, value),
            }}
          >
            {(field) => (
              <div className="grid gap-1">
                <Label htmlFor="numCiclos">Número de ciclos</Label>
                <NumberField
                  value={field.state.value}
                  min={1}
                  max={99}
                  step={1}
                  onValueChange={(value) => field.handleChange(value)}
                >
                  <NumberFieldGroup>
                    <NumberFieldDecrement />
                    <NumberFieldInput
                      id="numCiclos"
                      placeholder="Ej. 8"
                      aria-invalid={fieldInvalid(field.state.meta)}
                      className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
                    />
                    <NumberFieldIncrement />
                  </NumberFieldGroup>
                </NumberField>
                <FieldErrorText meta={field.state.meta} id="numCiclos-error" />
              </div>
            )}
          </form.AppField>

          <form.AppField
            name="datosBasicos.estructuraPlanId"
            validators={{
              onChange: ({ value }) => primerError(estructuraPlanSchema, value),
            }}
          >
            {(field) => (
              <div className="grid gap-1">
                <Label htmlFor="estructuraPlan">
                  Estructura de plan de estudios
                </Label>
                <Select
                  value={field.state.value ?? ''}
                  onValueChange={(value: string) => {
                    field.handleChange(value)
                    syncNombreCurricular(
                      carreraSeleccionada,
                      fechaInicioImparticion,
                      value,
                    )
                  }}
                >
                  <SelectTrigger
                    id="estructuraPlan"
                    aria-invalid={fieldInvalid(field.state.meta)}
                    className={cn(
                      'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                      !field.state.value
                        ? 'text-muted-foreground font-normal italic opacity-70' // Es Placeholder
                        : 'font-medium not-italic', // Tiene Valor (Medium)
                    )}
                  >
                    <SelectValue placeholder="Ej. Plan base SEP/ULSA (2026)" />
                  </SelectTrigger>
                  <SelectContent>
                    {estructurasPlanList.map((t: EstructuraPlanRow) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldErrorText
                  meta={field.state.meta}
                  id="estructuraPlan-error"
                />
              </div>
            )}
          </form.AppField>
        </div>
      </div>
    )
  },
})
