import {
  createFileRoute,
  Link,
  Outlet,
  stripSearchParams,
  useLoaderData,
  useNavigate,
} from '@tanstack/react-router'
import * as Icons from 'lucide-react'
import { useMemo } from 'react'

// Componentes
import type { PlanesListaSearch } from '@/types/search'

import BarraBusqueda from '@/components/planes/BarraBusqueda'
import Filtro from '@/components/planes/Filtro'
import PlanEstudiosCard from '@/components/planes/PlanEstudiosCard'
// Hooks y Utils (ajusta las rutas de importación)
import { Button } from '@/components/ui/button'
import { getCatalogos, qk } from '@/data'
import { usePlanes } from '@/data/hooks/usePlans'
import { getIconByName } from '@/features/planes/utils/icon-utils'
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

  const rawPage =
    typeof search.page === 'number' || typeof search.page === 'string'
      ? Number(search.page)
      : defaultPlanesSearch.page

  const page =
    Number.isFinite(rawPage) && rawPage >= 0 ? Math.floor(rawPage) : 0

  return {
    q,
    facultad,
    carrera,
    estado,
    page,
  }
}

export const Route = createFileRoute('/planes/_lista')({
  validateSearch: parsePlanesSearch,
  search: {
    middlewares: [stripSearchParams(defaultPlanesSearch)],
  },
  component: RouteComponent,
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData({
      queryKey: qk.estructurasPlan(),
      queryFn: getCatalogos,
      staleTime: 1000 * 60 * 60, // 1 hora de caché (estos datos casi no cambian)
    })
  },
  preload: true, // Opcional: precarga esta ruta para mejorar la UX al navegar desde otras partes de la app
})

