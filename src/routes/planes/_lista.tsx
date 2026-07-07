import {
  createFileRoute,
  Link,
  Outlet,
  stripSearchParams,
  useMatchRoute,
  useNavigate,
} from '@tanstack/react-router'
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

// Componentes
import type { PlanesListaSearch } from '@/types/search'

import Filtro from '@/components/planes/Filtro'
import PlanEstudiosCard from '@/components/planes/PlanEstudiosCard'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'
import { PlanCardGridSkeleton } from '@/components/ui/route-pending-skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  catalogosOptions,
  planesEstadosDisponiblesOptions,
  planesListOptions,
} from '@/data'
import {
  resolveAcademicScope,
  useAcademicScope,
} from '@/data/auth/academicScope'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { usePermissions } from '@/data/hooks/usePermissions'
import {
  useCatalogosPlanes,
  usePlanes,
  usePlanesEstadosDisponibles,
} from '@/data/hooks/usePlans'
import { DynamicIcon } from '@/features/planes/utils/icon-utils'
import { AuroraBackground } from '@/features/usuarios/AuroraBackground'
import { getOrganicMotion, gsap, useGSAP } from '@/lib/animations'
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

  const rawPage =
    typeof search.page === 'number' || typeof search.page === 'string'
      ? Number(search.page)
      : defaultPlanesSearch.page

  const page =
    Number.isFinite(rawPage) && rawPage >= 0 ? Math.floor(rawPage) : 0

  return { q, facultad, carrera, estado, nivel, page }
}

const PAGE_SIZE = 12

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
    page: search.page,
  }),
  // Solo precalentamos la caché sin bloquear: la página (encabezado y filtros)
  // se pinta de inmediato; las tarjetas muestran su skeleton mientras cargan.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(catalogosOptions())
    void context.queryClient.prefetchQuery(
      planesEstadosDisponiblesOptions({
        facultadId: deps.facultad,
        carreraId: deps.carrera,
        nivelFilter: deps.nivel,
        catalogMode: true,
      }),
    )
    void context.queryClient.prefetchQuery(
      planesListOptions({
        search: deps.q,
        facultadId: deps.facultad,
        carreraId: deps.carrera,
        estadoId: deps.estado,
        nivelFilter: deps.nivel,
        limit: PAGE_SIZE,
        offset: deps.page * PAGE_SIZE,
        catalogMode: true,
      }),
    )
  },
  component: RouteComponent,
  preload: true,
})

function getPageNumbers(
  current: number,
  total: number,
): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (current <= 3) return [0, 1, 2, 3, 4, 'ellipsis', total - 1]
  if (current >= total - 4)
    return [
      0,
      'ellipsis',
      total - 5,
      total - 4,
      total - 3,
      total - 2,
      total - 1,
    ]
  return [
    0,
    'ellipsis',
    current - 1,
    current,
    current + 1,
    'ellipsis',
    total - 1,
  ]
}

