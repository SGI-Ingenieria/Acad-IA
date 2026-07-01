import {
  createFileRoute,
  Link,
  Outlet,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import {
  Plus,
  Search,
  Filter,
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
import { nombreTipoCiclo } from '@/lib/ciclo-utils'
import {
  defaultArchivadasSearch,
  defaultAsignaturasSearch,
} from '@/types/search'

const parseAsignaturasSearch = (
  search: Record<string, unknown>,
): AsignaturasSearch => ({
  q: typeof search.q === 'string' ? search.q : defaultAsignaturasSearch.q,
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
})

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
  const { q, tipo, estado, linea } = Route.useSearch()
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
  const { data: lineasApi, isLoading: loadingLineas } = usePlanLineas(planId)
  const tipoCiclo = plan?.tipo_ciclo

  // 3. Procesamiento de datos
  const asignaturas = useMemo(
    () => mapAsignaturas(asignaturaApi as Array<Tables<'asignaturas'>>),
    [asignaturaApi],
  )
  const visibleAsignaturas = useMemo(
    () => asignaturas.filter((m) => m.estado !== 'archivada'),
    [asignaturas],
  )
  const archivedCount = asignaturas.length - visibleAsignaturas.length
  const lineas = useMemo(() => lineasApi || [], [lineasApi])

  const filteredAsignaturas = visibleAsignaturas.filter((m) => {
    const matchesSearch =
      m.nombre.toLowerCase().includes(q.toLowerCase()) ||
      m.clave.toLowerCase().includes(q.toLowerCase())
    const matchesTipo = tipo === 'all' || m.tipo === tipo
    const matchesEstado = estado === 'all' || m.estado === estado
    const matchesLinea = linea === 'all' || m.lineaCurricularId === linea

    return matchesSearch && matchesTipo && matchesEstado && matchesLinea
  })

  const getLinea = (lineaId: string | null) => {
    if (!lineaId) return null
    return lineas.find((l: any) => l.id === lineaId) ?? null
  }

  if (loadingAsig || loadingLineas) {
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
      {/* Header */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-4">
        <div className="min-w-0">
          <h2 className="text-foreground text-xl font-bold">
            Asignaturas del Plan
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {visibleAsignaturas.length} asignaturas activas •{' '}
            {filteredAsignaturas.length} filtradas
            {archivedCount > 0 ? ` • ${archivedCount} archivadas` : ''}
          </p>
        </div>

        {canEditAsignaturas && (
          <div className="flex justify-start lg:justify-end">
            <Button
              onClick={() => {
                navigate({
                  to: '/planes/$planId/asignaturas/nueva',
                  params: { planId },
                  search: (prev) => prev,
                  resetScroll: false,
                })
              }}
              className="shadow-md"
            >
              <Plus className="mr-2 h-4 w-4" /> Nueva Asignatura
            </Button>
          </div>
        )}
      </div>

      {/* Barra de Filtros Avanzada */}
      <div className="bg-muted/30 border-border grid gap-3 rounded-xl border p-4 xl:grid-cols-[minmax(16rem,1fr)_auto] xl:items-center">
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
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Filter className="text-muted-foreground mr-1 h-4 w-4" />

          <Select
            value={tipo}
            onValueChange={(v) =>
              navigate({
                search: (prev) => ({ ...prev, tipo: v }),
                resetScroll: false,
              })
            }
          >
            <SelectTrigger className="bg-background w-35">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="obligatoria">Obligatoria</SelectItem>
              <SelectItem value="optativa">Optativa</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={estado}
            onValueChange={(v) =>
              navigate({
                search: (prev) => ({ ...prev, estado: v }),
                resetScroll: false,
              })
            }
          >
            <SelectTrigger className="bg-background w-35">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="revisada">Revisada</SelectItem>
              <SelectItem value="aprobada">Aprobada</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={linea}
            onValueChange={(v) =>
              navigate({
                search: (prev) => ({ ...prev, linea: v }),
                resetScroll: false,
              })
            }
          >
            <SelectTrigger className="bg-background w-45">
              <SelectValue placeholder="Línea" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las líneas</SelectItem>
              {lineas.map((l: any) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="icon"
                variant="outline"
                className="border-border/70 bg-background h-9 w-9 shrink-0 rounded-full"
                aria-label="Ver asignaturas archivadas"
              >
                <Link
                  to="/planes/$planId/asignaturas/archivadas"
                  params={{ planId }}
                  search={defaultArchivadasSearch}
                >
                  <Archive className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver archivadas</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Tabla Pro */}
      <div className="bg-background overflow-hidden rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="w-30 px-6 py-4">Clave</TableHead>
              <TableHead className="px-6 py-4">Nombre</TableHead>
              <TableHead className="px-6 py-4 text-center">Créditos</TableHead>
              <TableHead className="px-6 py-4 text-center">
                {nombreTipoCiclo(tipoCiclo)}
              </TableHead>
              <TableHead className="px-6 py-4">Línea Curricular</TableHead>
              <TableHead className="px-6 py-4">Tipo</TableHead>
              <TableHead className="px-6 py-4">Estado</TableHead>
              {canEditAsignaturas && (
                <TableHead className="w-12.5 px-6 py-4 text-right">
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
                        No se encontraron asignaturas
                      </p>
                      <p className="mt-1 text-xs">
                        Intenta cambiar los filtros de búsqueda
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAsignaturas.map((asignatura) => (
                <TableRow
                  key={asignatura.id}
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
                  <TableCell className="text-muted-foreground px-6 py-4 font-mono text-xs font-bold">
                    {asignatura.clave}
                  </TableCell>
                  <TableCell className="text-foreground px-6 py-4 font-semibold">
                    {asignatura.nombre}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center font-medium">
                    {asignatura.creditos}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center">
                    {asignatura.ciclo ? (
                      <Badge variant="outline" className="font-normal">
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
                          <span className="text-muted-foreground text-sm">
                            {nombre}
                          </span>
                        )
                      }
                      return (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
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
                      className="capitalize shadow-sm"
                    >
                      {asignaturaTipoConfig[asignatura.tipo].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge
                      variant={
                        asignaturaStatusConfig[asignatura.estado].variant
                      }
                      className={`capitalize shadow-sm ${asignaturaStatusConfig[asignatura.estado].className ?? ''}`}
                    >
                      {asignaturaStatusConfig[asignatura.estado].label}
                    </Badge>
                  </TableCell>
                  {canEditAsignaturas && (
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        {asignatura.estado !== 'archivada' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setArchivingSubject(asignatura)
                                }}
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Archivar asignatura</TooltipContent>
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
