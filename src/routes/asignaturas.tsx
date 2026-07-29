import {
  createFileRoute,
  Link,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import {
  Archive,
  BookCheck,
  Building2,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  FilePenLine,
  GraduationCap,
  LibraryBig,
  LayoutGrid,
  List,
  ListPlus,
  LoaderCircle,
  Search,
  SearchCheck,
  Shapes,
  TriangleAlert,
  UserRoundCheck,
  Users,
  Asterisk,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { Option, OptionGroup } from '@/components/planes/Filtro'
import type {
  CatalogoAsignaturaMotivo,
  CatalogoAsignaturaRow,
} from '@/data/types/domain'
import type { CatalogoAsignaturasSearch } from '@/types/search'

import {
  asignaturaStatusConfig,
  asignaturaTipoConfig,
} from '@/components/asignaturas/asignaturaTableConfig'
import Filtro from '@/components/planes/Filtro'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ListFilterSection,
  ListFiltersDialog,
  ListSortMenu,
  ListToolbar,
} from '@/components/ui/list-controls'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { catalogoAsignaturasOptions } from '@/data'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { useCarreras, useFacultades } from '@/data/hooks/useMeta'
import { usePlanes } from '@/data/hooks/usePlans'
import { useCatalogoAsignaturas } from '@/data/hooks/useSubjects'
import { NIVEL_ORDEN } from '@/features/usuarios/usuario-ui'
import { formatCiclo, nombreTipoCiclo } from '@/lib/ciclo-utils'
import { formatFacultadNombre } from '@/lib/facultad-utils'
import { getPlanDisplayName } from '@/lib/plan-display'
import { cn } from '@/lib/utils'
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
    modo: search.modo === 'grid' ? 'grid' : 'lista',
    facultad: str('facultad'),
    carrera: str('carrera'),
    plan: str('plan'),
    tipo: str('tipo'),
    estado: str('estado'),
    incluirArchivadas:
      search.incluirArchivadas === true || search.incluirArchivadas === 'true',
    orden:
      search.orden === 'curricular' ||
      search.orden === 'nombre_asc' ||
      search.orden === 'nombre_desc' ||
      search.orden === 'ciclo_asc' ||
      search.orden === 'creditos_desc'
        ? search.orden
        : DEFAULTS.orden,
    page,
  }
}

const PAGE_SIZE = 20
const CATALOGO_SORT_OPTIONS = [
  { value: 'relevancia', label: 'Relevancia' },
  { value: 'curricular', label: 'Secuencia curricular' },
  { value: 'nombre_asc', label: 'Nombre A–Z' },
  { value: 'nombre_desc', label: 'Nombre Z–A' },
  { value: 'ciclo_asc', label: 'Ciclo ascendente' },
  { value: 'creditos_desc', label: 'Mayor número de créditos' },
] as const

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
        sort: deps.orden,
        limit: PAGE_SIZE,
        offset: deps.page * PAGE_SIZE,
      }),
    )
  },
  component: RouteComponent,
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

const TIPOS_ASIGNATURA = [
  'OBLIGATORIA',
  'OPTATIVA',
  'TRONCAL',
  'OTRA',
] as const satisfies Array<CatalogoAsignaturaRow['tipo']>

const tipoFiltroHoverClass: Record<CatalogoAsignaturaRow['tipo'], string> = {
  OBLIGATORIA:
    'data-[selected=true]:bg-primary/12 data-[selected=true]:text-primary',
  OPTATIVA:
    'data-[selected=true]:bg-destructive/12 data-[selected=true]:text-destructive',
  TRONCAL:
    'data-[selected=true]:bg-chart-4/12 data-[selected=true]:text-chart-4',
  OTRA: 'data-[selected=true]:bg-chart-3/12 data-[selected=true]:text-chart-3',
}