function RouteComponent() {
  const navigateFromLista = useNavigate({ from: Route.fullPath })
  const matchRoute = useMatchRoute()
  // El modal "Nuevo plan" (/planes/nuevo) es una ruta hija de este layout. La
  // corrección de scope de abajo navega al índice de la lista, lo que cerraría
  // ese modal; mientras esté abierto no debemos tocar los filtros.
  const isNuevoModalOpen = Boolean(matchRoute({ to: '/planes/nuevo' }))
  const routeSearch = Route.useSearch()

  // Búsqueda con debounce: el input es local y se vuelca a la URL tras una pausa.
  const [qInput, setQInput] = useState(routeSearch.q)
  useEffect(() => setQInput(routeSearch.q), [routeSearch.q])
  useEffect(() => {
    const trimmed = qInput.trim()
    if (trimmed === routeSearch.q) return
    const id = setTimeout(() => {
      navigateFromLista({
        search: (prev) => ({ ...prev, q: trimmed, page: 0 }),
        resetScroll: false,
      })
    }, 350)
    return () => clearTimeout(id)
  }, [qInput, navigateFromLista, routeSearch.q])

  const pageRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const paginationRef = useRef<HTMLDivElement | null>(null)
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
  } = usePlanes({
    search: routeSearch.q,
    facultadId: selectedFacultad,
    carreraId: selectedCarrera,
    estadoId: routeSearch.estado,
    nivelFilter,
    limit: PAGE_SIZE,
    offset: routeSearch.page * PAGE_SIZE,
    catalogMode: true,
  })

  const { data: estadosDisponibles } = usePlanesEstadosDisponibles({
    facultadId: selectedFacultad,
    carreraId: selectedCarrera,
    nivelFilter,
    catalogMode: true,
  })

  const visiblePlanes = useMemo(
    () =>
      (planesData?.data ?? []).filter((plan) => {
        const clave = String((plan as any).estados_plan?.clave ?? '')
        return clave.toUpperCase() !== 'FALLIDO'
      }),
    [planesData?.data],
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

  const carrerasOptions = useMemo(() => {
    const rawCarreras = scope.visibleCarreras
    const filtered =
      selectedFacultad === 'todas'
        ? rawCarreras
        : rawCarreras.filter((c) => c.facultad_id === selectedFacultad)
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
  }, [scope.isGlobal, scope.visibleCarreras, selectedFacultad])

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

  const isClearDisabled =
    routeSearch.q === '' &&
    selectedFacultad === 'todas' &&
    selectedCarrera === 'todas' &&
    routeSearch.estado === 'todos' &&
    selectedNivel === 'todos'

  const totalPages = Math.ceil((planesData?.count ?? 0) / PAGE_SIZE)
  const currentPage = routeSearch.page
  const hasActiveUserFilters =
    routeSearch.q !== '' ||
    (selectedFacultad !== 'todas' && !scope.forcedFacultadId) ||
    (selectedCarrera !== 'todas' && !scope.forcedCarreraId) ||
    routeSearch.estado !== 'todos' ||
    (selectedNivel !== 'todos' && !forcedNivel)
  const hasNoPlanes =
    !isLoading &&
    !isError &&
    (planesData?.count ?? 0) === 0 &&
    !hasActiveUserFilters
  const pageNumbers = getPageNumbers(currentPage, totalPages)
  const summaryStats = useMemo(() => {
    const carrerasEnPagina = new Set(
      visiblePlanes.map((plan) => plan.carrera_id).filter(Boolean),
    )
    const facultadesEnPagina = new Set(
      visiblePlanes
        .map((plan) => plan.carreras?.facultades?.id)
        .filter(Boolean),
    )

    return [
      {
        label: 'planes',
        value: planesData?.count ?? 0,
      },
      {
        label: 'carreras',
        value: carrerasEnPagina.size,
      },
      {
        label: 'facultades',
        value: facultadesEnPagina.size,
      },
    ]
  }, [planesData?.count, visiblePlanes])

  const goToPage = (page: number) =>
    navigateFromLista({
      search: (prev) => ({ ...prev, page }),
      resetScroll: false,
    })

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
          page: 0,
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

      gsap.fromTo(
        '[data-planes-header]',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
      )

      gsap.fromTo(
        '[data-planes-filter]',
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
          stagger: 0.05,
          ease: 'power2.out',
        },
      )

      gsap.fromTo(
        '[data-planes-empty]',
        { opacity: 0, y: 16, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.55,
          ease: 'back.out(1.2)',
        },
      )
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
        routeSearch.page,
        visiblePlanes.length,
      ],
    },
  )

  useGSAP(
    () => {
      if (!getOrganicMotion() || totalPages <= 1) return

      gsap.fromTo(
        paginationRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, delay: 0.15, ease: 'power2.out' },
      )
    },
    { scope: pageRef, dependencies: [currentPage, totalPages] },
  )

  if (isError)
    return <div className="p-8 text-red-500">Error cargando planes.</div>

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <AuroraBackground />
      <div
        ref={pageRef}
        className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8"
      >
        <div className="flex flex-col gap-4 lg:col-span-3">
          {/* Header y Botón Nuevo */}
          {!hasNoPlanes && (
            <div
              data-planes-header
              className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
                  <BookOpenText className="h-5 w-5" strokeWidth={2} />
                </div>
                <div>
                  <h1 className="font-display text-foreground text-2xl font-bold">
                    Planes de Estudio
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Gestiona los planes curriculares de tu institución
                  </p>
                </div>
              </div>
              {canCreatePlan && (
                <Button
                  onClick={() => {
                    navigateFromLista({
                      to: '/planes/nuevo',
                      search: (prev) => prev,
                      resetScroll: false,
                    })
                  }}
                  className="w-full shadow-md sm:w-auto"
                >
                  <Plus /> Nuevo plan de estudios
                </Button>
              )}
            </div>
          )}

          {hasNoPlanes ? (
            <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
              <div
                data-planes-empty
                className="organic-surface gradient-border organic-glow relative w-full max-w-lg rounded-[calc(var(--radius)+0.5rem)] px-8 py-12 text-center sm:px-12 sm:py-16"
              >
                <span className="breathing-aura" aria-hidden />

                {/* Emblema con anillos concéntricos */}
                <div className="relative mx-auto mb-7 flex h-20 w-20 items-center justify-center">
                  <span className="border-primary/15 absolute inset-0 rounded-full border" />
                  <span className="border-primary/10 absolute -inset-3 rounded-full border" />
                  <span className="border-primary/6 absolute -inset-6 rounded-full border" />
                  <div className="bg-primary/10 text-primary ring-primary/20 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm ring-1">
                    <BookOpenText className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                </div>

                <span className="organic-chip mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5" />
                  Comienza aquí
                </span>

                <h1 className="font-display text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                  Aún no hay planes de estudio
                </h1>
                <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm leading-relaxed sm:text-base">
                  Crea tu primer plan curricular para organizar asignaturas,
                  bibliografía y toda la estructura académica de tu institución.
                </p>

                {canCreatePlan && (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => {
                      navigateFromLista({
                        to: '/planes/nuevo',
                        search: (prev) => prev,
                        resetScroll: false,
                      })
                    }}
                    className="mt-8 shadow-md"
                  >
                    <Plus className="h-4 w-4" /> Crear el primer plan
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Búsqueda por nombre de plan */}
              <div data-planes-filter className="relative w-full sm:max-w-md">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Buscar por nombre de plan…"
                  className="pl-9"
                  aria-label="Buscar planes"
                />
              </div>

              {/* Barra de Filtros */}
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {scope.canChooseFacultad && (
                  <div data-planes-filter className="w-full lg:w-44">
                    <Filtro
                      options={facultadesOptions}
                      value={selectedFacultad}
                      onChange={(v) => {
                        navigateFromLista({
                          search: (prev) => ({
                            ...prev,
                            facultad: v,
                            carrera: 'todas',
                            page: 0,
                          }),
                          resetScroll: false,
                        })
                      }}
                      placeholder="Facultad"
                      ariaLabel="Filtrar por facultad"
                      active={selectedFacultad !== 'todas'}
                      disabled={catalogosLoading}
                    />
                  </div>
                )}
                {scope.canChooseCarrera && (
                  <div data-planes-filter className="w-full lg:w-44">
                    <Filtro
                      options={carrerasOptions}
                      value={selectedCarrera}
                      onChange={(v) => {
                        navigateFromLista({
                          search: (prev) => ({ ...prev, carrera: v, page: 0 }),
                          resetScroll: false,
                        })
                      }}
                      placeholder="Carrera"
                      ariaLabel="Filtrar por carrera"
                      active={selectedCarrera !== 'todas'}
                      disabled={
                        catalogosLoading ||
                        selectedFacultad === 'todas' ||
                        carrerasOptions.length <= 1
                      }
                    />
                  </div>
                )}
                <div data-planes-filter className="w-full lg:w-44">
                  <Filtro
                    options={estadosOptions}
                    value={routeSearch.estado}
                    onChange={(v) => {
                      navigateFromLista({
                        search: (prev) => ({ ...prev, estado: v, page: 0 }),
                        resetScroll: false,
                      })
                    }}
                    placeholder="Estado"
                    ariaLabel="Filtrar por estado"
                    active={routeSearch.estado !== 'todos'}
                    disabled={catalogosLoading}
                  />
                </div>
                {!forcedNivel && accessibleNiveles.length > 1 && (
                  <div data-planes-filter className="w-full lg:w-44">
                    <Filtro
                      options={nivelesOptions}
                      value={selectedNivel}
                      onChange={(v) => {
                        navigateFromLista({
                          search: (prev) => ({ ...prev, nivel: v, page: 0 }),
                          resetScroll: false,
                        })
                      }}
                      placeholder="Nivel"
                      ariaLabel="Filtrar por nivel"
                      active={selectedNivel !== 'todos'}
                      disabled={catalogosLoading}
                    />
                  </div>
                )}
                {!isClearDisabled && (
                  <Button
                    data-planes-filter
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      navigateFromLista({
                        search: () => ({
                          ...defaultPlanesSearch,
                          facultad: scope.forcedFacultadId ?? 'todas',
                          carrera: scope.forcedCarreraId ?? 'todas',
                          nivel: forcedNivel ?? 'todos',
                        }),
                        resetScroll: false,
                      })
                    }
                    disabled={catalogosLoading}
                    className="shadow-md"
                  >
                    <X className="h-4 w-4" /> Limpiar
                  </Button>
                )}
              </div>

              {!isLoading && (
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                  {summaryStats.map((stat) => (
                    <span
                      key={stat.label}
                      className="organic-chip rounded-full border px-3 py-1 text-xs font-semibold"
                    >
                      {stat.value} {stat.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Grid de Resultados */}
              {isLoading ? (
                <PlanCardGridSkeleton />
              ) : (
                <div
                  ref={gridRef}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
                      !esCurricularLista && clave === 'APROBADO'
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
                        ciclos={`${plan.numero_ciclos} ${plan.tipo_ciclo.toLowerCase()}s`}
                        facultad={facultad?.nombre ?? 'Sin Facultad'}
                        estado={etiquetaEstadoLista}
                        colorEstadoHex={estadoColorHex}
                        claseColorEstado={!estadoColorHex ? 'bg-secondary' : ''}
                        colorFacultad={facultad?.color ?? '#000000'}
                        disabled={isGenerando}
                        interactive={!isGenerando && canOpenDetail}
                      />
                    )

                    if (isGenerando) {
                      return (
                        <Tooltip key={plan.id}>
                          <TooltipTrigger asChild>
                            <div
                              data-plan-card
                              aria-disabled
                              className="h-full cursor-not-allowed"
                            >
                              {card}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            El plan se está generando. Espera a que termine para
                            abrirlo.
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    if (!canOpenDetail) {
                      return (
                        <Tooltip key={plan.id}>
                          <TooltipTrigger asChild>
                            <div data-plan-card className="h-full">
                              {card}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            Este plan solo está disponible como listado.
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    return (
                      <Link
                        to="/planes/$planId"
                        params={{ planId: plan.id }}
                        key={plan.id}
                        data-plan-card
                        className="block h-full"
                      >
                        {card}
                      </Link>
                    )
                  })}

                  {visiblePlanes.length === 0 && (
                    <div className="organic-surface gradient-border text-muted-foreground col-span-full flex flex-col items-center gap-3 rounded-[var(--radius)] px-6 py-12 text-center shadow-sm">
                      <BookOpenText className="h-12 w-12 opacity-50" />
                      <p>No se encontraron planes con estos filtros.</p>
                      {canCreatePlan && (
                        <Button
                          type="button"
                          onClick={() => {
                            navigateFromLista({
                              to: '/planes/nuevo',
                              search: (prev) => prev,
                              resetScroll: false,
                            })
                          }}
                          className="mt-1 shadow-md"
                        >
                          <Plus className="h-4 w-4" /> Crear el primer plan
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Paginador */}
              {totalPages > 1 && (
                <Pagination ref={paginationRef}>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationLink
                        onClick={() => goToPage(currentPage - 1)}
                        aria-disabled={currentPage === 0}
                        className={
                          currentPage === 0
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                        size="default"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:block">Anterior</span>
                      </PaginationLink>
                    </PaginationItem>

                    {pageNumbers.map((p, i) =>
                      p === 'ellipsis' ? (
                        <PaginationItem key={`e-${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={p === currentPage}
                            onClick={() => goToPage(p)}
                            className="cursor-pointer"
                          >
                            {p + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}

                    <PaginationItem>
                      <PaginationLink
                        onClick={() => goToPage(currentPage + 1)}
                        aria-disabled={currentPage === totalPages - 1}
                        className={
                          currentPage === totalPages - 1
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                        size="default"
                      >
                        <span className="hidden sm:block">Siguiente</span>
                        <ChevronRight className="h-4 w-4" />
                      </PaginationLink>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </div>
        <Outlet />
      </div>
    </main>
  )
}
