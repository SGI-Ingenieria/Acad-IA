import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, X } from 'lucide-react'
import { useMemo } from 'react'
import { useDebounce } from 'use-debounce'

import type { NuevoPlanFormValues } from '@/features/planes/nuevo/types'
import type { AnyFieldMeta } from '@tanstack/react-form'

import { withForm } from '@/components/form'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCatalogosPlanes, usePlanes } from '@/data'
import {
  resolveAcademicScope,
  useAcademicScope,
} from '@/data/auth/academicScope'
import { isPostgradoNivel } from '@/data/auth/planCapabilities'
import { usePermissions } from '@/data/hooks/usePermissions'
import { planOptions } from '@/data/query/queryOptions'
import {
  nuevoPlanFormOpts,
  planFuenteSchema,
  primerError,
} from '@/features/planes/nuevo/schema'
import { pluralizarTipoCiclo } from '@/lib/ciclo-utils'
import { getPlanDisplayName } from '@/lib/plan-display'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

const ALL = '__all__'
const GLOBAL_PLAN_ROLES = new Set(['ADMIN', 'VICERRECTOR_ACADEMICO'])
const FACULTY_PLAN_ROLES = new Set([
  'DIRECTOR_FACULTAD',
  'SECRETARIO_ACADEMICO',
])

function defaultPlanName(nombre: string) {
  return `${nombre} (copia)`
}

