import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { Option, OptionGroup } from '@/components/planes/Filtro'
import type { CatalogoAsignaturaMotivo } from '@/data/types/domain'
import type { CatalogoAsignaturasSearch } from '@/types/search'

import {
  asignaturaStatusConfig,
  asignaturaTipoConfig,
} from '@/components/asignaturas/asignaturaTableConfig'
import Filtro from '@/components/planes/Filtro'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { catalogoAsignaturasOptions } from '@/data'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { useCarreras, useFacultades } from '@/data/hooks/useMeta'
import { usePlanes } from '@/data/hooks/usePlans'
import { useCatalogoAsignaturas } from '@/data/hooks/useSubjects'
import { NIVEL_ORDEN } from '@/features/usuarios/usuario-ui'
import { formatFacultadNombre } from '@/lib/facultad-utils'
import { defaultCatalogoAsignaturasSearch } from '@/types/search'

const DEFAULTS = defaultCatalogoAsignaturasSearch

const parseCatalogoSearch = (
  search: Record<string, unknown>,
): CatalogoAsignaturasSearch => {
  const str = (key: keyof CatalogoAsignaturasSearch) =>
    typeof search[key] === 'string' ? search[key] : (DEFAULTS[key] as string)

  const rawPage =
    typeof search.page === 'number' || typeof search.page === 'string'
      ? Number(search.page)
      : DEFAULTS.page
  const page =
    Number.isFinite(rawPage) && rawPage >= 0 ? Math.floor(rawPage) : 0

  return {
    q: typeof search.q === 'string' ? search.q : DEFAULTS.q,
    facultad: str('facultad'),
    carrera: str('carrera'),
    plan: str('plan'),
    tipo: str('tipo'),
    estado: str('estado'),
    incluirArchivadas:
      search.incluirArchivadas === true || search.incluirArchivadas === 'true',
    page,
  }
}

const PAGE_SIZE = 20

