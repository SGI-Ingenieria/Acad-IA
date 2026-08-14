import {
  createFileRoute,
  Link,
  Outlet,
  stripSearchParams,
  useMatchRoute,
  useNavigate,
} from '@tanstack/react-router'
import { AlertTriangle, BookOpenText, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Componentes
import type { PlanesListaSearch } from '@/types/search'

import Filtro from '@/components/planes/Filtro'
import PlanEstudiosCard from '@/components/planes/PlanEstudiosCard'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Button } from '@/components/ui/button'
import { InfiniteScrollSentinel } from '@/components/ui/infinite-scroll-sentinel'
import { Input } from '@/components/ui/input'
import { PageContainer } from '@/components/ui/layout'
import {
  ListFilterSection,
  ListFiltersDialog,
  ListSortMenu,
  ListToolbar,
} from '@/components/ui/list-controls'
import { MasonryGrid } from '@/components/ui/masonry-grid'
import { PlanCardGridSkeleton } from '@/components/ui/route-pending-skeleton'
import { SelectorModoVistaColeccion } from '@/components/ui/selector-modo-vista-coleccion'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  catalogosOptions,
  planesInfiniteOptions,
  planesEstadosDisponiblesOptions,
} from '@/data'
import {
  resolveAcademicScope,
  useAcademicScope,
} from '@/data/auth/academicScope'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { usePermissions } from '@/data/hooks/usePermissions'
import {
  useCatalogosPlanes,
  usePlanesInfinite,
  usePlanesEstadosDisponibles,
} from '@/data/hooks/usePlans'
import { PlanVacioFolder } from '@/features/planes/PlanVacioFolder'
import { DynamicIcon } from '@/features/planes/utils/icon-utils'
import { useModoVistaColeccion } from '@/features/preferencias/ModoVistaColeccionContext'
import { getOrganicMotion, gsap, useGSAP } from '@/lib/animations'
import { pluralizarTipoCiclo } from '@/lib/ciclo-utils'
import { formatFacultadNombre } from '@/lib/facultad-utils'
import { getPlanDisplayName } from '@/lib/plan-display'
import { defaultPlanesSearch } from '@/types/search'

const parsePlanesSearch = (
  search: Record<string, unknown>,
): PlanesListaSearch => {
  const q = typeof search.q === 'string' ? search.q : defaultPlanesSearch.q
  const facultad =
    typeof search.facultad === 'string'
      ? search.facultad
      : defaultPlanesSearch.facultad
  const carrera =
    typeof search.carrera === 'string'
      ? search.carrera
      : defaultPlanesSearch.carrera
  const estado =
    typeof search.estado === 'string'
      ? search.estado
      : defaultPlanesSearch.estado
  const nivel =
    typeof search.nivel === 'string' ? search.nivel : defaultPlanesSearch.nivel
  const tipo =
    search.tipo === 'CURRICULAR' || search.tipo === 'NO_CURRICULAR'
      ? search.tipo
      : defaultPlanesSearch.tipo
  const orden =
    search.orden === 'actualizado_desc' ||
    search.orden === 'nombre_asc' ||
    search.orden === 'nombre_desc'
      ? search.orden
      : defaultPlanesSearch.orden

  return { q, facultad, carrera, estado, nivel, tipo, orden }
}

const PAGE_SIZE = 16
const PLAN_SORT_OPTIONS = [
  { value: 'creado_desc', label: 'Creación reciente' },
  { value: 'actualizado_desc', label: 'Actualización reciente' },
  { value: 'nombre_asc', label: 'Nombre A–Z' },
  { value: 'nombre_desc', label: 'Nombre Z–A' },
] as const