function RouteComponent() {
  const navigateFromLista = useNavigate({ from: Route.fullPath })
  const routeSearch = Route.useSearch()

  // 1. Estados de Filtros (driven por URL search params)
  const pageSize = 12

  // 2. Carga de datos remotos
  const catalogos = useLoaderData({ from: '/planes/_lista' })

  // Limpiamos el texto de búsqueda (quitar acentos) para enviarlo limpio a la API
  // O lo puedes limpiar en el servicio. Aquí lo enviamos tal cual viene del debounce.
  // Nota: Si usaste la solución "unaccent" en BD, envía el texto tal cual, postgres lo maneja.
  const cleanSearchTerm = routeSearch.q.trim()

  const {
    data: planesData,
    isLoading,
    isError,
  } = usePlanes({
    search: cleanSearchTerm,
    facultadId: routeSearch.facultad,
    carreraId: routeSearch.carrera,
    estadoId: routeSearch.estado,
    limit: pageSize,
    offset: routeSearch.page * pageSize,
  })

  // 3. Preparación de Opciones para Selects (Derived State)
  const facultadesOptions = useMemo(
    () => [
      { value: 'todas', label: 'Todas las facultades' },
      ...catalogos.facultades.map((f) => ({
        value: f.id,
        label: f.nombre,
      })),
    ],
    [catalogos.facultades],
  )

  const carrerasOptions = useMemo(() => {
    // Filtramos las carreras del catálogo base según la facultad seleccionada
    const rawCarreras = catalogos.carreras
    const filtered =
      routeSearch.facultad === 'todas'
        ? rawCarreras
        : rawCarreras.filter((c) => c.facultad_id === routeSearch.facultad)
    // Agrupamos por `nivel` para mostrar secciones en el selector
    const groups = new Map<string, Array<{ value: string; label: string }>>()
    filtered.forEach((c) => {
      const nivel = c.nivel ?? 'Sin nivel'
      const arr = groups.get(nivel) ?? []
      arr.push({ value: c.id, label: c.nombre })
      groups.set(nivel, arr)
    })

    const grouped = Array.from(groups.entries()).map(([nivel, opts]) => ({
      label: nivel,
      options: opts,
    }))

    return [{ value: 'todas', label: 'Todas las carreras' }, ...grouped]
  }, [catalogos.carreras, routeSearch.facultad])

  const estadosOptions = useMemo(
    () => [
      { value: 'todos', label: 'Todos los estados' },
      ...catalogos.estados.map((e) => ({ value: e.id, label: e.etiqueta })),
    ],
    [catalogos.estados],
  )

  // 4. Handlers
  const resetFilters = () => {
    navigateFromLista({
      search: () => defaultPlanesSearch,
      resetScroll: false,
    })
  }

  const handleSearchChange = (val: string) => {
    navigateFromLista({
      search: (prev) => ({ ...prev, q: val, page: 0 }),
      replace: true,
      resetScroll: false,
    })
  }

  // Deshabilitar el botón 'Limpiar' si no hay filtros distintos al valor por defecto
  const isClearDisabled =
    routeSearch.q === '' &&
    routeSearch.facultad === 'todas' &&
    routeSearch.carrera === 'todas' &&
    routeSearch.estado === 'todos'

  // Renderizado condicional básico
  if (isError)
    return <div className="p-8 text-red-500">Error cargando planes.</div>

  return (
    <main className="bg-background min-h-screen w-full">
      <div className="mx-auto flex w-full flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:col-span-3">
          {/* Header y Botón Nuevo */}
          <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
                <Icons.BookOpenText className="h-5 w-5" strokeWidth={2} />
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
            <Button
              onClick={() => {
                console.log('planId')

                navigateFromLista({
                  to: '/planes/nuevo',
                  search: (prev) => prev,
                  resetScroll: false,
                })
              }}
              className="shadow-md"
            >
              <Icons.Plus /> Nuevo plan de estudios
            </Button>
          </div>

          {/* Barra de Filtros */}
          <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <BarraBusqueda
                value={routeSearch.q}
                onChange={handleSearchChange}
                placeholder="Buscar por programa..."
              />
            </div>
            <div className="flex flex-col items-stretch justify-between gap-2 lg:flex-row lg:items-center">
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
                  disabled={routeSearch.facultad === 'todas'}
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
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={resetFilters}
                disabled={isClearDisabled}
                className={`shadow-md`}
              >
                <Icons.X className="h-4 w-4" /> Limpiar
              </Button>
            </div>
          </div>

          {/* Grid de Resultados */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {/* Skeleton básico o Spinner */}
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-64 w-full animate-pulse rounded-xl bg-gray-100/50"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {planesData?.data
                .filter((plan) => {
                  const clave = String((plan as any).estados_plan?.clave ?? '')
                  return clave.toUpperCase() !== 'FALLIDO'
                })
                .map((plan) => {
                  // Mapeo de datos: DB -> Props Componente
                  const facultad = plan.carreras?.facultades
                  const estado = plan.estados_plan

                  // NOTA: El color del estado no viene en BD por defecto,
                  // puedes crear un mapa de colores o agregar columna 'color' a tabla 'estados_plan'
                  // Aquí uso un fallback simple.
                  const estadoColorHex = (estado as any)?.color as
                    | string
                    | undefined

                  return (
                    <Link
                      to="/planes/$planId"
                      params={{ planId: plan.id }}
                      key={plan.id}
                    >
                      <PlanEstudiosCard
                        Icono={getIconByName(facultad?.icono ?? null)}
                        nombrePrograma={plan.nombre}
                        nivel={plan.carreras?.nivel ?? ''}
                        ciclos={`${plan.numero_ciclos} ${plan.tipo_ciclo.toLowerCase()}s`}
                        facultad={facultad?.nombre ?? 'Sin Facultad'}
                        estado={estado?.etiqueta ?? 'Desconocido'}
                        colorEstadoHex={estadoColorHex}
                        claseColorEstado={!estadoColorHex ? 'bg-secondary' : ''}
                        colorFacultad={facultad?.color ?? '#000000'}
                      />
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
        </div>
        <Outlet />
      </div>
    </main>
  )
}