// El catálogo lista asignaturas ya materializadas; 'generando'/'fallida' son
// estados transitorios de generación que no tienen sentido como filtro aquí.
const ESTADO_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  ...(['borrador', 'revisada', 'aprobada', 'archivada'] as const).map(
    (value) => ({ value, label: asignaturaStatusConfig[value].label }),
  ),
]

function EstadoIcon({ estado }: { estado: CatalogoAsignaturaRow['estado'] }) {
  if (estado === 'borrador') return <FilePenLine className="h-4 w-4" />
  if (estado === 'revisada') return <SearchCheck className="h-4 w-4" />
  if (estado === 'aprobada') return <CircleCheck className="h-4 w-4" />
  if (estado === 'archivada') return <Archive className="h-4 w-4" />
  if (estado === 'generando')
    return <LoaderCircle className="h-4 w-4 animate-spin" />
  return <TriangleAlert className="h-4 w-4" />
}

function TipoAsignaturaIcon({ tipo }: { tipo: CatalogoAsignaturaRow['tipo'] }) {
  if (tipo === 'TRONCAL') return <LibraryBig className="h-[18px] w-[18px]" />
  if (tipo === 'OBLIGATORIA') return <BookCheck className="h-[18px] w-[18px]" />
  if (tipo === 'OPTATIVA') return <ListPlus className="h-[18px] w-[18px]" />
  return <Shapes className="h-[18px] w-[18px]" />
}

function TipoAsignaturaFiltroIcon({
  tipo,
}: {
  tipo?: CatalogoAsignaturaRow['tipo']
}) {
  const colorClass =
    tipo === 'OBLIGATORIA'
      ? 'border-primary/15 bg-primary/8 text-primary'
      : tipo === 'OPTATIVA'
        ? 'border-destructive/20 bg-destructive/10 text-destructive'
        : tipo === 'TRONCAL'
          ? 'border-chart-4/25 bg-chart-4/10 text-chart-4'
          : tipo === 'OTRA'
            ? 'border-chart-3/25 bg-chart-3/10 text-chart-3'
            : 'border-border bg-muted text-muted-foreground'

  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded border',
        colorClass,
      )}
    >
      {tipo ? (
        <TipoAsignaturaIcon tipo={tipo} />
      ) : (
        <Asterisk className="h-[14px] w-[14px]" />
      )}
    </span>
  )
}

const TIPO_OPTIONS = [
  {
    value: 'all',
    label: 'Todos los tipos',
    icon: <TipoAsignaturaFiltroIcon />,
    hoverClassName: 'data-[selected=true]:bg-muted',
  },
  ...TIPOS_ASIGNATURA.map((tipo) => ({
    value: tipo,
    label: asignaturaTipoConfig[tipo].label,
    icon: <TipoAsignaturaFiltroIcon tipo={tipo} />,
    hoverClassName: tipoFiltroHoverClass[tipo],
  })),
]

function getMotivoRol(motivo: CatalogoAsignaturaMotivo) {
  if (motivo.tipo === 'global') return null
  if (motivo.tipo === 'experto') return { label: 'Experto', icon: SearchCheck }
  if (motivo.tipo === 'carrera')
    return { label: 'Jefe de carrera', icon: GraduationCap }
  if (motivo.tipo === 'facultad')
    return { label: 'Responsable de facultad', icon: Building2 }
  if (motivo.rol === 'PROFESOR_RESPONSABLE')
    return { label: 'Profesor responsable', icon: UserRoundCheck }
  if (motivo.rol === 'COAUTOR') return { label: 'Coautor', icon: Users }
  return { label: 'Revisor', icon: SearchCheck }
}

