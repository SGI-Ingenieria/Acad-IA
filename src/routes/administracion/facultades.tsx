import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import {
  Building2,
  CircleOff,
  Search,
  School2,
  MoreVertical,
  BookOpen,
  Archive,
  PencilLine,
  Plus,
  Lightbulb,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ListSortMenu, ListToolbar } from '@/components/ui/list-controls'
import { ListRowsSkeleton } from '@/components/ui/route-pending-skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { facultades_list, qk } from '@/data'
import {
  canCreateCatalogCarrera,
  canManageCatalogCarrera,
  canManageCatalogFacultad,
  canManageCatalogos,
} from '@/data/auth/catalogManagement'
import { useCarreras, useFacultades } from '@/data/hooks/useMeta'
import { usePermissions } from '@/data/hooks/usePermissions'
import LineasSugeridasModal from '@/features/facultades/LineasSugeridasModal'
import { DynamicIcon } from '@/features/planes/utils/icon-utils'
import { formatFacultadNombre } from '@/lib/facultad-utils'

function useCarreraHasPlanes(carreraId: string) {
  return useQuery({
    queryKey: qk.carreraTienePlanes(carreraId),
    queryFn: async () => {
      const { supabaseBrowser } = await import('@/data/supabase/client')
      const supabase = supabaseBrowser()
      const { data, error } = await (supabase.rpc as any)(
        'planes_catalogo_buscar',
        {
          p_carrera_id: carreraId,
          p_limit: 1,
          p_offset: 0,
        },
      )
      if (error) return false
      return (data ?? []).length > 0
    },
    staleTime: 1000 * 60 * 5,
  })
}

type FacultadCatalogo = Awaited<ReturnType<typeof facultades_list>>[number]
type CarreraCatalogo = NonNullable<
  ReturnType<typeof useCarreras>['data']