export const Route = createFileRoute('/asignaturas')({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, [
      'asignaturas.ver',
      'planes.ver',
    ]),
  validateSearch: parseCatalogoSearch,
  search: {
    middlewares: [stripSearchParams(defaultCatalogoAsignaturasSearch)],
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(
      catalogoAsignaturasOptions({
        q: deps.q,
        facultadId: deps.facultad !== 'todas' ? deps.facultad : null,
        carreraId: deps.carrera !== 'todas' ? deps.carrera : null,
        planId: deps.plan !== 'todos' ? deps.plan : null,
        tipo: deps.tipo as never,
        estado: deps.estado as never,
        incluirArchivadas: deps.incluirArchivadas,
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

function motivoVariant(
  tipo: CatalogoAsignaturaMotivo['tipo'],
): 'default' | 'secondary' | 'outline' {
  if (tipo === 'global') return 'default'
  if (tipo === 'facultad' || tipo === 'carrera') return 'secondary'
  return 'outline'
}

const TIPO_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  ...Object.entries(asignaturaTipoConfig).map(([value, cfg]) => ({
    value,
    label: cfg.label,
  })),
]

// El catálogo lista asignaturas ya materializadas; 'generando'/'fallida' son
// estados transitorios de generación que no tienen sentido como filtro aquí.
const ESTADO_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  ...(['borrador', 'revisada', 'aprobada', 'archivada'] as const).map(
    (value) => ({ value, label: asignaturaStatusConfig[value].label }),
  ),
]

function RouteComponent() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()

  // Búsqueda con debounce: el input es local y se vuelca a la URL tras una pausa.
  const [qInput, setQInput] = useState(search.q)
  useEffect(() => setQInput(search.q), [search.q])
  useEffect(() => {
    const trimmed = qInput.trim()
    if (trimmed === search.q) return
    const id = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: trimmed, page: 0 }),
        resetScroll: false,
      })
    }, 350)
    return () => clearTimeout(id)
  }, [qInput, navigate, search.q])

  const { data: facultades = [] } = useFacultades()
  const hasSelectedFacultad = search.facultad !== 'todas'
  const { data: carreras = [], isLoading: carrerasLoading } = useCarreras(
    hasSelectedFacultad ? { facultadId: search.facultad } : undefined,
  )
  const { data: planesData } = usePlanes({
    facultadId: search.facultad,
    carreraId: search.carrera,
    limit: 200,
    offset: 0,
  })

  const {
    data: page,
    isLoading,
    isError,
    isPlaceholderData,
  } = useCatalogoAsignaturas({
    q: search.q,
    facultadId: search.facultad !== 'todas' ? search.facultad : null,
    carreraId: search.carrera !== 'todas' ? search.carrera : null,
    planId: search.plan !== 'todos' ? search.plan : null,
    tipo: search.tipo as never,
    estado: search.estado as never,
    incluirArchivadas: search.incluirArchivadas,
    limit: PAGE_SIZE,
    offset: search.page * PAGE_SIZE,
  })

  const rows = page?.data ?? []
  const total = page?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = search.page
  const pageNumbers = getPageNumbers(currentPage, totalPages)

  const facultadOptions = useMemo(
    () => [
      { value: 'todas', label: 'Todas las facultades' },
      ...facultades.map((f) => ({
        value: f.id,
        label: formatFacultadNombre(f),
        icon: <FacultadIconPill facultad={f} />,
      })),
    ],
    [facultades],
  )

  const carreraOptions = useMemo(
    (): Array<Option | OptionGroup> => {
      if (!hasSelectedFacultad || carreras.length === 0) return []

      return [
        { value: 'todas', label: 'Todas las carreras' },
        ...NIVEL_ORDEN
          .map((nivel) => ({
            label: nivel,
            options: carreras
              .filter((carrera) => carrera.nivel === nivel)
              .map((carrera) => ({ value: carrera.id, label: carrera.nombre })),
          }))
          .filter((grupo) => grupo.options.length > 0),
      ]
    },
    [carreras, hasSelectedFacultad],
  )

  const carreraPlaceholder = !hasSelectedFacultad
    ? 'Selecciona una facultad'
    : carrerasLoading
      ? 'Cargando carreras'
      : carreras.length === 0
        ? 'Esta facultad no tiene carreras'
        : 'Todas las carreras'

  const carreraDisabled =
    !hasSelectedFacultad || carrerasLoading || carreras.length === 0

  useEffect(() => {
    if (!hasSelectedFacultad) {
      if (search.carrera === 'todas') return
      void navigate({
        search: (prev) => ({
          ...prev,
          carrera: 'todas',
          plan: 'todos',
          page: 0,
        }),
        resetScroll: false,
      })
      return
    }

    if (carrerasLoading || search.carrera === 'todas') return
    if (carreras.some((carrera) => carrera.id === search.carrera)) return

    void navigate({
      search: (prev) => ({
        ...prev,
        carrera: 'todas',
        plan: 'todos',
        page: 0,
      }),
      resetScroll: false,
    })
  }, [
    carreras,
    carrerasLoading,
    hasSelectedFacultad,
    navigate,
    search.carrera,
  ])

  const planOptions = useMemo(
    () => [
      { value: 'todos', label: 'Todos los planes' },
      ...(planesData?.data ?? []).map((p) => ({
        value: p.id,
        label: p.nombre,
      })),
    ],
    [planesData?.data],
  )

  const isClearDisabled =
    search.q === '' &&
    search.facultad === 'todas' &&
    search.carrera === 'todas' &&
    search.plan === 'todos' &&
    search.tipo === 'all' &&
    search.estado === 'all' &&
    !search.incluirArchivadas

  const goToPage = (p: number) =>
    navigate({ search: (prev) => ({ ...prev, page: p }), resetScroll: false })

  const handleRowClick = (row: (typeof rows)[number]) => {
    // Si todos los motivos son de responsabilidad directa, el usuario no tiene
    // acceso al plan por alcance: la vista de detalle debe ocultar la navegación
    // del plan y ofrecer "volver a asignaturas".
    const soloAsignatura =
      row.motivos_acceso.length > 0 &&
      row.motivos_acceso.every((m) => m.tipo === 'responsable_asignatura')

    void navigate({
      to: '/planes/$planId/asignaturas/$asignaturaId',
      params: { planId: row.plan_estudio_id, asignaturaId: row.asignatura_id },
      search: { origen: 'catalogo', soloAsignatura },
    })
  }

  const columnCount = 9

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
          <BookOpenText className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <h1 className="font-display text-foreground text-2xl font-bold">
            Catálogo de Asignaturas
          </h1>
          <p className="text-muted-foreground text-sm">
            Todas las asignaturas a las que tienes acceso, con el motivo por el
            que puedes verlas.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full max-w-md">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Buscar por nombre, clave o contenido…"
            className="pl-9"
            aria-label="Buscar asignaturas"
          />
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="w-full sm:w-44">
            <Filtro
              options={facultadOptions}
              value={search.facultad}
              onChange={(v) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    facultad: v,
                    carrera: 'todas',
                    plan: 'todos',
                    page: 0,
                  }),
                  resetScroll: false,
                })
              }
              placeholder="Facultad"
              ariaLabel="Filtrar por facultad"
              active={search.facultad !== 'todas'}
            />
          </div>
          <div className="w-full sm:w-44">
            <Filtro
              options={carreraOptions}
              value={search.carrera}
              onChange={(v) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    carrera: v,
                    plan: 'todos',
                    page: 0,
                  }),
                  resetScroll: false,
                })
              }
              placeholder={carreraPlaceholder}
              ariaLabel="Filtrar por carrera"
              active={search.carrera !== 'todas'}
              disabled={carreraDisabled}
            />
          </div>
          <div className="w-full sm:w-44">
            <Filtro
              options={planOptions}
              value={search.plan}
              onChange={(v) =>
                navigate({
                  search: (prev) => ({ ...prev, plan: v, page: 0 }),
                  resetScroll: false,
                })
              }
              placeholder="Plan"
              ariaLabel="Filtrar por plan"
              active={search.plan !== 'todos'}
              disabled={planOptions.length <= 1}
            />
          </div>
          <div className="w-full sm:w-40">
            <Filtro
              options={TIPO_OPTIONS}
              value={search.tipo}
              onChange={(v) =>
                navigate({
                  search: (prev) => ({ ...prev, tipo: v, page: 0 }),
                  resetScroll: false,
                })
              }
              placeholder="Tipo"
              ariaLabel="Filtrar por tipo"
              active={search.tipo !== 'all'}
            />
          </div>
          <div className="w-full sm:w-40">
            <Filtro
              options={ESTADO_OPTIONS}
              value={search.estado}
              onChange={(v) =>
                navigate({
                  search: (prev) => ({ ...prev, estado: v, page: 0 }),
                  resetScroll: false,
                })
              }
              placeholder="Estado"
              ariaLabel="Filtrar por estado"
              active={search.estado !== 'all'}
            />
          </div>

          <Label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={search.incluirArchivadas}
              onCheckedChange={(checked) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    incluirArchivadas: checked === true,
                    page: 0,
                  }),
                  resetScroll: false,
                })
              }
            />
            Incluir archivadas
          </Label>

          {!isClearDisabled && (
            <button
              type="button"
              onClick={() =>
                navigate({
                  search: () => ({ ...defaultCatalogoAsignaturasSearch }),
                  resetScroll: false,
                })
              }
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
            >
              <X className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Resumen */}
      {!isLoading && (
        <p className="text-muted-foreground text-sm">
          {total} {total === 1 ? 'asignatura' : 'asignaturas'}
        </p>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-[var(--radius)] border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-28">Clave</TableHead>
              <TableHead>Asignatura</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Carrera</TableHead>
              <TableHead>Facultad</TableHead>
              <TableHead className="text-center">Ciclo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Visible por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={isPlaceholderData ? 'opacity-60' : ''}>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: columnCount }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="text-destructive py-10 text-center"
                >
                  Ocurrió un error al cargar el catálogo.
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="text-muted-foreground py-10 text-center"
                >
                  No se encontraron asignaturas con estos filtros.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.asignatura_id}
                  onClick={() => handleRowClick(row)}
                  className="hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <TableCell className="text-muted-foreground font-mono text-xs font-bold">
                    {row.codigo ?? '—'}
                  </TableCell>
                  <TableCell className="text-foreground font-semibold">
                    {row.nombre}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.plan_nombre}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.carrera_nombre}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.facultad_nombre}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.numero_ciclo ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={asignaturaTipoConfig[row.tipo].variant}>
                      {asignaturaTipoConfig[row.tipo].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={asignaturaStatusConfig[row.estado].variant}
                      className={asignaturaStatusConfig[row.estado].className}
                    >
                      {asignaturaStatusConfig[row.estado].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.motivos_acceso.map((motivo, i) => (
                        <Badge
                          key={`${motivo.tipo}-${i}`}
                          variant={motivoVariant(motivo.tipo)}
                          className="font-normal"
                        >
                          {motivo.label}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
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
                aria-disabled={currentPage >= totalPages - 1}
                className={
                  currentPage >= totalPages - 1
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
    </main>
  )
}
