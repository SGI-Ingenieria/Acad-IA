import {
  createFileRoute,
  Link,
  Outlet,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { BookOpenText, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { useMemo } from 'react'

// Componentes
import type { PlanesListaSearch } from '@/types/search'

import Filtro from '@/components/planes/Filtro'
import PlanEstudiosCard from '@/components/planes/PlanEstudiosCard'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'
import { PlanCardGridSkeleton } from '@/components/ui/route-pending-skeleton'
import { catalogosOptions, planesListOptions } from '@/data'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { useCatalogosPlanes, usePlanes } from '@/data/hooks/usePlans'
import { usePermissions } from '@/data/hooks/usePermissions'
import { DynamicIcon } from '@/features/planes/utils/icon-utils'
import { formatFacultadNombre } from '@/lib/facultad-utils'
import { defaultPlanesSearch } from '@/types/search'

const parsePlanesSearch = (
  search: Record<string, unknown>,
): PlanesListaSearch => {
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

  return { facultad, carrera, estado, nivel, page }
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
      planesListOptions({
        facultadId: deps.facultad,
        carreraId: deps.carrera,
        estadoId: deps.estado,
        nivelFilter: deps.nivel,
        limit: PAGE_SIZE,
        offset: deps.page * PAGE_SIZE,
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
  const routeSearch = Route.useSearch()
  const { has } = usePermissions()
  const canCreatePlan = has('planes.crear')

  const { data: catalogos, isLoading: catalogosLoading } = useCatalogosPlanes()
  const facultades = catalogos?.facultades ?? []
  const carreras = catalogos?.carreras ?? []
  const estados = catalogos?.estados ?? []

  const nivelFilter =
    routeSearch.nivel !== 'todos' ? routeSearch.nivel : undefined

  const {
    data: planesData,
    isLoading,
    isError,
  } = usePlanes({
    facultadId: routeSearch.facultad,
    carreraId: routeSearch.carrera,
    estadoId: routeSearch.estado,
    nivelFilter,
    limit: PAGE_SIZE,
    offset: routeSearch.page * PAGE_SIZE,
  })

  const facultadesOptions = useMemo(
    () => [
      { value: 'todas', label: 'Todas las facultades' },
      ...facultades.map((f) => ({
        value: f.id,
        label: formatFacultadNombre(f),
      })),
    ],
    [facultades],
  )

  const carrerasOptions = useMemo(() => {
    const rawCarreras = carreras
    const filtered =
      routeSearch.facultad === 'todas'
        ? rawCarreras
        : rawCarreras.filter((c) => c.facultad_id === routeSearch.facultad)
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
    return [{ value: 'todas', label: 'Todas las carreras' }, ...grouped]
  }, [carreras, routeSearch.facultad])

  const estadosOptions = useMemo(
    () => [
      { value: 'todos', label: 'Todos los estados' },
      ...estados.map((e) => ({ value: e.id, label: e.etiqueta })),
    ],
    [estados],
  )

  const nivelesOptions = useMemo(() => {
    const set = new Set<string>()
    carreras.forEach((c) => {
      set.add(c.nivel)
    })
    return [
      { value: 'todos', label: 'Todos los niveles' },
      ...Array.from(set).map((n) => ({ value: n, label: n })),
    ]
  }, [carreras])

  const isClearDisabled =
    routeSearch.facultad === 'todas' &&
    routeSearch.carrera === 'todas' &&
    routeSearch.estado === 'todos' &&
    routeSearch.nivel === 'todos'

  const totalPages = Math.ceil((planesData?.count ?? 0) / PAGE_SIZE)
  const currentPage = routeSearch.page
  const pageNumbers = getPageNumbers(currentPage, totalPages)

  const goToPage = (page: number) =>
    navigateFromLista({
      search: (prev) => ({ ...prev, page }),
      resetScroll: false,
    })

  if (isError)
    return <div className="p-8 text-red-500">Error cargando planes.</div>

  return (
    <main className="bg-background min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-4 lg:col-span-3">
          {/* Header y Botón Nuevo */}
          <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
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
                className="shadow-md"
              >
                <Plus /> Nuevo plan de estudios
              </Button>
            )}
          </div>

          {/* Barra de Filtros */}
          <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
            <div className="w-full lg:w-44">
              <Filtro
                options={facultadesOptions}
                value={routeSearch.facultad}
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
                disabled={catalogosLoading}
              />
            </div>
            <div className="w-full lg:w-44">
              <Filtro
                options={carrerasOptions}
                value={routeSearch.carrera}
                onChange={(v) => {
                  navigateFromLista({
                    search: (prev) => ({ ...prev, carrera: v, page: 0 }),
                    resetScroll: false,
                  })
                }}
                placeholder="Carrera"
                disabled={
                  catalogosLoading ||
                  routeSearch.facultad === 'todas' ||
                  carrerasOptions.length <= 1
                }
              />
            </div>
            <div className="w-full lg:w-44">
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
                disabled={catalogosLoading}
              />
            </div>
            <div className="w-full lg:w-44">
              <Filtro
                options={nivelesOptions}
                value={routeSearch.nivel}
                onChange={(v) => {
                  navigateFromLista({
                    search: (prev) => ({ ...prev, nivel: v, page: 0 }),
                    resetScroll: false,
                  })
                }}
                placeholder="Nivel"
                disabled={catalogosLoading}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                navigateFromLista({
                  search: () => defaultPlanesSearch,
                  resetScroll: false,
                })
              }
              disabled={catalogosLoading || isClearDisabled}
              className="shadow-md"
            >
              <X className="h-4 w-4" /> Limpiar
            </Button>
          </div>

          {/* Grid de Resultados */}
          {isLoading ? (
            <PlanCardGridSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {planesData?.data
                .filter((plan) => {
                  const clave = String((plan as any).estados_plan?.clave ?? '')
                  return clave.toUpperCase() !== 'FALLIDO'
                })
                .map((plan) => {
                  const facultad = plan.carreras?.facultades
                  const estado = plan.estados_plan
                  const estadoColorHex = (estado as any)?.color as
                    | string
                    | undefined
                  const clave = String(estado?.clave ?? '').toUpperCase()
                  const isGenerando = clave.startsWith('GENERANDO')

                  const card = (
                    <PlanEstudiosCard
                      Icono={(props) => (
                        <DynamicIcon name={facultad?.icono ?? ''} {...props} />
                      )}
                      nombrePrograma={plan.nombre}
                      prefijo={facultad?.prefijo ?? undefined}
                      nivel={plan.carreras?.nivel ?? ''}
                      ciclos={`${plan.numero_ciclos} ${plan.tipo_ciclo.toLowerCase()}s`}
                      facultad={facultad?.nombre ?? 'Sin Facultad'}
                      estado={estado?.etiqueta ?? 'Desconocido'}
                      colorEstadoHex={estadoColorHex}
                      claseColorEstado={!estadoColorHex ? 'bg-secondary' : ''}
                      colorFacultad={facultad?.color ?? '#000000'}
                    />
                  )

                  if (isGenerando) {
                    return (
                      <div
                        key={plan.id}
                        aria-disabled
                        title="El plan se está generando. Espera a que termine para abrirlo."
                        className="cursor-not-allowed opacity-70"
                      >
                        {card}
                      </div>
                    )
                  }

                  return (
                    <Link
                      to="/planes/$planId"
                      params={{ planId: plan.id }}
                      key={plan.id}
                    >
                      {card}
                    </Link>
                  )
                })}

              {planesData?.data.length === 0 && (
                <div className="text-muted-foreground col-span-full py-10 text-center">
                  No se encontraron planes con estos filtros.
                </div>
              )}
            </div>
          )}

          {/* Paginador */}
          {totalPages > 1 && (
            <Pagination>
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
        </div>
        <Outlet />
      </div>
    </main>
  )
}
