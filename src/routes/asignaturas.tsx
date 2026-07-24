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
    row.facultad_nombre_corto.trim() || row.facultad_nombre
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
              {row.numero_ciclo != null
                ? formatCiclo(row.plan_tipo_ciclo, row.numero_ciclo)
                : `${nombreTipoCiclo(row.plan_tipo_ciclo)} —`}
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
      />

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
