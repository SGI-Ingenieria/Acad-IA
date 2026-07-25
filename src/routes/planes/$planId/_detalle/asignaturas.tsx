import {
  createFileRoute,
  Outlet,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import {
  Plus,
  Search,
  ChevronRight,
  BookOpen,
  Loader2,
  Archive,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Asignatura } from '@/types/plan'
import type { AsignaturasSearch } from '@/types/search'
import type { Tables } from '@/types/supabase'

import { mapAsignaturas } from '@/components/asignaturas/asignaturaMappers'
import {
  asignaturaStatusConfig,
  asignaturaTipoConfig,
} from '@/components/asignaturas/asignaturaTableConfig'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ListFilterSection,
  ListFiltersDialog,
  ListSortMenu,
  ListToolbar,
} from '@/components/ui/list-controls'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  usePlan,
  usePlanAsignaturas,
  usePlanLineas,
  useUpdateAsignatura,
} from '@/data'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import {
  planAsignaturasOptions,
  planLineasOptions,
} from '@/data/query/queryOptions'
import { TiraPostIts } from '@/features/agente'
import { nombreTipoCiclo } from '@/lib/ciclo-utils'
import { defaultAsignaturasSearch } from '@/types/search'

const parseAsignaturasSearch = (
  search: Record<string, unknown>,
): AsignaturasSearch => ({
  q: typeof search.q === 'string' ? search.q : defaultAsignaturasSearch.q,
  archivo:
    search.archivo === 'archivadas'
      ? 'archivadas'
      : defaultAsignaturasSearch.archivo,
  tipo:
    typeof search.tipo === 'string'
      ? search.tipo
      : defaultAsignaturasSearch.tipo,
  estado:
    typeof search.estado === 'string'
      ? search.estado
      : defaultAsignaturasSearch.estado,
  linea:
    typeof search.linea === 'string'
      ? search.linea
      : defaultAsignaturasSearch.linea,
  orden:
    search.orden === 'actualizado_desc' ||
    search.orden === 'nombre_asc' ||
    search.orden === 'nombre_desc' ||
    search.orden === 'creditos_desc'
      ? search.orden
      : defaultAsignaturasSearch.orden,
})

const ASIGNATURAS_SORT_OPTIONS = [
  { value: 'curricular', label: 'Secuencia curricular' },
  { value: 'actualizado_desc', label: 'Actualización reciente' },
  { value: 'nombre_asc', label: 'Nombre A–Z' },
  { value: 'nombre_desc', label: 'Nombre Z–A' },
  { value: 'creditos_desc', label: 'Mayor número de créditos' },
] as const

const TIPO_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'obligatoria', label: 'Obligatoria' },
  { value: 'optativa', label: 'Optativa' },
] as const

const ESTADO_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'revisada', label: 'Revisada' },
  { value: 'aprobada', label: 'Aprobada' },
] as const

export const Route = createFileRoute('/planes/$planId/_detalle/asignaturas')({
  validateSearch: parseAsignaturasSearch,
  search: {
    middlewares: [stripSearchParams(defaultAsignaturasSearch)],
  },
  // No bloqueante: la tabla muestra su propio estado de carga.
  loader: ({ context: { queryClient }, params: { planId } }) => {
    void queryClient.prefetchQuery(planAsignaturasOptions(planId))
    void queryClient.prefetchQuery(planLineasOptions(planId))
  },
  component: AsignaturasPage,
})