function canUseCarreraForClonado(
  carrera: { id: string; facultad_id: string; nivel: string | null },
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

export const PasoFuenteClonadoInterno = withForm({
  ...nuevoPlanFormOpts,
  render: function Render({ form }) {
    const qc = useQueryClient()

    const clonInterno = useStore(form.store, (s) => s.values.clonInterno)

    const facultadId = clonInterno.facultadId
    const carreraId = clonInterno.carreraId
    const search = clonInterno.search
    const selectedId = clonInterno.planOrigenId
    const [debouncedSearch] = useDebounce(search, 350)

    const academicScope = useAcademicScope()
    const { roleAssignments, isAdmin } = usePermissions()
    const { data: catalogos } = useCatalogosPlanes()
    const baseScope = useMemo(
      () =>
        resolveAcademicScope(
          academicScope,
          catalogos?.facultades ?? [],
          catalogos?.carreras ?? [],
        ),
      [academicScope, catalogos?.carreras, catalogos?.facultades],
    )
    const scope = useMemo(() => {
      const visibleCarreras = baseScope.visibleCarreras.filter((carrera) =>
        canUseCarreraForClonado(carrera, roleAssignments, isAdmin),
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

    const effectiveFacultadId = scope.forcedFacultadId ?? facultadId ?? 'todas'
    const effectiveCarreraId = scope.forcedCarreraId ?? carreraId ?? 'todas'

    const carrerasOptions = useMemo(() => {
      if (effectiveFacultadId === 'todas') return scope.visibleCarreras
      return scope.visibleCarreras.filter(
        (carrera) => carrera.facultad_id === effectiveFacultadId,
      )
    }, [effectiveFacultadId, scope.visibleCarreras])

    const carrerasPorNivel = useMemo(() => {
      const groups = new Map<string, typeof carrerasOptions>()
      carrerasOptions.forEach((carrera) => {
        const nivel = String(carrera.nivel).trim() || 'Otro'
        const current = groups.get(nivel) ?? []
        current.push(carrera)
        groups.set(nivel, current)
      })
      return Array.from(groups.entries()).map(([nivel, carreras]) => ({
        nivel,
        carreras,
      }))
    }, [carrerasOptions])

    const planesQuery = usePlanes({
      search: debouncedSearch,
      facultadId: effectiveFacultadId,
      carreraId: effectiveCarreraId,
      estadoId: 'todos',
      activo: true,
      limit: 50,
      offset: 0,
    })

    const patchClonInterno = (
      patch: Partial<NuevoPlanFormValues['clonInterno']>,
    ) =>
      form.setFieldValue('clonInterno', {
        ...form.getFieldValue('clonInterno'),
        ...patch,
      })

    /**
     * Acción explícita de selección del plan fuente (sustituye al useEffect
     * que copiaba el plan fuente al estado del wizard): fija el id y copia
     * los datos básicos del plan al form en el propio handler.
     */
    const seleccionarFuente = async (planId: string) => {
      try {
        const fuente = await qc.ensureQueryData(planOptions(planId))

        // Selección superada por otra más reciente: no pisar la intención.
        if (form.getFieldValue('clonInterno.planOrigenId') !== planId) return

        const facultad = fuente.carreras?.facultades
        const carrera = fuente.carreras
        const datosBasicos = form.getFieldValue('datosBasicos')

        form.setFieldValue('datosBasicos', {
          ...datosBasicos,
          nombrePlan: defaultPlanName(getPlanDisplayName(fuente)),
          facultad: {
            id: facultad?.id ?? datosBasicos.facultad.id,
            nombre: facultad?.nombre ?? datosBasicos.facultad.nombre,
          },
          carrera: {
            id: carrera?.id ?? datosBasicos.carrera.id,
            nombre: carrera?.nombre ?? datosBasicos.carrera.nombre,
          },
          tipoCiclo: fuente.tipo_ciclo,
          numCiclos: fuente.numero_ciclos,
          // El plan fuente puede ser antiguo y no traerla; el paso básico la
          // pedirá antes de dejar continuar si sus ciclos son de tipo «Otro».
          semanasPorCiclo: fuente.semanas_por_ciclo,
          estructuraPlanId: fuente.estructura_id,
        })
        patchClonInterno({
          planOrigenNombre: getPlanDisplayName(fuente),
        })
      } catch {
        notify.error(
          'No se pudieron cargar los datos del plan fuente. Intenta seleccionarlo de nuevo.',
        )
      }
    }

    const hasAnyFilter = Boolean(
      facultadId || carreraId || search.trim() || selectedId,
    )

    const clearFilters = () =>
      patchClonInterno({
        facultadId: null,
        carreraId: null,
        search: '',
        planOrigenId: null,
        planOrigenNombre: null,
      })

    const visibleCarreraIds = useMemo(
      () => new Set(scope.visibleCarreras.map((carrera) => carrera.id)),
      [scope.visibleCarreras],
    )
    const filteredPlanes = useMemo(() => {
      const planes = planesQuery.data?.data ?? []
      return planes.filter((plan) =>
        plan.carrera_id ? visibleCarreraIds.has(plan.carrera_id) : false,
      )
    }, [planesQuery.data?.data, visibleCarreraIds])

    return (
      <div className="gap-grupo grid">
        <Card className="gap-grupo">
          <CardHeader>
            <CardTitle className="text-base">Plan fuente</CardTitle>
          </CardHeader>
          <CardContent className="gap-grupo grid">
            <div className="gap-control grid sm:grid-cols-3">
              {scope.canChooseFacultad && (
                <div className="gap-micro grid">
                  <Label>Facultad</Label>
                  <Select
                    value={facultadId ?? ALL}
                    onValueChange={(value) =>
                      patchClonInterno({
                        facultadId: value === ALL ? null : value,
                        carreraId: null,
                        planOrigenId: null,
                        planOrigenNombre: null,
                      })
                    }
                  >
                    <SelectTrigger className="w-full min-w-0 [&>span]:block! [&>span]:truncate!">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>
                        {scope.isGlobal ? 'Todas' : 'Mis facultades'}
                      </SelectItem>
                      {scope.visibleFacultades.map((facultad) => (
                        <SelectItem
                          key={facultad.id}
                          value={facultad.id}
                          textValue={facultad.nombre}
                        >
                          <span className="gap-relacionado flex items-center">
                            <FacultadIconPill facultad={facultad} />
                            {facultad.nombre}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {scope.canChooseCarrera && (
                <div className="gap-micro grid">
                  <Label>Carrera</Label>
                  <Select
                    value={carreraId ?? ALL}
                    onValueChange={(value) =>
                      patchClonInterno({
                        carreraId: value === ALL ? null : value,
                        planOrigenId: null,
                        planOrigenNombre: null,
                      })
                    }
                    disabled={carrerasOptions.length === 0}
                  >
                    <SelectTrigger className="w-full min-w-0 [&>span]:block! [&>span]:truncate!">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>
                        {scope.isGlobal ? 'Todas' : 'Mis carreras'}
                      </SelectItem>
                      {carrerasPorNivel.map((grupo) => (
                        <SelectGroup key={grupo.nivel}>
                          <SelectLabel>{grupo.nivel}</SelectLabel>
                          {grupo.carreras.map((carrera) => (
                            <SelectItem key={carrera.id} value={carrera.id}>
                              {carrera.nombre}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="gap-micro grid">
                <Label>Buscar</Label>
                <Input
                  placeholder="Nombre del plan..."
                  value={search}
                  onChange={(event) =>
                    patchClonInterno({
                      search: event.target.value,
                      planOrigenId: null,
                      planOrigenNombre: null,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={clearFilters}
                disabled={!hasAnyFilter}
              >
                <X className="h-4 w-4" />
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        <form.AppField
          name="clonInterno.planOrigenId"
          validators={{
            onChange: ({ value }) => primerError(planFuenteSchema, value),
          }}
        >
          {(field) => {
            const invalid = fieldInvalid(field.state.meta)

            return (
              <div className="gap-relacionado grid">
                <div className="text-muted-foreground text-xs">
                  Selecciona un plan de estudios para precargar sus datos
                  básicos.
                </div>

                {invalid ? (
                  <p className="text-destructive text-sm" role="alert">
                    {typeof field.state.meta.errors[0] === 'string'
                      ? field.state.meta.errors[0]
                      : 'Selecciona el plan de estudios que quieres clonar.'}
                  </p>
                ) : null}

                <div className="gap-relacionado px-micro grid max-h-96 overflow-y-auto">
                  {planesQuery.isLoading ? (
                    <div className="text-muted-foreground text-sm">
                      Cargando planes...
                    </div>
                  ) : filteredPlanes.length === 0 ? (
                    <div className="text-muted-foreground text-sm">
                      No hay planes con esos filtros.
                    </div>
                  ) : (
                    filteredPlanes.map((plan) => {
                      const active =
                        String(field.state.value) === String(plan.id)
                      const planDisplayName = getPlanDisplayName(plan)
                      return (
                        <label
                          key={plan.id}
                          className={cn(
                            'hover:bg-accent p-control flex cursor-pointer items-center justify-between rounded-md border text-left',
                            active &&
                              'border-primary bg-primary/5 ring-primary ring-1',
                          )}
                        >
                          <input
                            className="sr-only"
                            type="radio"
                            name="planFuente"
                            checked={active}
                            onChange={() => {
                              field.handleChange(plan.id)
                              patchClonInterno({
                                planOrigenNombre: planDisplayName,
                              })
                              void seleccionarFuente(plan.id)
                            }}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {planDisplayName}
                            </div>
                            <div className="text-muted-foreground mt-micro truncate text-xs">
                              {plan.carreras?.facultades?.nombre ??
                                'Sin facultad'}{' '}
                              / {plan.carreras?.nombre ?? 'Sin carrera'} ·{' '}
                              {plan.numero_ciclos}{' '}
                              {pluralizarTipoCiclo(
                                plan.tipo_ciclo,
                                plan.numero_ciclos,
                              )}
                            </div>
                          </div>
                          {active ? (
                            <CheckCircle2 className="text-primary h-5 w-5 flex-none" />
                          ) : (
                            <span className="h-5 w-5 flex-none" aria-hidden />
                          )}
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
            )
          }}
        </form.AppField>
      </div>
    )
  },
})
