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
import type { NewPlanWizardState } from '@/features/planes/nuevo/types'

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

function FechaInicioImparticionField({
  wizard,
  onChange,
}: {
  wizard: NewPlanWizardState
  onChange: React.Dispatch<React.SetStateAction<NewPlanWizardState>>
}) {
  const [open, setOpen] = useState(false)
  const fecha = wizard.datosBasicos.fechaInicioImparticion
  const esPasada = isFechaCurricularPasada(fecha)
  const fechaParsed = fecha ? parseFechaMes(fecha) : new Date()
  const selectedYear = fechaParsed.getFullYear()
  const selectedMonth = fechaParsed.getMonth()
  const currentYear = new Date().getFullYear()
  const minYear = currentYear - 5
  const maxYear = currentYear + 10

  // Año que se está navegando dentro del popover. Es independiente del valor
  // confirmado: sólo al hacer clic en un mes se compromete la fecha. Se
  // resincroniza cada vez que se abre el popover.
  const [viewYear, setViewYear] = useState(selectedYear)

  const setMesAnio = (year: number, monthIndex: number) => {
    onChange(
      (w): NewPlanWizardState => ({
        ...w,
        datosBasicos: {
          ...w.datosBasicos,
          fechaInicioImparticion: toMonthStartDateString(year, monthIndex),
        },
        confirmarFechaPasada: false,
      }),
    )
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
              className={cn(
                'w-full justify-start gap-2 font-medium',
                !fecha && 'text-muted-foreground font-normal italic opacity-70',
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
                  onClick={() => setViewYear((y) => Math.max(minYear, y - 1))}
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
                  onClick={() => setViewYear((y) => Math.min(maxYear, y + 1))}
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
                      className={cn('h-9', !isSelected && 'font-normal')}
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
      </div>

      {esPasada && (
        <div className="border-destructive/25 bg-destructive/4 grid gap-2 rounded-lg border p-3">
          <p className="text-destructive flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            El inicio seleccionado es anterior al mes actual.
          </p>
          <Label
            htmlFor="confirmarFechaPasada"
            className="flex cursor-pointer items-center gap-2 text-sm font-normal"
          >
            <Checkbox
              id="confirmarFechaPasada"
              checked={!!wizard.confirmarFechaPasada}
              onCheckedChange={(checked) =>
                onChange(
                  (w): NewPlanWizardState => ({
                    ...w,
                    confirmarFechaPasada: checked === true,
                  }),
                )
              }
            />
            Confirmo que el mes es correcto y deseo continuar.
          </Label>
        </div>
      )}
    </div>
  )
}

export function PasoBasicosForm({
  wizard,
  onChange,
}: {
  wizard: NewPlanWizardState
  onChange: React.Dispatch<React.SetStateAction<NewPlanWizardState>>
}) {
  const { data: catalogos } = useCatalogosPlanes()
  const academicScope = useAcademicScope()
  const { roleAssignments, isAdmin } = usePermissions()

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

    onChange((w): NewPlanWizardState => {
      const current = w.datosBasicos
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

      return changed ? { ...w, datosBasicos: next } : w
    })
  }, [
    catalogos,
    estructurasPlanList,
    facultadesList,
    onChange,
    rawCarreras,
    scope.forcedCarreraId,
    scope.forcedFacultadId,
  ])

  const carrerasFiltradas = scope.visibleCarreras.filter((c: any) => {
    const facId = wizard.datosBasicos.facultad.id
    if (!facId) return true
    // soportar ambos shapes: `facultad_id` (BD) o `facultadId` (local)
    return c.facultad_id ? c.facultad_id === facId : c.facultadId === facId
  })

  const estructuraSeleccionada = estructurasPlanList.find(
    (e: EstructuraPlanRow) => e.id === wizard.datosBasicos.estructuraPlanId,
  )
  const esCurricular = estructuraSeleccionada?.tipo === 'CURRICULAR'

  const fechaInicioImparticion = wizard.datosBasicos.fechaInicioImparticion

  const carreraSeleccionada = rawCarreras.find(
    (c: any) => c.id === wizard.datosBasicos.carrera.id,
  )
  const nombreDisplayPreview =
    esCurricular && fechaInicioImparticion && carreraSeleccionada
      ? formatNombrePlanCurricular(
          carreraSeleccionada.nivel,
          carreraSeleccionada.nombre,
          fechaInicioImparticion,
        )
      : ''

  useEffect(() => {
    if (!esCurricular || wizard.tipoOrigen === 'CLONADO_TRADICIONAL') return
    if (!nombreDisplayPreview) return

    if (wizard.datosBasicos.nombrePlan === nombreDisplayPreview) return

    onChange(
      (w): NewPlanWizardState => ({
        ...w,
        datosBasicos: {
          ...w.datosBasicos,
          nombrePlan: nombreDisplayPreview,
        },
      }),
    )
  }, [
    esCurricular,
    wizard.tipoOrigen,
    nombreDisplayPreview,
    wizard.datosBasicos.nombrePlan,
    onChange,
  ])

  if (wizard.tipoOrigen === 'CLONADO_TRADICIONAL') {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-1">
          <Label htmlFor="estructuraPlan">Estructura de plan de estudios</Label>
          <Select
            value={wizard.datosBasicos.estructuraPlanId ?? ''}
            onValueChange={(value: string) =>
              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    estructuraPlanId: value,
                  },
                }),
              )
            }
          >
            <SelectTrigger
              id="estructuraPlan"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.estructuraPlanId
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
        </div>

        {esCurricular && (
          <FechaInicioImparticionField wizard={wizard} onChange={onChange} />
        )}
      </div>
    )
  }

  const carrerasPorNivel = carrerasFiltradas.reduce<Record<string, Array<any>>>(
    (acc, carrera: any) => {
      const nivel = String(carrera.nivel ?? '').trim() || 'Otro'
      acc[nivel] = acc[nivel] ?? []
      acc[nivel].push(carrera)
      return acc
    },
    {},
  )

  const nivelesCarreras = [
    ...NIVELES.filter((nivel) => (carrerasPorNivel[nivel] ?? []).length > 0),
    ...Object.keys(carrerasPorNivel).filter(
      (nivel) => !NIVELES.includes(nivel as (typeof NIVELES)[number]),
    ),
  ]

  const hasFacultad = Boolean(wizard.datosBasicos.facultad.id)
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
        <div className="grid gap-1">
          <Label htmlFor="facultad">Facultad</Label>
          <Select
            value={wizard.datosBasicos.facultad.id}
            onValueChange={(value) =>
              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    facultad: {
                      id: value,
                      nombre:
                        facultadesList.find((f) => f.id === value)?.nombre ||
                        '',
                    },
                    carrera: { id: '', nombre: '' },
                  },
                }),
              )
            }
            disabled={!scope.canChooseFacultad}
          >
            <SelectTrigger
              id="facultad"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.facultad.id
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
        </div>

        <div className="grid gap-1">
          <Label htmlFor="carrera">Carrera</Label>
          <Select
            value={wizard.datosBasicos.carrera.id}
            onValueChange={(value) => {
              const selected = carrerasFiltradas.find(
                (c: any) => c.id === value,
              )
              const nivel = String(selected?.nivel ?? '').trim()

              const defaults = getDefaultsForNivel(nivel)
              const defaultNombre = esCurricular
                ? ''
                : getDefaultPlanName(selected)

              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    carrera: {
                      id: value,
                      nombre: selected?.nombre || '',
                    },
                    nombrePlan: defaultNombre,
                    tipoCiclo: defaults.tipoCiclo || '',
                    numCiclos: defaults.numCiclos ?? null,
                  },
                }),
              )
            }}
            disabled={isCarreraDisabled || !scope.canChooseCarrera}
          >
            <SelectTrigger
              id="carrera"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.carrera.id
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
        </div>

        {esCurricular && (
          <div className="grid gap-1 sm:col-span-2">
            <FechaInicioImparticionField wizard={wizard} onChange={onChange} />
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
            <>
              <Label htmlFor="nombrePlan">Nombre propuesto</Label>
              <Input
                id="nombrePlan"
                placeholder="Ej. Programa ejecutivo de actualización"
                value={wizard.datosBasicos.nombrePlan}
                disabled={!wizard.datosBasicos.carrera.id}
                maxLength={200}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onChange(
                    (w): NewPlanWizardState => ({
                      ...w,
                      datosBasicos: {
                        ...w.datosBasicos,
                        nombrePlan: e.target.value,
                      },
                    }),
                  )
                }
                className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
              />
            </>
          )}
        </div>

        <div className="grid gap-1">
          <Label htmlFor="tipoCiclo">Tipo de ciclo</Label>
          <Select
            value={wizard.datosBasicos.tipoCiclo}
            onValueChange={(value: TipoCiclo) =>
              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    tipoCiclo: value,
                  },
                }),
              )
            }
          >
            <SelectTrigger
              id="tipoCiclo"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.tipoCiclo
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

        <div className="grid gap-1">
          <Label htmlFor="numCiclos">Número de ciclos</Label>
          <NumberField
            value={wizard.datosBasicos.numCiclos}
            min={1}
            max={99}
            step={1}
            onValueChange={(value) =>
              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    numCiclos: value,
                  },
                }),
              )
            }
          >
            <NumberFieldGroup>
              <NumberFieldDecrement />
              <NumberFieldInput
                id="numCiclos"
                placeholder="Ej. 8"
                className="placeholder:text-muted-foreground/70 font-medium not-italic placeholder:font-normal placeholder:italic"
              />
              <NumberFieldIncrement />
            </NumberFieldGroup>
          </NumberField>
        </div>

        <div className="grid gap-1">
          <Label htmlFor="estructuraPlan">Estructura de plan de estudios</Label>
          <Select
            value={wizard.datosBasicos.estructuraPlanId ?? ''}
            onValueChange={(value: string) =>
              onChange(
                (w): NewPlanWizardState => ({
                  ...w,
                  datosBasicos: {
                    ...w.datosBasicos,
                    estructuraPlanId: value,
                  },
                }),
              )
            }
          >
            <SelectTrigger
              id="tipoCiclo"
              className={cn(
                'w-full min-w-0 [&>span]:block! [&>span]:truncate!',
                !wizard.datosBasicos.estructuraPlanId
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
        </div>
      </div>
      {/* <Separator className="my-3" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TemplateSelectorCard
          cardTitle="Plantilla de plan de estudios"
          cardDescription="Selecciona el Word para tu nuevo plan."
          templatesData={PLANTILLAS_ANEXO_1}
          selectedTemplateId={wizard.datosBasicos.plantillaPlanId || ''}
          selectedVersion={wizard.datosBasicos.plantillaPlanVersion || ''}
          onChange={({ templateId, version }) =>
            onChange((w) => ({
              ...w,
              datosBasicos: {
                ...w.datosBasicos,
                plantillaPlanId: templateId,
                plantillaPlanVersion: version,
              },
            }))
          }
        />
        <TemplateSelectorCard
          cardTitle="Plantilla de mapa curricular"
          cardDescription="Selecciona el Excel para tu mapa curricular."
          templatesData={PLANTILLAS_ANEXO_2}
          selectedTemplateId={wizard.datosBasicos.plantillaMapaId || ''}
          selectedVersion={wizard.datosBasicos.plantillaMapaVersion || ''}
          onChange={({ templateId, version }) =>
            onChange((w) => ({
              ...w,
              datosBasicos: {
                ...w.datosBasicos,
                plantillaMapaId: templateId,
                plantillaMapaVersion: version,
              },
            }))
          }
        />
      </div> */}
    </div>
  )
}