export const Route = createFileRoute('/planes/_lista')({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, ['planes.ver']),
  validateSearch: parsePlanesSearch,
  search: {
    middlewares: [stripSearchParams(defaultPlanesSearch)],
  },
  loaderDeps: ({ search }) => ({
    q: search.q,
    facultad: search.facultad,
    carrera: search.carrera,
    estado: search.estado,
    nivel: search.nivel,
    tipo: search.tipo,
    orden: search.orden,
  }),
  // Solo precalentamos la caché sin bloquear: la página (encabezado y filtros)
  // se pinta de inmediato; las tarjetas muestran su skeleton mientras cargan.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(catalogosOptions())
    void context.queryClient.prefetchQuery(
      planesEstadosDisponiblesOptions({
        facultadId: deps.facultad,
        carreraId: deps.carrera,
        nivelFilter: deps.nivel === 'todos' ? undefined : deps.nivel,
        tipoEstructura: deps.tipo === 'todos' ? undefined : deps.tipo,
        catalogMode: true,
      }),
    )
    void context.queryClient.prefetchInfiniteQuery(
      planesInfiniteOptions(
        {
          search: deps.q,
          facultadId: deps.facultad,
          carreraId: deps.carrera,
          estadoId: deps.estado,
          nivelFilter: deps.nivel === 'todos' ? undefined : deps.nivel,
          tipoEstructura: deps.tipo === 'todos' ? undefined : deps.tipo,
          sort: deps.orden,
          catalogMode: true,
        },
        PAGE_SIZE,
      ),
    )
  },
  component: RouteComponent,
})