>[number] & {
  nivel?: string | null
  facultades?: FacultadCatalogo | null
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const NIVEL_ORDEN = [
  'Licenciatura',
  'Maestría',
  'Especialidad',
  'Doctorado',
  'Otro',
]

const getNivelEtiqueta = (nivel?: string | null) => {
  const normalized = String(nivel ?? '').trim()
  return normalized || 'Otro'
}

type FacultadesSearch = {
  q?: string
  facultad?: string
  orden?: 'academico' | 'nombre_asc' | 'nombre_desc' | 'carreras_desc'
}

interface CarrerasPorFacultadAccumulador extends Map<string, number> {}

function CarreraCardContent({
  carrera,
  canManageCatalogosGlobal,
  canManageCarrera,
}: {
  carrera: CarreraCatalogo
  canManageCatalogosGlobal: boolean
  canManageCarrera: boolean
}) {
  const clave = carrera.clave_sep ?? 'Sin clave SEP'
  const { data: hasPlans } = useCarreraHasPlanes(carrera.id)
  const canArchiveCarrera = canManageCatalogosGlobal
  const showMenu = canManageCarrera || canArchiveCarrera || hasPlans === true

  return (
    <div className="flex min-w-0 flex-col items-end gap-3 lg:flex-row lg:items-center lg:gap-10">
      <div className="flex flex-col items-end gap-1 lg:items-end">
        <span className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">
          Clave SEP
        </span>

        <Badge
          variant="secondary"
          className="max-w-full rounded-full px-3 py-1 text-xs font-semibold tabular-nums"
        >
          <span className="break-all">{clave}</span>
        </Badge>
      </div>

      {!showMenu ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className="text-muted-foreground hover:bg-muted/50 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full">
              <MoreVertical className="h-4 w-4" />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManageCarrera && (
              <DropdownMenuItem asChild>
                <Link
                  to="/administracion/facultades/$tipo/$entityId/editar"
                  params={{ tipo: 'carrera', entityId: carrera.id }}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <PencilLine className="h-4 w-4" />
                  Editar carrera
                </Link>
              </DropdownMenuItem>
            )}

            {canArchiveCarrera &&
              (carrera.activa === false ? (
                <DropdownMenuItem disabled>
                  <Archive className="h-4 w-4" />
                  Carrera archivada
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link
                    to="/administracion/facultades/$tipo/$entityId/archivar"
                    params={{ tipo: 'carrera', entityId: carrera.id }}
                    className="text-destructive flex cursor-pointer items-center gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    Archivar carrera
                  </Link>
                </DropdownMenuItem>
              ))}

            {(canManageCarrera || canArchiveCarrera) && hasPlans === true && (
              <DropdownMenuSeparator />
            )}

            <DropdownMenuItem
              asChild
              disabled={hasPlans === false}
              title={
                !hasPlans
                  ? 'Esta carrera no tiene planes de estudio'
                  : undefined
              }
            >
              {hasPlans === false ? (
                <div className="flex cursor-not-allowed items-center gap-2 opacity-50">
                  <BookOpen className="h-4 w-4" />
                  Sin planes de estudio
                </div>
              ) : (
                <Link
                  to="/planes"
                  search={{
                    q: '',
                    facultad: carrera.facultad_id,
                    carrera: carrera.id,
                    estado: 'todos',
                    nivel: 'todos',
                    tipo: 'todos',
                    orden: 'creado_desc',
                    page: 0,
                  }}
                  preload="intent"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Ver planes
                </Link>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export const Route = createFileRoute('/administracion/facultades')({
  validateSearch: (search: Record<string, unknown>): FacultadesSearch => {
    return {
      q: typeof search.q === 'string' ? search.q : '',
      facultad: typeof search.facultad === 'string' ? search.facultad : '',
      orden:
        search.orden === 'nombre_asc' ||
        search.orden === 'nombre_desc' ||
        search.orden === 'carreras_desc'
          ? search.orden
          : 'academico',
    }
  },

  // No bloqueante: el shell (hero + buscador) se pinta de inmediato y las
  // listas muestran su skeleton mientras los datos llegan.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({
      queryKey: qk.facultades(),
      queryFn: facultades_list,
      staleTime: 1000 * 60 * 60,
    })
  },

  component: RouteComponent,
})
function RouteComponent() {
  const permissions = usePermissions()
  const { data: facultades = [], isLoading: facultadesLoading } =
    useFacultades()
  const { data: carreras = [], isLoading: carrerasLoading } = useCarreras()
  const catalogoLoading = facultadesLoading || carrerasLoading
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const canManageCatalogosGlobal = canManageCatalogos(permissions)
  const [lineasModalFacultad, setLineasModalFacultad] = useState<{
    id: string
    nombre: string
  } | null>(null)

  const searchTerm = search.q ?? ''

  const updateSearchTerm = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        q: value || undefined,
      }),
      resetScroll: false,
    })
  }

  const updateFacultad = (facultadId: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        facultad: facultadId || undefined,
      }),
      resetScroll: false,
    })
  }

  const facultadSeleccionada = search.facultad || facultades[0]?.id || ''
  const carrerasPorFacultad = useMemo(() => {
    return carreras.reduce<CarrerasPorFacultadAccumulador>(
      (acc: CarrerasPorFacultadAccumulador, carrera: CarreraCatalogo) => {
        const key = carrera.facultad_id
        acc.set(key, (acc.get(key) ?? 0) + 1)
        return acc
      },
      new Map(),
    )
  }, [carreras])

  const facultadActiva =
    facultades.find((item) => item.id === facultadSeleccionada) ?? null

  const filteredFacultades = useMemo(() => {
    const term = normalizeText(searchTerm.trim())

    return facultades
      .filter((facultad) => {
        if (!term) return true
        const haystack = normalizeText(
          [facultad.nombre, facultad.nombre_corto].filter(Boolean).join(' '),
        )
        return haystack.includes(term)
      })
      .sort((left, right) => {
        if (search.orden === 'carreras_desc') {
          return (
            (carrerasPorFacultad.get(right.id) ?? 0) -
            (carrerasPorFacultad.get(left.id) ?? 0)
          )
        }
        return search.orden === 'nombre_desc'
          ? right.nombre.localeCompare(left.nombre, 'es')
          : left.nombre.localeCompare(right.nombre, 'es')
      })
  }, [carrerasPorFacultad, facultades, search.orden, searchTerm])

  const filteredCarreras = useMemo(() => {
    const term = normalizeText(searchTerm.trim())

    return carreras.filter((carrera: CarreraCatalogo) => {
      if (!facultadSeleccionada) return false
      if (carrera.facultad_id !== facultadSeleccionada) return false

      if (!term) return true

      const haystack = normalizeText(
        [
          carrera.nombre,
          carrera.nombre_corto,
          carrera.clave_sep,
          facultadActiva?.nombre,
          facultadActiva?.nombre_corto,
        ]
          .filter(Boolean)
          .join(' '),
      )

      return haystack.includes(term)
    })
  }, [
    carreras,
    facultadSeleccionada,
    searchTerm,
    facultadActiva?.nombre,
    facultadActiva?.nombre_corto,
  ])

  const carrerasPorNivel = useMemo(() => {
    const groups = new Map<string, Array<CarreraCatalogo>>()

    filteredCarreras.forEach((carrera: CarreraCatalogo) => {
      const nivel = getNivelEtiqueta(carrera.nivel)
      const current = groups.get(nivel) ?? []
      current.push(carrera)
      groups.set(nivel, current)
    })

    return Array.from(groups.entries()).sort(([nivelA], [nivelB]) => {
      const indexA = NIVEL_ORDEN.indexOf(nivelA)
      const indexB = NIVEL_ORDEN.indexOf(nivelB)

      if (indexA === -1 && indexB === -1) return nivelA.localeCompare(nivelB)
      if (indexA === -1) return 1
      if (indexB === -1) return -1

      return indexA - indexB
    })
  }, [filteredCarreras])

  return (
    <main className="bg-background relative min-h-screen w-full overflow-hidden">
      <div className="from-primary/10 via-background absolute inset-x-0 top-0 -z-10 h-56 bg-linear-to-b to-transparent" />
      <div className="bg-primary/10 absolute top-10 left-8 -z-10 h-36 w-36 rounded-full blur-3xl" />
      <div className="bg-foreground/5 absolute right-0 bottom-0 -z-10 h-60 w-60 rounded-full blur-3xl" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <section className="bg-card rounded-3xl border p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <Building2 className="h-5 w-5" />
                  </div>

                  <div>
                    <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                      Facultades y carreras
                    </h1>
                  </div>
                </div>
              </div>

              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {canManageCatalogosGlobal && (
                  <div className="flex items-center">
                    <Button asChild className="ml-2 shadow-sm" size="sm">
                      <Link
                        to="/administracion/facultades/$tipo/nuevo"
                        params={{ tipo: 'facultad' }}
                      >
                        <Plus className="h-4 w-4" />
                        Nueva facultad
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-5">
              <ListToolbar
                search={
                  <div className="relative w-full">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />

                    <Input
                      value={searchTerm}
                      onChange={(event) => updateSearchTerm(event.target.value)}
                      placeholder="Buscar por facultad, carrera, clave o abreviatura"
                      className="pl-9"
                      aria-label="Buscar facultades y carreras"
                    />
                  </div>
                }
                actions={
                  <ListSortMenu
                    value={search.orden ?? 'academico'}
                    defaultValue="academico"
                    options={[
                      { value: 'academico', label: 'Estructura académica' },
                      { value: 'nombre_asc', label: 'Nombre A–Z' },
                      { value: 'nombre_desc', label: 'Nombre Z–A' },
                      {
                        value: 'carreras_desc',
                        label: 'Mayor número de carreras',
                      },
                    ]}
                    onValueChange={(orden) =>
                      navigate({
                        search: (previous) => ({
                          ...previous,
                          orden,
                        }),
                        resetScroll: false,
                      })
                    }
                    label="Ordenar facultades"
                  />
                }
              />
            </div>
          </div>
        </section>

        <section className="bg-card/70 grid overflow-hidden rounded-3xl border shadow-sm xl:grid-cols-[380px_minmax(0,1fr)]">
          {/* Facultades */}
          <Card className="rounded-none border-0 border-b shadow-none xl:border-r xl:border-b-0">
            <CardContent className="p-0">
              <ScrollArea className="h-160">
                <div className="p-3">
                  {catalogoLoading ? (
                    <ListRowsSkeleton count={6} />
                  ) : filteredFacultades.length === 0 ? (
                    <Card className="flex min-h-72 items-center justify-center border-dashed shadow-none">
                      <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
                        <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
                          <School2 className="text-muted-foreground h-7 w-7" />
                        </div>

                        <div className="space-y-1">
                          <h3 className="text-foreground text-base font-semibold">
                            No hay facultades
                          </h3>
                          <p className="text-muted-foreground max-w-sm text-sm">
                            Prueba con otro término de búsqueda.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-2">
                      {filteredFacultades.map((facultad) => {
                        const carreraCount =
                          carrerasPorFacultad.get(facultad.id) ?? 0
                        const isSelected = facultadSeleccionada === facultad.id

                        return (
                          <Button
                            key={facultad.id}
                            type="button"
                            variant={isSelected ? 'secondary' : 'ghost'}
                            onClick={() => updateFacultad(facultad.id)}
                            className="group relative h-auto w-full justify-start rounded-2xl px-3.5 py-3.5 text-left"
                          >
                            {isSelected && (
                              <span className="bg-primary absolute top-3 bottom-3 left-0 w-1 rounded-full" />
                            )}

                            <div className="flex w-full min-w-0 items-center gap-3">
                              <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-105"
                                style={{
                                  backgroundColor: facultad.color
                                    ? `${facultad.color}1A`
                                    : undefined,
                                  color: facultad.color ?? undefined,
                                }}
                              >
                                <DynamicIcon
                                  name={facultad.icono ?? ''}
                                  className="h-5 w-5"
                                />
                              </div>

                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex min-w-0 items-start justify-between gap-3">
                                  <h3 className="text-foreground wrap-break-words line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-bold tracking-tight whitespace-normal">
                                    {formatFacultadNombre(facultad)}
                                  </h3>

                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={
                                        isSelected ? 'default' : 'secondary'
                                      }
                                      className="shrink-0 rounded-full px-2.5 py-1 text-xs tabular-nums"
                                    >
                                      {carreraCount}
                                    </Badge>

                                    {(canManageCatalogosGlobal ||
                                      canManageCatalogFacultad(
                                        permissions,
                                        facultad.id,
                                      ) ||
                                      canCreateCatalogCarrera(
                                        permissions,
                                        facultad.id,
                                      )) && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <span className="text-muted-foreground hover:bg-muted/50 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full">
                                            <MoreVertical className="h-4 w-4" />
                                          </span>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          {canManageCatalogFacultad(
                                            permissions,
                                            facultad.id,
                                          ) && (
                                            <DropdownMenuItem asChild>
                                              <Link
                                                to="/administracion/facultades/$tipo/$entityId/editar"
                                                params={{
                                                  tipo: 'facultad',
                                                  entityId: facultad.id,
                                                }}
                                                className="flex cursor-pointer items-center gap-2"
                                                onClick={(event) =>
                                                  event.stopPropagation()
                                                }
                                              >
                                                <PencilLine className="h-4 w-4" />
                                                Editar facultad
                                              </Link>
                                            </DropdownMenuItem>
                                          )}

                                          {canCreateCatalogCarrera(
                                            permissions,
                                            facultad.id,
                                          ) && (
                                            <DropdownMenuItem asChild>
                                              <Link
                                                to="/administracion/facultades/$tipo/nuevo"
                                                params={{ tipo: 'carrera' }}
                                                search={{
                                                  facultadId: facultad.id,
                                                }}
                                                className="flex cursor-pointer items-center gap-2"
                                                onClick={(event) =>
                                                  event.stopPropagation()
                                                }
                                              >
                                                <Plus className="h-4 w-4" />
                                                Nueva carrera
                                              </Link>
                                            </DropdownMenuItem>
                                          )}

                                          {canManageCatalogosGlobal && (
                                            <DropdownMenuItem
                                              className="flex cursor-pointer items-center gap-2"
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                setLineasModalFacultad({
                                                  id: facultad.id,
                                                  nombre:
                                                    formatFacultadNombre(
                                                      facultad,
                                                    ),
                                                })
                                              }}
                                            >
                                              <Lightbulb className="h-4 w-4" />
                                              Líneas sugeridas
                                            </DropdownMenuItem>
                                          )}

                                          {canManageCatalogosGlobal && (
                                            <DropdownMenuSeparator />
                                          )}

                                          {canManageCatalogosGlobal &&
                                            (facultad.activa === false ? (
                                              <DropdownMenuItem disabled>
                                                <Archive className="h-4 w-4" />
                                                Facultad archivada
                                              </DropdownMenuItem>
                                            ) : (
                                              <DropdownMenuItem asChild>
                                                <Link
                                                  to="/administracion/facultades/$tipo/$entityId/archivar"
                                                  params={{
                                                    tipo: 'facultad',
                                                    entityId: facultad.id,
                                                  }}
                                                  className="text-destructive flex cursor-pointer items-center gap-2"
                                                  onClick={(event) =>
                                                    event.stopPropagation()
                                                  }
                                                >
                                                  <Archive className="h-4 w-4" />
                                                  Archivar facultad
                                                </Link>
                                              </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Carreras */}
          <Card className="min-w-0 rounded-none border-0 shadow-none">
            <CardHeader className="border-b px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="wrap-break-words line-clamp-2 text-xl leading-tight tracking-tight whitespace-normal">
                    {facultadActiva
                      ? formatFacultadNombre(facultadActiva)
                      : 'Selecciona una facultad'}
                  </CardTitle>

                  {facultadActiva?.nombre_corto && (
                    <CardDescription className="wrap-break-words line-clamp-2">
                      {facultadActiva.nombre_corto}
                    </CardDescription>
                  )}
                </div>

                {(canManageCatalogosGlobal ||
                  (facultadActiva &&
                    (canManageCatalogFacultad(permissions, facultadActiva.id) ||
                      canCreateCatalogCarrera(
                        permissions,
                        facultadActiva.id,
                      )))) &&
                  facultadActiva && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <span className="text-muted-foreground hover:bg-muted/50 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full">
                          <MoreVertical className="h-4 w-4" />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canManageCatalogFacultad(
                          permissions,
                          facultadActiva.id,
                        ) && (
                          <DropdownMenuItem asChild>
                            <Link
                              to="/administracion/facultades/$tipo/$entityId/editar"
                              params={{
                                tipo: 'facultad',
                                entityId: facultadActiva.id,
                              }}
                              className="flex cursor-pointer items-center gap-2"
                            >
                              <PencilLine className="h-4 w-4" />
                              Editar facultad
                            </Link>
                          </DropdownMenuItem>
                        )}

                        {canCreateCatalogCarrera(
                          permissions,
                          facultadActiva.id,
                        ) && (
                          <DropdownMenuItem asChild>
                            <Link
                              to="/administracion/facultades/$tipo/nuevo"
                              params={{ tipo: 'carrera' }}
                              search={{ facultadId: facultadActiva.id }}
                              className="flex cursor-pointer items-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Nueva carrera
                            </Link>
                          </DropdownMenuItem>
                        )}

                        {canManageCatalogosGlobal && (
                          <DropdownMenuItem
                            className="flex cursor-pointer items-center gap-2"
                            onClick={() =>
                              setLineasModalFacultad({
                                id: facultadActiva.id,
                                nombre: formatFacultadNombre(facultadActiva),
                              })
                            }
                          >
                            <Lightbulb className="h-4 w-4" />
                            Líneas sugeridas
                          </DropdownMenuItem>
                        )}

                        {canManageCatalogosGlobal && <DropdownMenuSeparator />}

                        {canManageCatalogosGlobal &&
                          (facultadActiva.activa === false ? (
                            <DropdownMenuItem disabled>
                              <Archive className="h-4 w-4" />
                              Facultad archivada
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem asChild>
                              <Link
                                to="/administracion/facultades/$tipo/$entityId/archivar"
                                params={{
                                  tipo: 'facultad',
                                  entityId: facultadActiva.id,
                                }}
                                className="text-destructive flex cursor-pointer items-center gap-2"
                              >
                                <Archive className="h-4 w-4" />
                                Archivar facultad
                              </Link>
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredCarreras.length === 0 ? (
                <div className="flex min-h-96 flex-col items-center justify-center gap-4 px-6 text-center">
                  <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
                    <CircleOff className="text-muted-foreground h-7 w-7" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-foreground text-base font-semibold">
                      No hay carreras
                    </h3>
                    <p className="text-muted-foreground max-w-sm text-sm">
                      Intenta cambiar la búsqueda o selecciona otra facultad.
                    </p>
                  </div>
                </div>
              ) : (
                <ScrollArea className="h-160">
                  <div className="space-y-8 px-6 py-6">
                    {carrerasPorNivel.map(([nivel, carrerasDelNivel]) => (
                      <section key={nivel} className="space-y-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <h3 className="text-muted-foreground shrink-0 text-xs font-semibold tracking-[0.18em] uppercase">
                            {nivel}
                          </h3>

                          <Separator className="flex-1" />

                          <Badge
                            variant="outline"
                            className="shrink-0 rounded-full text-xs tabular-nums"
                          >
                            {carrerasDelNivel.length}
                          </Badge>
                        </div>

                        <div className="grid gap-3">
                          {carrerasDelNivel.map((carrera) => {
                            return (
                              <Card
                                key={carrera.id}
                                className="border-border/60 hover:bg-muted/40 overflow-hidden shadow-none transition"
                              >
                                <CardContent className="p-4 sm:p-5">
                                  <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <div className="flex min-w-0 flex-wrap items-start gap-2">
                                        <h4 className="text-foreground wrap-break-words min-w-0 flex-1 text-base leading-snug font-bold tracking-tight whitespace-normal sm:text-[17px]">
                                          {carrera.nombre}
                                        </h4>

                                        {!carrera.activa && (
                                          <Badge
                                            variant="outline"
                                            className="shrink-0 rounded-full px-2 py-0 text-[11px] font-medium"
                                          >
                                            Inactiva
                                          </Badge>
                                        )}
                                      </div>

                                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                        {carrera.nombre_corto && (
                                          <span className="text-muted-foreground wrap-break-words line-clamp-2 max-w-full text-xs font-medium tracking-[0.14em] uppercase">
                                            {carrera.nombre_corto}
                                          </span>
                                        )}

                                        {carrera.nombre_corto && (
                                          <span className="text-border text-xs">
                                            •
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <CarreraCardContent
                                      carrera={carrera}
                                      canManageCatalogosGlobal={
                                        canManageCatalogosGlobal
                                      }
                                      canManageCarrera={canManageCatalogCarrera(
                                        permissions,
                                        carrera,
                                      )}
                                    />
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </section>
        <Outlet />
      </div>

      {lineasModalFacultad && (
        <LineasSugeridasModal
          facultadId={lineasModalFacultad.id}
          facultadNombre={lineasModalFacultad.nombre}
          open={Boolean(lineasModalFacultad)}
          onOpenChange={(open) => {
            if (!open) setLineasModalFacultad(null)
          }}
        />
      )}
    </main>
  )
}