function AsignaturasPage() {
  const { planId } = Route.useParams()
  const { q, archivo, tipo, estado, linea, orden } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [archivingSubject, setArchivingSubject] = useState<Asignatura | null>(
    null,
  )
  const archiveMutation = useUpdateAsignatura()

  // 1. Fetch de datos reales
  const { data: plan } = usePlan(planId)
  const capabilities = usePlanCapabilities(plan)
  const canEditAsignaturas = capabilities.canEditAsignaturas
  const { data: asignaturaApi, isLoading: loadingAsig } =
    usePlanAsignaturas(planId)
  const { data: archivedApi, isLoading: loadingArchived } = usePlanAsignaturas(
    planId,
    'archivadas',
  )
  const { data: lineasApi, isLoading: loadingLineas } = usePlanLineas(planId)
  const tipoCiclo = plan?.tipo_ciclo

  // 3. Procesamiento de datos
  const asignaturas = useMemo(
    () => mapAsignaturas(asignaturaApi as Array<Tables<'asignaturas'>>),
    [asignaturaApi],
  )
  const archivedAsignaturas = useMemo(
    () => mapAsignaturas(archivedApi as Array<Tables<'asignaturas'>>),
    [archivedApi],
  )
  const lineas = useMemo(() => lineasApi || [], [lineasApi])

  const filteredAsignaturas = (
    archivo === 'archivadas' ? archivedAsignaturas : asignaturas
  )
    .filter((m) => {
      const matchesSearch =
        m.nombre.toLowerCase().includes(q.toLowerCase()) ||
        m.clave.toLowerCase().includes(q.toLowerCase())
      const matchesTipo = tipo === 'all' || m.tipo === tipo
      const matchesEstado = estado === 'all' || m.estado === estado
      const matchesLinea = linea === 'all' || m.lineaCurricularId === linea

      return matchesSearch && matchesTipo && matchesEstado && matchesLinea
    })
    .sort((left, right) => {
      if (orden === 'actualizado_desc') {
        return String(right.actualizadoEn ?? '').localeCompare(
          String(left.actualizadoEn ?? ''),
        )
      }
      if (orden === 'nombre_asc')
        return left.nombre.localeCompare(right.nombre, 'es')
      if (orden === 'nombre_desc')
        return right.nombre.localeCompare(left.nombre, 'es')
      if (orden === 'creditos_desc') return right.creditos - left.creditos
      return (
        (left.ciclo ?? Number.MAX_SAFE_INTEGER) -
          (right.ciclo ?? Number.MAX_SAFE_INTEGER) ||
        left.nombre.localeCompare(right.nombre, 'es')
      )
    })

  const getLinea = (lineaId: string | null) => {
    if (!lineaId) return null
    return lineas.find((l: any) => l.id === lineaId) ?? null
  }

  const subjectFilterValue = { archivo, tipo, estado, linea }
  const subjectFilterDefaults = {
    archivo: defaultAsignaturasSearch.archivo,
    tipo: defaultAsignaturasSearch.tipo,
    estado: defaultAsignaturasSearch.estado,
    linea: defaultAsignaturasSearch.linea,
  }
  const subjectActiveFilterCount = [
    archivo !== defaultAsignaturasSearch.archivo,
    tipo !== defaultAsignaturasSearch.tipo,
    archivo === 'activas' && estado !== defaultAsignaturasSearch.estado,
    linea !== defaultAsignaturasSearch.linea,
  ].filter(Boolean).length

  if (loadingAsig || loadingArchived || loadingLineas) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  const handleArchiveConfirm = async () => {
    if (!archivingSubject) return
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'archivar una asignatura fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    await archiveMutation.mutateAsync({
      asignaturaId: archivingSubject.id,
      patch: { estado: 'archivada' },
      adminOverrideReason,
    })
    setArchivingSubject(null)
  }

  return (
    <div className="w-full space-y-6">
      <div className="border-border bg-background overflow-hidden rounded-[var(--radius)] border">
        <ListToolbar
          className="bg-muted/20 border-border border-b p-3"
          search={
            <div className="relative min-w-0">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nombre o clave..."
                value={q}
                onChange={(e) =>
                  navigate({
                    search: (prev) => ({ ...prev, q: e.target.value }),
                    replace: true,
                    resetScroll: false,
                  })
                }
                className="bg-background pl-9"
                aria-label="Buscar asignaturas del plan"
              />
            </div>
          }
          actions={
            <>
              <ListSortMenu
                value={orden}
                defaultValue={defaultAsignaturasSearch.orden}
                options={[...ASIGNATURAS_SORT_OPTIONS]}
                onValueChange={(nextOrden) =>
                  navigate({
                    search: (prev) => ({ ...prev, orden: nextOrden }),
                    resetScroll: false,
                  })
                }
                label="Ordenar asignaturas del plan"
              />
              <ListFiltersDialog
                title="Filtrar asignaturas del plan"
                value={subjectFilterValue}
                defaultValue={subjectFilterDefaults}
                activeCount={subjectActiveFilterCount}
                onApply={(next, { resetAll }) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      q: resetAll ? '' : prev.q,
                      orden: resetAll
                        ? defaultAsignaturasSearch.orden
                        : prev.orden,
                      ...next,
                      estado:
                        next.archivo === 'archivadas' ? 'all' : next.estado,
                    }),
                    resetScroll: false,
                  })
                }
                label="Filtrar asignaturas del plan"
              >
                {(draft, setDraft) => (
                  <>
                    <ListFilterSection title="Conjunto">
                      <RadioGroup
                        value={draft.archivo}
                        onValueChange={(nextArchivo) =>
                          setDraft((previous) => ({
                            ...previous,
                            archivo: nextArchivo as 'activas' | 'archivadas',
                            estado:
                              nextArchivo === 'archivadas'
                                ? 'all'
                                : previous.estado,
                          }))
                        }
                      >
                        <Label className="border-border flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3">
                          <RadioGroupItem value="activas" />
                          Activas
                        </Label>
                        <Label className="border-border flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3">
                          <RadioGroupItem value="archivadas" />
                          Archivadas
                        </Label>
                      </RadioGroup>
                    </ListFilterSection>
                    <ListFilterSection title="Tipo">
                      <Select
                        value={draft.tipo}
                        onValueChange={(nextTipo) =>
                          setDraft((previous) => ({
                            ...previous,
                            tipo: nextTipo,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ListFilterSection>
                    {draft.archivo === 'activas' ? (
                      <ListFilterSection title="Estado">
                        <Select
                          value={draft.estado}
                          onValueChange={(nextEstado) =>
                            setDraft((previous) => ({
                              ...previous,
                              estado: nextEstado,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ESTADO_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ListFilterSection>
                    ) : null}
                    <ListFilterSection title="Línea curricular">
                      <Select
                        value={draft.linea}
                        onValueChange={(nextLinea) =>
                          setDraft((previous) => ({
                            ...previous,
                            linea: nextLinea,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas las líneas</SelectItem>
                          {lineas.map((item: any) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ListFilterSection>
                  </>
                )}
              </ListFiltersDialog>
              {canEditAsignaturas && (
                <Button
                  className="ml-auto sm:ml-0"
                  onClick={() => {
                    navigate({
                      to: '/planes/$planId/asignaturas/nueva',
                      params: { planId },
                      search: (prev) => prev,
                      resetScroll: false,
                    })
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Nueva asignatura
                </Button>
              )}
            </>
          }
        />

        <TiraPostIts planId={planId} />

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="text-muted-foreground">
              <TableRow className="bg-muted/20">
                <TableHead className="w-30 px-6 py-3 text-xs font-semibold tracking-wide uppercase">
                  Clave
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-semibold tracking-wide uppercase">
                  Nombre
                </TableHead>
                <TableHead className="px-6 py-3 text-center text-xs font-semibold tracking-wide uppercase">
                  Créditos
                </TableHead>
                <TableHead className="px-6 py-3 text-center text-xs font-semibold tracking-wide uppercase">
                  {nombreTipoCiclo(tipoCiclo)}
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-semibold tracking-wide uppercase">
                  Línea curricular
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-semibold tracking-wide uppercase">
                  Tipo
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-semibold tracking-wide uppercase">
                  Estado
                </TableHead>
                {canEditAsignaturas && (
                  <TableHead className="w-12.5 px-6 py-3 text-right text-xs font-semibold tracking-wide uppercase">
                    Acciones
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAsignaturas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canEditAsignaturas ? 8 : 7}
                    className="h-40 px-6 py-8 text-center"
                  >
                    <div className="text-muted-foreground flex flex-col items-center justify-center gap-3">
                      <BookOpen className="h-10 w-10 opacity-20" />
                      <div>
                        <p className="font-medium">
                          {(archivo === 'archivadas'
                            ? archivedAsignaturas
                            : asignaturas
                          ).length === 0
                            ? archivo === 'archivadas'
                              ? 'No hay asignaturas archivadas'
                              : 'Este plan todavía no tiene asignaturas'
                            : 'Ninguna asignatura coincide con la búsqueda'}
                        </p>
                        <p className="mt-1 text-sm">
                          {(archivo === 'archivadas'
                            ? archivedAsignaturas
                            : asignaturas
                          ).length === 0
                            ? archivo === 'archivadas'
                              ? 'Las asignaturas que archives aparecerán aquí.'
                              : 'Agrega la primera asignatura para comenzar a construir la secuencia curricular.'
                            : 'Prueba con otros términos o ajusta los filtros activos.'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAsignaturas.map((asignatura) => (
                  <TableRow
                    key={asignatura.id}
                    // Destino del vuelo del post-it del modo agente: la fila
                    // optimista se localiza por este id temporal.
                    data-asignatura-id={asignatura.id}
                    className="group hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() =>
                      navigate({
                        to: '/planes/$planId/asignaturas/$asignaturaId',
                        params: {
                          planId,
                          asignaturaId: asignatura.id,
                        },
                        state: {
                          realId: asignatura.id,
                          asignaturaId: asignatura.id,
                        } as any,
                      })
                    }
                  >
                    <TableCell className="text-muted-foreground px-6 py-4 font-mono text-sm font-medium tracking-wide">
                      {asignatura.clave}
                    </TableCell>
                    <TableCell className="text-foreground min-w-56 px-6 py-4 text-base leading-snug font-semibold whitespace-normal">
                      {asignatura.nombre}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center text-base font-semibold tabular-nums">
                      {asignatura.creditos}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center">
                      {asignatura.ciclo ? (
                        <Badge
                          variant="outline"
                          className="text-sm font-medium tabular-nums"
                        >
                          {asignatura.ciclo}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {(() => {
                        const lineaItem = getLinea(asignatura.lineaCurricularId)
                        const nombre = lineaItem?.nombre ?? 'Sin asignar'
                        const color = lineaItem?.color
                        if (!color) {
                          return (
                            <span className="text-muted-foreground text-sm font-medium">
                              {nombre}
                            </span>
                          )
                        }
                        return (
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium"
                            style={{
                              backgroundColor: `${color}22`,
                              color,
                              border: `1px solid ${color}55`,
                            }}
                          >
                            {nombre}
                          </span>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge
                        variant={asignaturaTipoConfig[asignatura.tipo].variant}
                        className="text-sm font-medium capitalize"
                      >
                        {asignaturaTipoConfig[asignatura.tipo].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge
                        variant={
                          asignaturaStatusConfig[asignatura.estado].variant
                        }
                        className={`text-sm font-medium capitalize ${asignaturaStatusConfig[asignatura.estado].className ?? ''}`}
                      >
                        {asignaturaStatusConfig[asignatura.estado].label}
                      </Badge>
                    </TableCell>
                    {canEditAsignaturas && (
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                          {asignatura.estado !== 'archivada' ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`Archivar ${asignatura.nombre}`}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setArchivingSubject(asignatura)
                                  }}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Archivar asignatura
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                          <ChevronRight className="text-muted-foreground h-5 w-5" />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <AlertDialog
        open={Boolean(archivingSubject)}
        onOpenChange={(open) => {
          if (!open) {
            setArchivingSubject(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar asignatura</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a archivar{' '}
              <span className="text-foreground font-semibold">
                {archivingSubject?.nombre}
              </span>
              . Esta asignatura dejará de mostrarse en el plan y solo estará
              disponible en la sección de asignaturas archivadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveConfirm}
              disabled={archiveMutation.isPending}
            >
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Outlet />
    </div>
  )
}