function RouteComponent() {
  const navigateFromLista = useNavigate({ from: Route.fullPath })
  const matchRoute = useMatchRoute()
  // El modal "Nuevo plan" (/planes/nuevo) es una ruta hija de este layout. La
  // corrección de scope de abajo navega al índice de la lista, lo que cerraría
  // ese modal; mientras esté abierto no debemos tocar los filtros.
  const isNuevoModalOpen = Boolean(matchRoute({ to: '/planes/nuevo' }))
  const routeSearch = Route.useSearch()
  const { modoVistaColeccion } = useModoVistaColeccion()

  // Búsqueda con debounce: el input es local y se vuelca a la URL tras una pausa.
  const [qInput, setQInput] = useState(routeSearch.q)
  useEffect(() => setQInput(routeSearch.q), [routeSearch.q])
  useEffect(() => {
    const trimmed = qInput.trim()
    if (trimmed === routeSearch.q) return
    const id = setTimeout(() => {
      navigateFromLista({
        search: (prev) => ({ ...prev, q: trimmed }),
        resetScroll: false,
      })
    }, 350)
    return () => clearTimeout(id)
  }, [qInput, navigateFromLista, routeSearch.q])

  const pageRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const { has } = usePermissions()
  const canCreatePlan = has('planes.crear')
  const academicScope = useAcademicScope()

  const { data: catalogos, isLoading: catalogosLoading } = useCatalogosPlanes()
  const facultades = useMemo(
    () => catalogos?.facultades ?? [],
    [catalogos?.facultades],
  )
  const carreras = useMemo(
    () => catalogos?.carreras ?? [],
    [catalogos?.carreras],
  )
  const estados = useMemo(() => catalogos?.estados ?? [], [catalogos?.estados])

  const baseScope = useMemo(
    () => resolveAcademicScope(academicScope, facultades, carreras),
    [academicScope, carreras, facultades],
  )
  const scope = useMemo(() => {
    if (academicScope.isGlobal || academicScope.carreraIds.length === 0) {
      return baseScope
    }

    const facultadIds = new Set(
      baseScope.visibleFacultades.map((facultad) => facultad.id),
    )
    if (facultadIds.size === 0) return baseScope

    const visibleCarreras = carreras.filter((carrera) =>
      facultadIds.has(carrera.facultad_id),
    )

    return {
      ...baseScope,
      carreraIds: visibleCarreras.map((carrera) => carrera.id),
      visibleCarreras,
      forcedCarreraId: null,
      canChooseCarrera: visibleCarreras.length > 1,
    }
  }, [
    academicScope.carreraIds.length,
    academicScope.isGlobal,
    baseScope,
    carreras,
  ])

  const selectedFacultad =
    scope.forcedFacultadId ??
    (routeSearch.facultad !== 'todas' ? routeSearch.facultad : 'todas')
  const selectedCarrera =
    scope.forcedCarreraId ??
    (routeSearch.carrera !== 'todas' ? routeSearch.carrera : 'todas')

  const nivelScopedCarreras = useMemo(() => {
    return scope.visibleCarreras.filter((carrera) => {
      const matchesFacultad =
        selectedFacultad === 'todas' || carrera.facultad_id === selectedFacultad
      const matchesCarrera =
        selectedCarrera === 'todas' || carrera.id === selectedCarrera
      return matchesFacultad && matchesCarrera
    })
  }, [scope.visibleCarreras, selectedCarrera, selectedFacultad])

  const accessibleNiveles = useMemo(
    () => Array.from(new Set(nivelScopedCarreras.map((c) => c.nivel))),
    [nivelScopedCarreras],
  )

  const forcedNivel =
    accessibleNiveles.length === 1 ? accessibleNiveles[0] : null
  const selectedNivel =
    forcedNivel ?? (routeSearch.nivel !== 'todos' ? routeSearch.nivel : 'todos')
  const nivelFilter = selectedNivel !== 'todos' ? selectedNivel : undefined

  const {
    data: planesData,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = usePlanesInfinite(
    {
      search: routeSearch.q,
      facultadId: selectedFacultad,
      carreraId: selectedCarrera,
      estadoId: routeSearch.estado,
      nivelFilter,
      tipoEstructura:
        routeSearch.tipo === 'todos' ? undefined : routeSearch.tipo,
      sort: routeSearch.orden,
      catalogMode: true,
    },
    PAGE_SIZE,
  )

  const { data: estadosDisponibles } = usePlanesEstadosDisponibles({
    facultadId: selectedFacultad,
    carreraId: selectedCarrera,
    nivelFilter,
    tipoEstructura: routeSearch.tipo === 'todos' ? undefined : routeSearch.tipo,
    catalogMode: true,
  })

  const visiblePlanes = useMemo(
    () =>
      (planesData?.pages.flatMap((pagina) => pagina.data) ?? []).filter(
        (plan) => {
          const clave = String((plan as any).estados_plan?.clave ?? '')
          return clave.toUpperCase() !== 'FALLIDO'
        },
      ),
    [planesData?.pages],
  )

  const facultadesOptions = useMemo(
    () => [
      {
        value: 'todas',
        label: scope.isGlobal ? 'Todas las facultades' : 'Mis facultades',
      },
      ...scope.visibleFacultades.map((f) => ({
        value: f.id,
        label: formatFacultadNombre(f),
        icon: <FacultadIconPill facultad={f} />,
      })),
    ],
    [scope.isGlobal, scope.visibleFacultades],
  )

  const getCarrerasOptions = (facultadId: string) => {
    const rawCarreras = scope.visibleCarreras
    const filtered =
      facultadId === 'todas'
        ? rawCarreras
        : rawCarreras.filter((c) => c.facultad_id === facultadId)
    const groups = new Map<string, Array<{ value: string; label: string }>>()
    filtered.forEach((c) => {
      const nivel = c.nivel
      const arr = groups.get(nivel) ?? []
      arr.push({ value: c.id, label: c.nombre })
      groups.set(nivel, arr)
    })
    const grouped = Array.from(groups.entries()).map(([nivel, opts]) => ({
      label: nivel,
      options: opts,
    }))
    return [
      {
        value: 'todas',
        label: scope.isGlobal ? 'Todas las carreras' : 'Mis carreras',
      },
      ...grouped,
    ]
  }

  // El desplegable de estado sólo ofrece los estados realmente presentes entre
  // los planes accesibles (ordenados por jerarquía vía `orden` del catálogo),
  // no el catálogo completo. Excluimos FALLIDO (sus planes no se listan) pero
  // conservamos el estado ya seleccionado aunque deje de tener planes.
  const estadosOptions = useMemo(() => {
    const disponibles = new Set(estadosDisponibles ?? [])
    const visibles = estados.filter((e) => {
      if (String(e.clave).toUpperCase() === 'FALLIDO') return false
      if (!estadosDisponibles) return true
      if (e.id === routeSearch.estado) return true
      return disponibles.has(e.id)
    })
    return [
      { value: 'todos', label: 'Todos los estados' },
      ...visibles.map((e) => ({ value: e.id, label: e.etiqueta })),
    ]
  }, [estados, estadosDisponibles, routeSearch.estado])

  const nivelesOptions = useMemo(() => {
    return [
      {
        value: 'todos',
        label: scope.isGlobal ? 'Todos los niveles' : 'Mis niveles',
      },
      ...accessibleNiveles.map((n) => ({ value: n, label: n })),
    ]
  }, [accessibleNiveles, scope.isGlobal])

  const planesFilterValue = {
    facultad: selectedFacultad,
    carrera: selectedCarrera,
    estado: routeSearch.estado,
    nivel: selectedNivel,
    tipo: routeSearch.tipo,
  }
  const planesFilterDefaults = {
    facultad: scope.forcedFacultadId ?? 'todas',
    carrera: scope.forcedCarreraId ?? 'todas',
    estado: 'todos',
    nivel: forcedNivel ?? 'todos',
    tipo: 'todos' as const,
  }
  const planesActiveFilterCount = [
    scope.canChooseFacultad && selectedFacultad !== 'todas',
    scope.canChooseCarrera && selectedCarrera !== 'todas',
    routeSearch.estado !== 'todos',
    !forcedNivel && selectedNivel !== 'todos',
    routeSearch.tipo !== 'todos',
  ].filter(Boolean).length

  const totalPlanes = planesData?.pages[0]?.count ?? 0
  const loadedPlanes =
    planesData?.pages.reduce(
      (total, pagina) => total + pagina.data.length,
      0,
    ) ?? 0
  const hasActiveUserFilters =
    routeSearch.q !== '' ||
    (selectedFacultad !== 'todas' && !scope.forcedFacultadId) ||
    (selectedCarrera !== 'todas' && !scope.forcedCarreraId) ||
    routeSearch.estado !== 'todos' ||
    (selectedNivel !== 'todos' && !forcedNivel) ||
    routeSearch.tipo !== 'todos'
  const hasNoPlanes =
    !isLoading && !isError && totalPlanes === 0 && !hasActiveUserFilters
  const cargarMasPlanes = useCallback(() => {
    void fetchNextPage()
  }, [fetchNextPage])

  useEffect(() => {
    if (!catalogos) return
    // No corregir filtros (ni cerrar el modal) mientras /planes/nuevo está abierto.
    if (isNuevoModalOpen) return

    const nextFacultad = scope.forcedFacultadId ?? routeSearch.facultad
    const nextCarrera = scope.forcedCarreraId ?? routeSearch.carrera
    const nextNivel = forcedNivel ?? routeSearch.nivel
    const carreraIsVisible =
      nextCarrera === 'todas' ||
      scope.visibleCarreras.some((c) => c.id === nextCarrera)
    const facultadIsVisible =
      nextFacultad === 'todas' ||
      scope.visibleFacultades.some((f) => f.id === nextFacultad)
    const nivelIsVisible =
      nextNivel === 'todos' ||
      accessibleNiveles.some((nivel) => nivel === nextNivel)

    if (
      nextFacultad !== routeSearch.facultad ||
      nextCarrera !== routeSearch.carrera ||
      nextNivel !== routeSearch.nivel ||
      !facultadIsVisible ||
      !carreraIsVisible ||
      !nivelIsVisible
    ) {
      navigateFromLista({
        search: (prev) => ({
          ...prev,
          facultad: facultadIsVisible ? nextFacultad : 'todas',
          carrera: carreraIsVisible ? nextCarrera : 'todas',
          nivel: nivelIsVisible ? nextNivel : 'todos',
        }),
        resetScroll: false,
      })
    }
  }, [
    catalogos,
    accessibleNiveles,
    forcedNivel,
    isNuevoModalOpen,
    navigateFromLista,
    routeSearch.carrera,
    routeSearch.facultad,
    routeSearch.nivel,
    scope.forcedCarreraId,
    scope.forcedFacultadId,
    scope.visibleCarreras,
    scope.visibleFacultades,
  ])

  useGSAP(
    () => {
      if (!getOrganicMotion()) return

      const filters = pageRef.current?.querySelectorAll('[data-planes-filter]')
      if (filters?.length) {
        gsap.fromTo(
          filters,
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            stagger: 0.05,
            ease: 'power2.out',
          },
        )
      }
    },
    { scope: pageRef, dependencies: [catalogosLoading, hasNoPlanes] },
  )

  useGSAP(
    () => {
      if (!getOrganicMotion() || isLoading) return

      const cards = gridRef.current?.querySelectorAll('[data-plan-card]')
      if (!cards?.length) return

      gsap.fromTo(
        cards,
        { opacity: 0, y: 20, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.4,
          stagger: 0.06,
          ease: 'back.out(1.2)',
          overwrite: 'auto',
        },
      )
    },
    {
      scope: pageRef,
      dependencies: [
        isLoading,
        routeSearch.facultad,
        routeSearch.carrera,
        routeSearch.estado,
        routeSearch.nivel,
        modoVistaColeccion,
        visiblePlanes.length,
      ],
    },
  )

  if (isError)
    return <div className="p-region text-red-500">Error cargando planes.</div>

  return (
    <main className="relative w-full">
      <PageContainer
        ref={pageRef}
        className="gap-seccion relative flex flex-col"
      >
        <div className="gap-grupo flex flex-col lg:col-span-3">
          {/* Encabezado y acción principal */}
          <div
            data-planes-header
            data-guia="planes-encabezado"
            className="gap-grupo flex flex-col items-stretch justify-between sm:flex-row sm:items-center"
          >
            <div className="max-w-2xl">
              <h1 className="font-display text-foreground mt-micro text-3xl font-bold">
                Planes de estudio
              </h1>
            </div>
            {canCreatePlan && (
              <Button asChild className="w-full sm:w-auto">
                <Link
                  to="/planes/nuevo"
                  search={routeSearch}
                  resetScroll={false}
                  preload="intent"
                  data-guia="planes-crear"
                >
                  <Plus /> Nuevo plan de estudios
                </Link>
              </Button>
            )}
          </div>

          {hasNoPlanes &&
          !catalogosLoading &&
          !scope.isLoading &&
          scope.visibleCarreras.length === 0 ? (
            <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
              <div className="border-warning/30 bg-warning/5 gap-grupo p-region flex w-full max-w-md flex-col rounded-xl border text-center">
                <div className="bg-warning/10 text-warning mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
                  <AlertTriangle className="h-7 w-7" strokeWidth={1.75} />
                </div>
                <div className="gap-relacionado flex flex-col">
                  <h2 className="text-foreground text-lg font-semibold">
                    Sin carreras asignadas
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {canCreatePlan
                      ? 'No tienes carreras configuradas aún. Crea una carrera primero para poder crear planes de estudio.'
                      : 'Tu usuario no tiene ninguna carrera o facultad asignada. Contacta al administrador para configurar tu acceso.'}
                  </p>
                </div>
                {has('catalogos.gestionar') && (
                  <Link
                    to="/administracion/facultades/$tipo/nuevo"
                    params={{ tipo: 'carrera' }}
                  >
                    <Button size="sm" className="mx-auto">
                      <Plus className="h-4 w-4" /> Nueva carrera
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : hasNoPlanes ? (
            <div
              data-planes-empty
              className="pb-exhibicion flex min-h-[calc(100vh-12rem)] items-center justify-center"
            >
              <PlanVacioFolder canCreate={canCreatePlan} search={routeSearch} />
            </div>
          ) : (
            <>
              <div data-guia="planes-busqueda-filtros">
                <ListToolbar
                  search={
                    <div className="relative w-full">
                      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        value={qInput}
                        onChange={(e) => setQInput(e.target.value)}
                        placeholder="Buscar por nombre de plan…"
                        className="pl-pagina"
                        aria-label="Buscar planes"
                      />
                    </div>
                  }
                  actions={
                    <>
                      <ListSortMenu
                        value={routeSearch.orden}
                        defaultValue={defaultPlanesSearch.orden}
                        options={[...PLAN_SORT_OPTIONS]}
                        onValueChange={(orden) =>
                          navigateFromLista({
                            search: (prev) => ({ ...prev, orden }),
                            resetScroll: false,
                          })
                        }
                        label="Ordenar planes"
                      />
                      <ListFiltersDialog
                        title="Filtrar planes de estudio"
                        value={planesFilterValue}
                        defaultValue={planesFilterDefaults}
                        activeCount={planesActiveFilterCount}
                        onApply={(next, { resetAll }) =>
                          navigateFromLista({
                            search: (prev) => ({
                              ...prev,
                              q: resetAll ? '' : prev.q,
                              orden: resetAll
                                ? defaultPlanesSearch.orden
                                : prev.orden,
                              facultad: next.facultad,
                              carrera: next.carrera,
                              estado: next.estado,
                              nivel: next.nivel,
                              tipo: next.tipo,
                            }),
                            resetScroll: false,
                          })
                        }
                        label="Filtrar planes"
                      >
                        {(draft, setDraft) => {
                          const draftCarrerasOptions = getCarrerasOptions(
                            draft.facultad,
                          )

                          return (
                            <>
                              {scope.canChooseFacultad ? (
                                <ListFilterSection title="Facultad">
                                  <Filtro
                                    options={facultadesOptions}
                                    value={draft.facultad}
                                    onChange={(facultad) =>
                                      setDraft((previous) => ({
                                        ...previous,
                                        facultad,
                                        carrera: 'todas',
                                      }))
                                    }
                                    ariaLabel="Filtrar por facultad"
                                    disabled={catalogosLoading}
                                  />
                                </ListFilterSection>
                              ) : null}
                              {scope.canChooseCarrera ? (
                                <ListFilterSection title="Carrera">
                                  <Filtro
                                    options={draftCarrerasOptions}
                                    value={draft.carrera}
                                    onChange={(carrera) =>
                                      setDraft((previous) => ({
                                        ...previous,
                                        carrera,
                                      }))
                                    }
                                    ariaLabel="Filtrar por carrera"
                                    disabled={
                                      catalogosLoading ||
                                      draft.facultad === 'todas' ||
                                      draftCarrerasOptions.length <= 1
                                    }
                                  />
                                </ListFilterSection>
                              ) : null}
                              <ListFilterSection title="Estado">
                                <Filtro
                                  options={estadosOptions}
                                  value={draft.estado}
                                  onChange={(estado) =>
                                    setDraft((previous) => ({
                                      ...previous,
                                      estado,
                                    }))
                                  }
                                  ariaLabel="Filtrar por estado"
                                  disabled={catalogosLoading}
                                />
                              </ListFilterSection>
                              {!forcedNivel && accessibleNiveles.length > 1 ? (
                                <ListFilterSection title="Nivel académico">
                                  <Filtro
                                    options={nivelesOptions}
                                    value={draft.nivel}
                                    onChange={(nivel) =>
                                      setDraft((previous) => ({
                                        ...previous,
                                        nivel,
                                      }))
                                    }
                                    ariaLabel="Filtrar por nivel"
                                    disabled={catalogosLoading}
                                  />
                                </ListFilterSection>
                              ) : null}
                              <ListFilterSection title="Tipo de plan">
                                <Filtro
                                  options={[
                                    {
                                      value: 'todos',
                                      label: 'Todos los tipos',
                                    },
                                    {
                                      value: 'CURRICULAR',
                                      label: 'Curriculares',
                                    },
                                    {
                                      value: 'NO_CURRICULAR',
                                      label: 'No curriculares',
                                    },
                                  ]}
                                  value={draft.tipo}
                                  onChange={(tipo) =>
                                    setDraft((previous) => ({
                                      ...previous,
                                      tipo: tipo as
                                        | 'todos'
                                        | 'CURRICULAR'
                                        | 'NO_CURRICULAR',
                                    }))
                                  }
                                  ariaLabel="Filtrar por tipo de plan"
                                />
                              </ListFilterSection>
                            </>
                          )
                        }}
                      </ListFiltersDialog>
                    </>
                  }
                  view={<SelectorModoVistaColeccion />}
                />
              </div>

              {/* Grid de Resultados */}
              {isLoading ? (
                <PlanCardGridSkeleton modo={modoVistaColeccion} />
              ) : (
                <div ref={gridRef} data-guia="planes-resultados">
                  {visiblePlanes.length === 0 ? (
                    <div className="organic-surface gradient-border text-muted-foreground gap-control px-seccion py-pagina flex flex-col items-center rounded-(--radius) text-center shadow-sm">
                      <BookOpenText className="h-12 w-12 opacity-50" />
                      <p>No se encontraron planes con estos filtros.</p>
                      {canCreatePlan && (
                        <Button asChild className="mt-micro shadow-md">
                          <Link
                            to="/planes/nuevo"
                            search={routeSearch}
                            resetScroll={false}
                            preload="intent"
                          >
                            <Plus className="h-4 w-4" /> Crear el primer plan
                          </Link>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <MasonryGrid
                      modo={modoVistaColeccion}
                      role="list"
                      aria-label="Planes de estudio visibles"
                    >
                      {visiblePlanes.map((plan) => {
                        const facultad = plan.carreras?.facultades
                        const estado = plan.estados_plan
                        const canOpenDetail = plan.puede_abrir_detalle !== false
                        const estadoColorHex = (estado as any)?.color as
                          | string
                          | undefined
                        const clave = String(estado?.clave ?? '').toUpperCase()
                        const esCurricularLista =
                          plan.estructuras_plan?.tipo === 'CURRICULAR'
                        const etiquetaEstadoLista =
                          plan.rol_version_plan === 'ANTECEDENTE'
                            ? 'Antecedente'
                            : !esCurricularLista && clave === 'APROBADO'
                              ? 'Aprobado por Vicerrectoría'
                              : (estado?.etiqueta ?? 'Desconocido')
                        const isGenerando = clave.startsWith('GENERANDO')

                        const card = (
                          <PlanEstudiosCard
                            Icono={(props) => (
                              <DynamicIcon
                                name={facultad?.icono ?? ''}
                                {...props}
                              />
                            )}
                            nombrePrograma={getPlanDisplayName(plan)}
                            prefijo={facultad?.prefijo ?? undefined}
                            ciclos={`${plan.numero_ciclos} ${pluralizarTipoCiclo(plan.tipo_ciclo, plan.numero_ciclos)}`}
                            facultad={facultad?.nombre ?? 'Sin Facultad'}
                            // En un plan curricular el nombre del plan ya es el de
                            // la carrera; sólo aporta cuando no es curricular.
                            carrera={
                              esCurricularLista
                                ? undefined
                                : (plan.carreras?.nombre ?? undefined)
                            }
                            nivel={plan.carreras?.nivel ?? undefined}
                            estado={etiquetaEstadoLista}
                            colorEstadoHex={estadoColorHex}
                            colorFacultad={facultad?.color ?? '#000000'}
                            disabled={isGenerando}
                            interactive={!isGenerando && canOpenDetail}
                          />
                        )

                        const contenido = isGenerando ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                data-plan-card
                                aria-disabled
                                className="flex cursor-not-allowed"
                              >
                                {card}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              El plan se está generando. Espera a que termine
                              para abrirlo.
                            </TooltipContent>
                          </Tooltip>
                        ) : !canOpenDetail ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div data-plan-card className="flex">
                                {card}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              Este plan solo está disponible como listado.
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Link
                            to={'/planes/$planId'}
                            params={{ planId: plan.id }}
                            data-plan-card
                            className="flex"
                          >
                            {card}
                          </Link>
                        )

                        return (
                          <div key={plan.id} role="listitem">
                            {contenido}
                          </div>
                        )
                      })}
                    </MasonryGrid>
                  )}
                </div>
              )}

              {!isLoading && visiblePlanes.length > 0 && (
                <InfiniteScrollSentinel
                  hasNextPage={hasNextPage}
                  isFetching={isFetching}
                  isFetchingNextPage={isFetchingNextPage}
                  onLoadMore={cargarMasPlanes}
                  loaded={loadedPlanes}
                  total={totalPlanes}
                />
              )}
            </>
          )}
        </div>
        <Outlet />
      </PageContainer>
    </main>
  )
}