function CatalogoAsignaturaItem({
  row,
  modo,
}: {
  row: CatalogoAsignaturaRow
  modo: CatalogoAsignaturasSearch['modo']
}) {
  const navigate = useNavigate({ from: Route.fullPath })
  const tipo = asignaturaTipoConfig[row.tipo]
  const estado = asignaturaStatusConfig[row.estado]
  const rolesAcceso = row.motivos_acceso
    .map(getMotivoRol)
    .filter((motivo) => motivo !== null)
  const facultadNombreCompleto = formatFacultadNombre({
    nombre: row.facultad_nombre,
    prefijo: row.facultad_prefijo,
  })
  const facultadNombreCorto =
    row.facultad_nombre_corto.trim() || row.facultad_nombre
  const esCurricular = row.plan_tipo_estructura === 'CURRICULAR'
  const soloAsignatura =
    row.motivos_acceso.length > 0 &&
    row.motivos_acceso.every(
      (motivo) => motivo.tipo === 'responsable_asignatura',
    )
  const abrirAsignatura = () => {
    void navigate({
      to: '/planes/$planId/asignaturas/$asignaturaId',
      params: {
        planId: row.plan_estudio_id,
        asignaturaId: row.asignatura_id,
      },
      search: { origen: 'catalogo', soloAsignatura },
    })
  }
  const tipoIconClass = {
    OBLIGATORIA:
      'border-primary/15 bg-primary/8 text-primary group-hover:bg-primary/12 focus-visible:ring-primary/30',
    OPTATIVA:
      'border-destructive/20 bg-destructive/10 text-destructive group-hover:bg-destructive/15 focus-visible:ring-destructive/30',
    TRONCAL:
      'border-chart-4/25 bg-chart-4/10 text-chart-4 group-hover:bg-chart-4/15 focus-visible:ring-chart-4/30',
    OTRA: 'border-chart-3/25 bg-chart-3/10 text-chart-3 group-hover:bg-chart-3/15 focus-visible:ring-chart-3/30',
  } satisfies Record<CatalogoAsignaturaRow['tipo'], string>

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Abrir asignatura ${row.nombre}`}
      onClick={abrirAsignatura}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || event.key !== 'Enter')
          return
        event.preventDefault()
        abrirAsignatura()
      }}
      className={cn(
        'organic-interactive group border-border/70 dark:border-border/60 bg-card hover:bg-secondary/35 dark:bg-background dark:hover:bg-muted/20 focus-visible:ring-primary/30 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none',
        modo === 'lista'
          ? 'flex items-start gap-3 border-b px-4 py-4 last:border-b-0 md:gap-4 md:px-5'
          : 'flex flex-col rounded-xl border p-4 shadow-xs dark:shadow-none',
      )}
    >
      <div
        className={cn(
          'flex min-w-0 items-start gap-3',
          modo === 'lista' ? 'flex-1' : 'w-full',
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors',
                tipoIconClass[row.tipo],
              )}
            >
              <TipoAsignaturaIcon tipo={row.tipo} />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            Asignatura {tipo.label.toLowerCase()}
          </TooltipContent>
        </Tooltip>

        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              'text-foreground group-hover:text-primary line-clamp-2 leading-snug font-semibold transition-colors',
              modo === 'lista' ? 'text-xl' : 'text-lg',
            )}
          >
            {row.nombre}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {row.codigo?.trim() ? (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                {row.codigo}
              </span>
            ) : null}
            <span className="text-muted-foreground text-[11px]">
              {row.creditos} créditos
            </span>
            <span className="text-muted-foreground text-[11px]">
              {row.numero_ciclo != null
                ? formatCiclo(row.plan_tipo_ciclo, row.numero_ciclo)
                : `${nombreTipoCiclo(row.plan_tipo_ciclo)} —`}
            </span>
          </div>

          <div
            className={cn(
              'border-border/50 mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3',
              modo === 'lista' && 'md:flex-nowrap',
            )}
          >
            <div
              className={cn(
                'text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs',
                modo === 'lista' && 'md:max-w-[48rem] md:flex-1',
              )}
            >
              <GraduationCap className="size-3.5 shrink-0" />
              {soloAsignatura ? (
                <span className="line-clamp-2 font-medium">
                  {row.plan_nombre}
                </span>
              ) : (
                <Link
                  to="/planes/$planId"
                  params={{ planId: row.plan_estudio_id }}
                  onClick={(event) => event.stopPropagation()}
                  className="hover:text-primary focus-visible:ring-primary/30 line-clamp-2 min-w-0 rounded-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {row.plan_nombre}
                </Link>
              )}
            </div>

            {modo === 'lista' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs">
                    <FacultadIconPill
                      facultad={{
                        color: row.facultad_color,
                        icono: row.facultad_icono,
                      }}
                    />
                    <span className="truncate">{facultadNombreCorto}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{facultadNombreCompleto}</TooltipContent>
              </Tooltip>
            ) : null}
            {!esCurricular ? (
              <span className="text-muted-foreground line-clamp-2 text-xs">
                {row.carrera_nombre}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'flex min-w-0 shrink-0 gap-2',
          modo === 'lista'
            ? 'flex-col items-end'
            : 'border-border/50 mt-3 items-center justify-between border-t pt-3',
        )}
      >
        <Badge
          variant={estado.variant}
          className={cn('gap-1.5', estado.className)}
        >
          <EstadoIcon estado={row.estado} />
          {estado.label}
        </Badge>

        <div className="text-muted-foreground flex min-w-0 items-center justify-end gap-x-3 gap-y-1.5 text-xs">
          {rolesAcceso.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
              {rolesAcceso.map(({ label, icon: Icon }, i) => (
                <span
                  key={`${label}-${i}`}
                  className="inline-flex max-w-36 items-center gap-1.5 truncate"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          {modo === 'grid' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <FacultadIconPill
                    facultad={{
                      color: row.facultad_color,
                      icono: row.facultad_icono,
                    }}
                  />
                  <span className="max-w-32 truncate">
                    {facultadNombreCorto}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent>{facultadNombreCompleto}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CatalogoSkeletonList({
  modo,
}: {
  modo: CatalogoAsignaturasSearch['modo']
}) {
  return (
    <div
      className={cn(
        modo === 'lista'
          ? 'divide-border/70 divide-y'
          : 'masonry-grid masonry-grid--catalogo-asignaturas',
      )}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex items-start gap-3 px-4 py-4',
            modo === 'lista'
              ? 'md:gap-4 md:px-5'
              : 'border-border bg-card min-h-44 rounded-xl border shadow-xs',
          )}
        >
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-32" />
            <div className="border-border/50 mt-3 flex items-center gap-2 border-t pt-3">
              <Skeleton className="h-4 min-w-0 flex-1" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}

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
  const { data: carreras = [], isLoading: carrerasLoading } = useCarreras()
  const { data: planesData } = usePlanes({
    limit: 500,
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
    sort: search.orden,
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
        hoverClassName:
          'data-[selected=true]:bg-[var(--filter-option-hover)] data-[selected=true]:text-foreground',
        hoverStyle: f.color
          ? ({
              '--filter-option-hover': `${f.color}1f`,
            } as React.CSSProperties)
          : undefined,
      })),
    ],
    [facultades],
  )

  const getCarreraOptions = (
    facultadId: string,
  ): Array<Option | OptionGroup> => {
    if (facultadId === 'todas') return []
    const carrerasDeFacultad = carreras.filter(
      (carrera) => carrera.facultad_id === facultadId,
    )

    return [
      { value: 'todas', label: 'Todas las carreras' },
      ...NIVEL_ORDEN.map((nivel) => ({
        label: nivel,
        options: carrerasDeFacultad
          .filter((carrera) => carrera.nivel === nivel)
          .map((carrera) => ({ value: carrera.id, label: carrera.nombre })),
      })).filter((grupo) => grupo.options.length > 0),
    ]
  }

  const carrerasSeleccionadas = useMemo(
    () =>
      hasSelectedFacultad
        ? carreras.filter((carrera) => carrera.facultad_id === search.facultad)
        : [],
    [carreras, hasSelectedFacultad, search.facultad],
  )

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
    if (carrerasSeleccionadas.some((carrera) => carrera.id === search.carrera))
      return

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
    carrerasLoading,
    carrerasSeleccionadas,
    hasSelectedFacultad,
    navigate,
    search.carrera,
  ])

  const getPlanOptions = (facultadId: string, carreraId: string) => [
    { value: 'todos', label: 'Todos los planes' },
    ...(planesData?.data ?? [])
      .filter(
        (plan) =>
          (facultadId === 'todas' ||
            plan.carreras?.facultad_id === facultadId) &&
          (carreraId === 'todas' || plan.carrera_id === carreraId),
      )
      .map((p) => ({
        value: p.id,
        label: getPlanDisplayName(p),
      })),
  ]

  const catalogFilterValue = {
    facultad: search.facultad,
    carrera: search.carrera,
    plan: search.plan,
    tipo: search.tipo,
    estado: search.estado,
    incluirArchivadas: search.incluirArchivadas,
  }
  const catalogFilterDefaults = {
    facultad: 'todas',
    carrera: 'todas',
    plan: 'todos',
    tipo: 'all',
    estado: 'all',
    incluirArchivadas: false,
  }
  const catalogActiveFilterCount = [
    search.facultad !== 'todas',
    search.carrera !== 'todas',
    search.plan !== 'todos',
    search.tipo !== 'all',
    search.estado !== 'all',
    search.incluirArchivadas,
  ].filter(Boolean).length

  const goToPage = (p: number) =>
    navigate({ search: (prev) => ({ ...prev, page: p }), resetScroll: false })

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display text-foreground text-3xl font-bold">
            Catálogo de Asignaturas
          </h1>
        </div>
      </div>

      <ListToolbar
        search={
          <div className="relative w-full">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Buscar por nombre, clave o contenido…"
              className="h-11 pl-9"
              aria-label="Buscar asignaturas"
            />
          </div>
        }
        actions={
          <>
            <ListSortMenu
              value={search.orden}
              defaultValue={DEFAULTS.orden}
              options={[...CATALOGO_SORT_OPTIONS]}
              onValueChange={(orden) =>
                navigate({
                  search: (prev) => ({ ...prev, orden, page: 0 }),
                  resetScroll: false,
                })
              }
              label="Ordenar catálogo de asignaturas"
            />
            <ListFiltersDialog
              title="Filtrar el catálogo de asignaturas"
              value={catalogFilterValue}
              defaultValue={catalogFilterDefaults}
              activeCount={catalogActiveFilterCount}
              onApply={(next, { resetAll }) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    q: resetAll ? '' : prev.q,
                    orden: resetAll ? DEFAULTS.orden : prev.orden,
                    ...next,
                    page: 0,
                  }),
                  resetScroll: false,
                })
              }
              label="Filtrar catálogo de asignaturas"
            >
              {(draft, setDraft) => {
                const draftCarreraOptions = getCarreraOptions(draft.facultad)
                const draftCarreras = carreras.filter(
                  (carrera) => carrera.facultad_id === draft.facultad,
                )
                const draftPlanOptions = getPlanOptions(
                  draft.facultad,
                  draft.carrera,
                )

                return (
                  <>
                    <ListFilterSection title="Facultad">
                      <Filtro
                        options={facultadOptions}
                        value={draft.facultad}
                        onChange={(facultad) =>
                          setDraft((previous) => ({
                            ...previous,
                            facultad,
                            carrera: 'todas',
                            plan: 'todos',
                          }))
                        }
                        ariaLabel="Filtrar por facultad"
                      />
                    </ListFilterSection>
                    <ListFilterSection title="Carrera">
                      <Filtro
                        options={draftCarreraOptions}
                        value={draft.carrera}
                        onChange={(carrera) =>
                          setDraft((previous) => ({
                            ...previous,
                            carrera,
                            plan: 'todos',
                          }))
                        }
                        placeholder={
                          draft.facultad === 'todas'
                            ? 'Selecciona una facultad'
                            : carrerasLoading
                              ? 'Cargando carreras'
                              : draftCarreras.length === 0
                                ? 'Esta facultad no tiene carreras'
                                : 'Todas las carreras'
                        }
                        ariaLabel="Filtrar por carrera"
                        disabled={
                          draft.facultad === 'todas' ||
                          carrerasLoading ||
                          draftCarreras.length === 0
                        }
                      />
                    </ListFilterSection>
                    <ListFilterSection title="Plan de estudio">
                      <Filtro
                        options={draftPlanOptions}
                        value={draft.plan}
                        onChange={(plan) =>
                          setDraft((previous) => ({ ...previous, plan }))
                        }
                        ariaLabel="Filtrar por plan"
                        disabled={draftPlanOptions.length <= 1}
                      />
                    </ListFilterSection>
                    <ListFilterSection title="Tipo de asignatura">
                      <Filtro
                        options={TIPO_OPTIONS}
                        value={draft.tipo}
                        onChange={(tipo) =>
                          setDraft((previous) => ({ ...previous, tipo }))
                        }
                        ariaLabel="Filtrar por tipo"
                      />
                    </ListFilterSection>
                    <ListFilterSection title="Estado">
                      <Filtro
                        options={ESTADO_OPTIONS}
                        value={draft.estado}
                        onChange={(estado) =>
                          setDraft((previous) => ({ ...previous, estado }))
                        }
                        ariaLabel="Filtrar por estado"
                      />
                    </ListFilterSection>
                    <ListFilterSection title="Archivo">
                      <Label className="border-border flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm">
                        <Checkbox
                          checked={draft.incluirArchivadas}
                          onCheckedChange={(checked) =>
                            setDraft((previous) => ({
                              ...previous,
                              incluirArchivadas: checked === true,
                            }))
                          }
                        />
                        Incluir asignaturas archivadas
                      </Label>
                    </ListFilterSection>
                  </>
                )
              }}
            </ListFiltersDialog>
          </>
        }
        view={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={
                  search.modo === 'lista'
                    ? 'Cambiar a vista de cuadrícula'
                    : 'Cambiar a vista de lista'
                }
                onClick={() =>
                  navigate({
                    search: (previous) => ({
                      ...previous,
                      modo: previous.modo === 'lista' ? 'grid' : 'lista',
                    }),
                    resetScroll: false,
                  })
                }
              >
                {search.modo === 'lista' ? (
                  <LayoutGrid className="size-4" />
                ) : (
                  <List className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {search.modo === 'lista'
                ? 'Ver como cuadrícula'
                : 'Ver como lista'}
            </TooltipContent>
          </Tooltip>
        }
      />

      {/* Resultados */}
      <section
        className={cn(
          search.modo === 'lista' &&
            'border-border bg-card dark:bg-background overflow-hidden rounded-[calc(var(--radius)_-_0.35rem)] border shadow-xs dark:shadow-none',
          isPlaceholderData && 'opacity-60',
        )}
      >
        {isLoading ? (
          <CatalogoSkeletonList modo={search.modo} />
        ) : isError ? (
          <div className="text-destructive px-4 py-12 text-center text-sm">
            Ocurrió un error al cargar el catálogo.
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground px-4 py-12 text-center text-sm">
            No se encontraron asignaturas con estos filtros.
          </div>
        ) : (
          <div
            role="list"
            aria-label="Asignaturas visibles"
            className={cn(
              search.modo === 'grid' &&
                'masonry-grid masonry-grid--catalogo-asignaturas',
            )}
          >
            {rows.map((row) => (
              <div key={row.asignatura_id} role="listitem">
                <CatalogoAsignaturaItem row={row} modo={search.modo} />
              </div>
            ))}
          </div>
        )}
      </section>

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
