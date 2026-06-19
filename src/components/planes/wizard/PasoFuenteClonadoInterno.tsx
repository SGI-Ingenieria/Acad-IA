import { CheckCircle2, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useDebounce } from 'use-debounce'

import type { NewPlanWizardState } from '@/features/planes/nuevo/types'

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
import { useCatalogosPlanes, usePlan, usePlanes } from '@/data'
import {
  resolveAcademicScope,
  useAcademicScope,
} from '@/data/auth/academicScope'
import { cn } from '@/lib/utils'

const ALL = '__all__'

function defaultPlanName(nombre: string) {
  return `${nombre} (copia)`
}

export function PasoFuenteClonadoInterno({
  wizard,
  onChange,
}: {
  wizard: NewPlanWizardState
  onChange: React.Dispatch<React.SetStateAction<NewPlanWizardState>>
}) {
  const facultadId = wizard.clonInterno?.facultadId ?? null
  const carreraId = wizard.clonInterno?.carreraId ?? null
  const search = wizard.clonInterno?.search ?? ''
  const selectedId = wizard.clonInterno?.planOrigenId ?? null
  const [debouncedSearch] = useDebounce(search, 350)

  const academicScope = useAcademicScope()
  const { data: catalogos } = useCatalogosPlanes()
  const scope = useMemo(
    () =>
      resolveAcademicScope(
        academicScope,
        catalogos?.facultades ?? [],
        catalogos?.carreras ?? [],
      ),
    [academicScope, catalogos?.carreras, catalogos?.facultades],
  )

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

  const { data: sourcePlan } = usePlan(selectedId)

  useEffect(() => {
    if (!sourcePlan) return

    const facultad = sourcePlan.carreras?.facultades
    const carrera = sourcePlan.carreras

    onChange((w) => ({
      ...w,
      datosBasicos: {
        ...w.datosBasicos,
        nombrePlan: defaultPlanName(sourcePlan.nombre),
        facultad: {
          id: facultad?.id ?? w.datosBasicos.facultad.id,
          nombre: facultad?.nombre ?? w.datosBasicos.facultad.nombre,
        },
        carrera: {
          id: carrera?.id ?? w.datosBasicos.carrera.id,
          nombre: carrera?.nombre ?? w.datosBasicos.carrera.nombre,
        },
        tipoCiclo: sourcePlan.tipo_ciclo,
        numCiclos: sourcePlan.numero_ciclos,
        estructuraPlanId: sourcePlan.estructura_id,
      },
      clonInterno: {
        ...(w.clonInterno ?? {}),
        planOrigenNombre: sourcePlan.nombre,
      },
    }))
  }, [onChange, sourcePlan])

  const patchClonInterno = (
    patch: Partial<NonNullable<NewPlanWizardState['clonInterno']>>,
  ) =>
    onChange((w) => ({
      ...w,
      clonInterno: { ...(w.clonInterno ?? {}), ...patch },
    }))

  const clearFilters = () =>
    patchClonInterno({
      facultadId: null,
      carreraId: null,
      search: '',
      planOrigenId: null,
      planOrigenNombre: null,
    })

  const hasAnyFilter = Boolean(
    facultadId || carreraId || search.trim() || selectedId,
  )
  const planes = planesQuery.data?.data ?? []

  return (
    <div className="grid gap-4">
      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="text-base">Plan fuente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {scope.canChooseFacultad && (
              <div className="grid gap-1">
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
                        <span className="flex items-center gap-2">
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
              <div className="grid gap-1">
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

            <div className="grid gap-1">
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

      <div className="grid gap-2">
        <div className="text-muted-foreground text-xs">
          Selecciona un plan de estudios para precargar sus datos básicos.
        </div>

        <div className="grid max-h-96 gap-2 overflow-y-auto px-1">
          {planesQuery.isLoading ? (
            <div className="text-muted-foreground text-sm">
              Cargando planes...
            </div>
          ) : planes.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              No hay planes con esos filtros.
            </div>
          ) : (
            planes.map((plan) => {
              const active = String(selectedId) === String(plan.id)
              return (
                <label
                  key={plan.id}
                  className={cn(
                    'hover:bg-accent flex cursor-pointer items-center justify-between rounded-md border p-3 text-left',
                    active && 'border-primary bg-primary/5 ring-primary ring-1',
                  )}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="planFuente"
                    checked={active}
                    onChange={() =>
                      patchClonInterno({
                        planOrigenId: plan.id,
                        planOrigenNombre: plan.nombre,
                      })
                    }
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{plan.nombre}</div>
                    <div className="text-muted-foreground mt-0.5 truncate text-xs">
                      {plan.carreras?.facultades?.nombre ?? 'Sin facultad'} /{' '}
                      {plan.carreras?.nombre ?? 'Sin carrera'} ·{' '}
                      {plan.numero_ciclos} {plan.tipo_ciclo.toLowerCase()}s
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
    </div>
  )
}
