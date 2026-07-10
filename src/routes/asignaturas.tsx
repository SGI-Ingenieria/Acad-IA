import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import {
  Archive,
  BookOpenText,
  Building2,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  FilePenLine,
  FileText,
  GitBranch,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  Search,
  SearchCheck,
  Shapes,
  Shuffle,
  TriangleAlert,
  UserRoundCheck,
  Users,
  X,
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

function TipoIcon({ tipo }: { tipo: CatalogoAsignaturaRow['tipo'] }) {
  if (tipo === 'OBLIGATORIA') return <LockKeyhole className="h-4 w-4" />
  if (tipo === 'OPTATIVA') return <Shuffle className="h-4 w-4" />
  if (tipo === 'TRONCAL') return <GitBranch className="h-4 w-4" />
  return <Shapes className="h-4 w-4" />
}

function EstadoIcon({ estado }: { estado: CatalogoAsignaturaRow['estado'] }) {
  if (estado === 'borrador') return <FilePenLine className="h-4 w-4" />
  if (estado === 'revisada') return <SearchCheck className="h-4 w-4" />
  if (estado === 'aprobada') return <CircleCheck className="h-4 w-4" />
  if (estado === 'archivada') return <Archive className="h-4 w-4" />
  if (estado === 'generando')
    return <LoaderCircle className="h-4 w-4 animate-spin" />
  return <TriangleAlert className="h-4 w-4" />
}

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
  onSelect,
}: {
  row: CatalogoAsignaturaRow
  onSelect: () => void
}) {
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
    row.facultad_nombre_corto?.trim() || row.facultad_nombre
  const esCurricular = row.plan_tipo_estructura === 'CURRICULAR'

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Abrir asignatura ${row.nombre}`}
      className="organic-interactive group border-border/60 bg-background hover:bg-muted/30 focus-visible:ring-ring focus-visible:ring-offset-background grid w-full gap-4 border-b px-4 py-5 text-left transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:grid-cols-[minmax(200px,0.8fr)_minmax(280px,1.5fr)_minmax(190px,0.7fr)] md:items-center md:gap-6 md:px-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="border-primary/15 bg-primary/8 text-primary group-hover:bg-primary/12 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
          <FileText className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>

        <div className="min-w-0">
          <p className="text-foreground text-[15px] leading-snug font-semibold md:line-clamp-2">
            {row.nombre}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold">
              {row.codigo ?? 'Sin clave'}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {row.creditos} créditos
            </span>
            <span className="text-muted-foreground text-[11px]">
              Ciclo {row.numero_ciclo ?? '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <GraduationCap className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-foreground/90 text-sm leading-snug font-medium md:line-clamp-2">
              {row.plan_nombre}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 pl-6">
          {!esCurricular ? (
            <span className="text-muted-foreground max-w-full truncate text-xs">
              {row.carrera_nombre}
            </span>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="border-border bg-muted/35 text-muted-foreground inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
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
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 md:items-end">
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="border-border text-muted-foreground flex h-8 w-8 items-center justify-center rounded-md border">
                <TipoIcon tipo={row.tipo} />
              </span>
            </TooltipTrigger>
            <TooltipContent>{tipo.label}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="border-border text-muted-foreground flex h-8 w-8 items-center justify-center rounded-md border">
                <EstadoIcon estado={row.estado} />
              </span>
            </TooltipTrigger>
            <TooltipContent>{estado.label}</TooltipContent>
          </Tooltip>
        </div>

        {rolesAcceso.length > 0 ? (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs md:justify-end">
            {rolesAcceso.map(({ label, icon: Icon }, i) => (
              <span
                key={`${label}-${i}`}
                className="inline-flex items-center gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  )
}

function CatalogoSkeletonList() {
  return (
    <div className="divide-border/70 divide-y">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="grid gap-4 px-4 py-5 md:grid-cols-[minmax(200px,0.8fr)_minmax(280px,1.5fr)_minmax(190px,0.7fr)] md:items-center md:gap-6 md:px-5"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-6 w-32 rounded-md" />
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
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

  const carreraOptions = useMemo((): Array<Option | OptionGroup> => {
    if (!hasSelectedFacultad || carreras.length === 0) return []

    return [
      { value: 'todas', label: 'Todas las carreras' },
      ...NIVEL_ORDEN.map((nivel) => ({
        label: nivel,
        options: carreras
          .filter((carrera) => carrera.nivel === nivel)
          .map((carrera) => ({ value: carrera.id, label: carrera.nombre })),
      })).filter((grupo) => grupo.options.length > 0),
    ]
  }, [carreras, hasSelectedFacultad])

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
  }, [carreras, carrerasLoading, hasSelectedFacultad, navigate, search.carrera])

  const planOptions = useMemo(
    () => [
      { value: 'todos', label: 'Todos los planes' },
      ...(planesData?.data ?? []).map((p) => ({
        value: p.id,
        label: getPlanDisplayName(p),
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
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Buscar por nombre, clave o contenido…"
              className="h-11 pl-9"
              aria-label="Buscar asignaturas"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isLoading && (
              <p className="text-muted-foreground text-sm">
                {total} {total === 1 ? 'asignatura' : 'asignaturas'}
              </p>
            )}

            {!isClearDisabled && (
              <button
                type="button"
                onClick={() =>
                  navigate({
                    search: () => ({ ...defaultCatalogoAsignaturasSearch }),
                    resetScroll: false,
                  })
                }
                className="text-muted-foreground hover:text-foreground border-border hover:bg-muted/40 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors"
              >
                <X className="h-4 w-4" /> Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <div className="w-full lg:w-48">
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
          <div className="w-full lg:w-48">
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
          <div className="w-full lg:w-48">
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
          <div className="w-full lg:w-44">
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
          <div className="w-full lg:w-44">
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

          <Label className="border-border flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm lg:border-0 lg:px-1">
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
        </div>
      </div>

      {/* Lista */}
      <section
        className={cn(
          'border-border bg-background overflow-hidden rounded-[calc(var(--radius)_-_0.35rem)] border',
          isPlaceholderData && 'opacity-60',
        )}
      >
        {isLoading ? (
          <CatalogoSkeletonList />
        ) : isError ? (
          <div className="text-destructive px-4 py-12 text-center text-sm">
            Ocurrió un error al cargar el catálogo.
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground px-4 py-12 text-center text-sm">
            No se encontraron asignaturas con estos filtros.
          </div>
        ) : (
          <div role="list" aria-label="Asignaturas visibles">
            {rows.map((row) => (
              <div key={row.asignatura_id} role="listitem">
                <CatalogoAsignaturaItem
                  row={row}
                  onSelect={() => handleRowClick(row)}
                />
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
