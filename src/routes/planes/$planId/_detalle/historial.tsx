import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  GitBranch,
  Edit3,
  PlusCircle,
  User,
  Loader2,
  Clock,
  History,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  BookOpen,
  FileText,
  Layers3,
  Map as MapIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type { HistorialSearch } from '@/types/search'
import type { ReactElement } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEstadosPlan } from '@/data/hooks/useMeta'
import {
  useCatalogosPlanes,
  usePlan,
  usePlanAsignaturas,
  usePlanHistorial,
  usePlanLineas,
  useRestorePlanHistoryValue,
} from '@/data/hooks/usePlans'
import { planHistorialOptions } from '@/data/query/queryOptions'
import {
  areHistoryValuesEqual,
  formatHistoryFieldLabel,
  getHistoryGroupForChange,
  toHistoryDisplayValue,
} from '@/lib/history-display'
import { cn } from '@/lib/utils'
import { defaultHistorialSearch } from '@/types/search'

const parseHistorialSearch = (
  search: Record<string, unknown>,
): HistorialSearch => {
  const raw =
    typeof search.page === 'number' || typeof search.page === 'string'
      ? Number(search.page)
      : 0
  const page = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0
  return { page }
}

export const Route = createFileRoute('/planes/$planId/_detalle/historial')({
  validateSearch: parseHistorialSearch,
  search: {
    middlewares: [stripSearchParams(defaultHistorialSearch)],
  },
  // No bloqueante: la lista muestra su propio estado de carga.
  loader: ({ context: { queryClient }, params: { planId } }) => {
    void queryClient.prefetchQuery(planHistorialOptions(planId, 0))
  },
  component: RouteComponent,
})

const getEventConfig = (
  tipo: string,
  campo: string | null,
  source: 'plan' | 'asignatura',
) => {
  const group = getHistoryGroupForChange({ source, tipo, campo })

  if (tipo === 'CREACION' && source === 'plan')
    return {
      label: 'Creación del plan',
      group,
      icon: <PlusCircle className="h-4 w-4" />,
      color: 'primary',
    }

  if (tipo === 'CREACION' && source === 'asignatura')
    return {
      label: 'Asignatura agregada',
      group,
      icon: <BookOpen className="h-4 w-4" />,
      color: 'accent',
    }

  if (group.id === 'transiciones')
    return {
      label:
        source === 'plan' ? 'Transición del plan' : 'Transición de asignatura',
      group,
      icon: <GitBranch className="h-4 w-4" />,
      color: 'secondary',
    }

  if (group.id === 'mapa_curricular')
    return {
      label: 'Mapa curricular',
      group,
      icon: <MapIcon className="h-4 w-4" />,
      color: 'accent',
    }

  if (group.id === 'cambios_asignatura')
    return {
      label: 'Cambio de asignatura',
      group,
      icon: <BookOpen className="h-4 w-4" />,
      color: 'accent',
    }

  if (group.id === 'estructura_plan')
    return {
      label: 'Estructura del plan',
      group,
      icon: <Layers3 className="h-4 w-4" />,
      color: 'muted',
    }

  if (group.id === 'detalles_plan')
    return {
      label: 'Detalles del plan',
      group,
      icon: <FileText className="h-4 w-4" />,
      color: 'muted',
    }

  return {
    label: 'Datos básicos del plan',
    group,
    icon: <Edit3 className="h-4 w-4" />,
    color: 'muted',
  }
}

const HISTORY_GROUP_ORDER = [
  'datos_basicos_plan',
  'detalles_plan',
  'estructura_plan',
  'mapa_curricular',
  'cambios_asignatura',
  'transiciones',
] as const

function RouteComponent() {
  const { planId } = Route.useParams()
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const pageSize = 4
  const { data: response, isLoading } = usePlanHistorial(planId, page)
  const rawData = useMemo(() => response?.data ?? [], [response])
  const totalRecords = response?.count ?? 0
  const totalPages = Math.ceil(totalRecords / pageSize)
  const { data } = usePlan(planId)
  const { data: estados } = useEstadosPlan()
  const { data: catalogos } = useCatalogosPlanes()
  const { data: lineas } = usePlanLineas(planId)
  const { data: asignaturas } = usePlanAsignaturas(planId)
  const restorePlanHistoryValue = useRestorePlanHistoryValue()
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const structure = useMemo<any>(
    () => (data?.estructuras_plan?.definicion as any)?.properties ?? null,
    [data],
  )

  const estadosById = useMemo(
    () => new Map((estados ?? []).map((e) => [e.id, e.etiqueta])),
    [estados],
  )

  const referenceCatalog = useMemo(
    () => ({
      estados: (estados ?? []).map((estado) => ({
        id: estado.id,
        label: estado.etiqueta,
      })),
      carreras: (catalogos?.carreras ?? []).map((carrera) => ({
        id: carrera.id,
        label: carrera.nombre,
      })),
      facultades: (catalogos?.facultades ?? []).map((facultad) => ({
        id: facultad.id,
        label: facultad.nombre,
      })),
      estructuras: (catalogos?.estructurasPlan ?? []).map((estructura) => ({
        id: estructura.id,
        label: estructura.nombre,
      })),
      lineas: (lineas ?? []).map((linea) => ({
        id: linea.id,
        label: linea.nombre,
      })),
      asignaturas: (asignaturas ?? []).map((asignatura) => ({
        id: asignatura.id,
        label: asignatura.nombre,
      })),
    }),
    [asignaturas, catalogos, estados, lineas],
  )

  const historyEvents = useMemo(() => {
    // Las transiciones se registran con campo 'estado_actual_id' y guardan los
    // UUID de estado: los traducimos a etiqueta y normalizamos a 'estado' para
    // que el render de transición (badges/modal) los reconozca.
    const estadoLabel = (v: unknown) => {
      const resolved =
        typeof v === 'string' && estadosById.has(v)
          ? estadosById.get(v)
          : toHistoryDisplayValue(v, referenceCatalog, 'estado_actual_id')
      return typeof resolved === 'string' ? resolved : 'Sin estado'
    }

    const subjectLabel = (item: any) => {
      const asignatura = item.asignaturas
      const nombre =
        asignatura?.nombre ??
        (typeof item.asignatura_id === 'string'
          ? referenceCatalog.asignaturas.find(
              (a) => a.id === item.asignatura_id,
            )?.label
          : null)
      const codigo = asignatura?.codigo

      if (!nombre) return 'Asignatura'
      return codigo ? `${nombre} (${codigo})` : nombre
    }

    return rawData.map((item: any) => {
      const source = item.source === 'asignatura' ? 'asignatura' : 'plan'
      const isEstado =
        item.campo === 'estado' || item.campo === 'estado_actual_id'
      const config = getEventConfig(item.tipo, item.campo, source)
      const campo = isEstado ? 'estado_actual_id' : item.campo
      const displayCampo = isEstado
        ? 'Estado'
        : (structure?.[item.campo]?.title ??
          formatHistoryFieldLabel(item.campo))
      const subjectName = source === 'asignatura' ? subjectLabel(item) : null
      const isReadOnly =
        isEstado || item.tipo === 'TRANSICION_ESTADO' || source === 'asignatura'
      const canApply =
        source === 'plan' &&
        item.tipo !== 'CREACION' &&
        !isEstado &&
        item.tipo !== 'TRANSICION_ESTADO'
      const description = isEstado
        ? source === 'plan'
          ? 'Cambio de estado del plan'
          : `${subjectName}: cambio de estado de la asignatura`
        : source === 'asignatura'
          ? item.tipo === 'CREACION'
            ? `Se agregó ${subjectName} al plan`
            : `${subjectName}: se modificó ${displayCampo}`
          : item.campo === 'datos'
            ? `Actualización general de: ${item.valor_nuevo?.nombre || 'información del plan'}`
            : `Se modificó ${displayCampo}`

      return {
        id: item.id,
        source,
        group: config.group,
        type: config.label,
        tipoOriginal: item.tipo,
        user:
          item.usuarios_app?.nombre_completo ??
          (item.cambiado_por === '11111111-1111-1111-1111-111111111111'
            ? 'Administrador'
            : item.fuente === 'IA' || item.interaccion_ia_id
              ? 'Sistema IA'
              : 'Sistema'),
        description,
        date: parseISO(item.cambiado_en),
        icon: config.icon,
        campo: isEstado ? 'estado' : displayCampo,
        campoOriginal: campo,
        subjectId: item.asignatura_id,
        subjectName,
        isReadOnly,
        canApply,
        rawFrom: item.valor_anterior,
        rawTo: item.valor_nuevo,
        details: isEstado
          ? {
              from: estadoLabel(item.valor_anterior),
              to: estadoLabel(item.valor_nuevo),
            }
          : {
              from: toHistoryDisplayValue(
                item.valor_anterior,
                referenceCatalog,
                item.campo,
              ),
              to: toHistoryDisplayValue(
                item.valor_nuevo,
                referenceCatalog,
                item.campo,
              ),
            },
      }
    })
  }, [rawData, structure, estadosById, referenceCatalog])

  const groupedHistoryEvents = useMemo(() => {
    const groups = new Map<(typeof HISTORY_GROUP_ORDER)[number], Array<any>>()

    for (const event of historyEvents) {
      const key = event.group.id as (typeof HISTORY_GROUP_ORDER)[number]
      groups.set(key, [...(groups.get(key) ?? []), event])
    }

    return HISTORY_GROUP_ORDER.map((groupId) => ({
      group: historyEvents.find((event) => event.group.id === groupId)?.group,
      events: groups.get(groupId) ?? [],
    })).filter((section) => section.group && section.events.length > 0)
  }, [historyEvents])

  const openCompareModal = (event: any) => {
    setSelectedEvent(event)
    setIsModalOpen(true)
  }

  const getCurrentPlanValue = (campo: string) => {
    if (!data) return undefined
    if (campo === 'estado' || campo === 'estado_actual_id') {
      return data.estado_actual_id
    }
    if (campo === 'nivel') return data.carreras?.nivel
    if (campo === 'datos') return data.datos
    if (Object.hasOwn(data, campo)) {
      return (data as Record<string, unknown>)[campo]
    }
    return (data.datos as Record<string, unknown> | null | undefined)?.[campo]
  }

  const applySelectedVersion = async (target: 'before' | 'after') => {
    if (!selectedEvent?.canApply) return

    const value =
      target === 'before' ? selectedEvent.rawFrom : selectedEvent.rawTo
    const campo = selectedEvent.campoOriginal
    const current = getCurrentPlanValue(campo)

    if (areHistoryValuesEqual(value, current)) return

    const ok = window.confirm(
      target === 'before'
        ? '¿Aplicar la versión anterior de este cambio?'
        : '¿Aplicar la nueva versión registrada en este cambio?',
    )
    if (!ok) return

    await restorePlanHistoryValue.mutateAsync({
      planId,
      campo,
      value,
    })
    setIsModalOpen(false)
  }

  const isSelectedVersionApplied = (target: 'before' | 'after') => {
    if (!selectedEvent?.canApply) return true
    const value =
      target === 'before' ? selectedEvent.rawFrom : selectedEvent.rawTo
    return areHistoryValuesEqual(
      value,
      getCurrentPlanValue(selectedEvent.campoOriginal),
    )
  }

  // Renders any value type in a human-readable way (no raw JSON).
  // fieldStructure maps keys → { title } from estructuras_plan.definicion.properties
  function RenderSmartValue({
    value,
    fieldStructure,
    depth = 0,
  }: {
    value: unknown
    fieldStructure?: Record<string, { title?: string }> | null
    depth?: number
  }): ReactElement {
    const empty = (
      <span className="text-muted-foreground italic">Sin información</span>
    )

    if (
      value === null ||
      value === undefined ||
      value === '' ||
      value === 'Sin datos previos' ||
      value === 'Sin información previa'
    )
      return empty

    if (Array.isArray(value)) {
      if (value.length === 0)
        return <span className="text-muted-foreground italic">Lista vacía</span>
      return (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div
              key={i}
              className="border-border/50 bg-muted/20 rounded-md border p-3"
            >
              <RenderSmartValue value={item} depth={depth + 1} />
            </div>
          ))}
        </div>
      )
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length === 0) return empty
      return (
        <div className="space-y-3">
          {entries.map(([key, val]) => {
            const label =
              fieldStructure?.[key]?.title ??
              key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            return (
              <div key={key}>
                <p className="text-muted-foreground mb-0.5 text-[10px] font-semibold tracking-wider uppercase">
                  {label}
                </p>
                {typeof val === 'object' && val !== null ? (
                  <div className="border-border/40 mt-1 border-l-2 pl-3">
                    <RenderSmartValue value={val} depth={depth + 1} />
                  </div>
                ) : val === null || val === undefined ? (
                  <span className="text-muted-foreground text-sm italic">
                    Vacío
                  </span>
                ) : (
                  <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                    {String(val)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
        {String(value)}
      </p>
    )
  }

  if (isLoading)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )

  return (
    <div className="mx-auto">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-2 text-xl font-bold">
            <Clock className="text-primary h-5 w-5" /> Historial de Cambios del
            Plan
          </h1>
          <p className="text-muted-foreground text-sm">
            Registro cronológico de modificaciones realizadas
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {historyEvents.length === 0 ? (
          <div className="text-muted-foreground ml-20 py-10">
            No hay registros.
          </div>
        ) : (
          groupedHistoryEvents.map(({ group, events }) => (
            <section key={group!.id} className="space-y-3">
              <div className="flex flex-col gap-1 border-b pb-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-foreground text-sm font-semibold">
                    {group!.label}
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    {group!.description}
                  </p>
                </div>
                <Badge variant="outline" className="w-fit text-[10px]">
                  {events.length} cambios
                </Badge>
              </div>

              <div className="relative space-y-0">
                <div className="bg-border absolute top-0 bottom-0 left-6 w-px md:left-9" />
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="group relative flex gap-3 pb-6 last:pb-0 md:gap-6"
                  >
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="border-background bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex h-10.5 w-10.5 items-center justify-center rounded-full border-4 shadow-sm transition-colors">
                        {event.icon}
                      </div>
                    </div>

                    <Card
                      className="border-border hover:border-primary/50 flex-1 cursor-pointer shadow-none transition-colors"
                      onClick={() => openCompareModal(event)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ')
                          openCompareModal(event)
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-foreground text-sm font-bold">
                                {event.type}
                              </span>
                              <Badge
                                variant="outline"
                                className="h-5 py-0 text-[10px] font-normal"
                              >
                                {formatDistanceToNow(event.date, {
                                  addSuffix: true,
                                  locale: es,
                                })}
                              </Badge>
                              {event.source === 'asignatura' && (
                                <Badge
                                  variant="secondary"
                                  className="h-5 py-0 text-[10px] font-normal"
                                >
                                  Asignatura
                                </Badge>
                              )}
                            </div>

                            <div className="text-muted-foreground flex flex-wrap items-center gap-3 md:gap-4">
                              <div className="flex items-center gap-1.5 text-xs">
                                <User className="h-3.5 w-3.5" />
                                <span className="text-muted-foreground">
                                  {event.user}
                                </span>
                              </div>

                              <span className="text-muted-foreground/70 hidden text-[11px] lg:block">
                                {format(event.date, 'yyyy-MM-dd HH:mm')}
                              </span>
                            </div>
                          </div>

                          <div className="mt-1">
                            <p className="text-muted-foreground text-sm">
                              {event.description}
                            </p>

                            {typeof event.details.from === 'string' &&
                              event.campo === 'estado' && (
                                <div className="mt-2 flex items-center gap-1.5">
                                  <Badge
                                    variant="secondary"
                                    className="bg-destructive/10 text-destructive px-1.5 text-[9px]"
                                  >
                                    {typeof event.details.from === 'string'
                                      ? event.details.from
                                      : 'Sin estado'}
                                  </Badge>
                                  <span className="text-muted-foreground/70 text-[10px]">
                                    →
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="bg-primary/10 text-primary px-1.5 text-[9px]"
                                  >
                                    {typeof event.details.to === 'string'
                                      ? event.details.to
                                      : 'Sin estado'}
                                  </Badge>
                                </div>
                              )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
        {historyEvents.length > 0 && totalPages > 1 && (
          <div className="mt-10 ml-12 flex flex-col gap-3 border-t pt-4 md:ml-20 md:flex-row md:items-center md:justify-between">
            <p className="text-muted-foreground text-xs">
              Mostrando {rawData.length} de {totalRecords} cambios
            </p>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate({
                    search: (prev) => ({ page: Math.max(0, prev.page - 1) }),
                    resetScroll: false,
                  })
                }
                disabled={page === 0 || isLoading}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Anterior
              </Button>

              <span className="text-foreground text-sm font-medium">
                Página {page + 1} de {totalPages || 1}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate({
                    search: (prev) => ({ page: prev.page + 1 }),
                    resetScroll: false,
                  })
                }
                disabled={page + 1 >= totalPages || isLoading}
              >
                Siguiente
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE COMPARACIÓN CON SCROLL INTERNO */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="bg-muted/50 border-b p-6">
            <DialogTitle className="flex items-center gap-2">
              <History className="text-primary h-5 w-5" /> Comparación de
              Versiones
            </DialogTitle>
            <div className="text-muted-foreground flex items-center gap-4 pt-2 text-xs">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {selectedEvent?.user}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />{' '}
                {selectedEvent &&
                  format(selectedEvent.date, "d 'de' MMMM, HH:mm", {
                    locale: es,
                  })}
              </span>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {/* ── CASO 1: Creación ── */}
            {selectedEvent?.tipoOriginal === 'CREACION' &&
            selectedEvent?.source === 'plan' ? (
              <div className="space-y-4">
                <div className="border-primary/20 bg-primary/5 flex items-center gap-3 rounded-lg border p-4">
                  <div className="bg-primary/10 text-primary shrink-0 rounded-full p-2">
                    <PlusCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-foreground font-semibold">
                      Plan de estudios creado
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Registro inicial del plan, no hay versión anterior.
                    </p>
                  </div>
                </div>
                {selectedEvent.details.to && (
                  <div className="border-border bg-muted/20 rounded-lg border p-4">
                    <p className="text-muted-foreground mb-3 text-[10px] font-bold tracking-widest uppercase">
                      Datos iniciales
                    </p>
                    <RenderSmartValue
                      value={selectedEvent.details.to}
                      fieldStructure={structure}
                    />
                  </div>
                )}
              </div>
            ) : /* ── CASO 2: Cambio de estado ── */
            selectedEvent?.campo === 'estado' ? (
              <div className="flex flex-col items-center justify-center gap-6 py-10">
                <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                  Transición de estado
                </p>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-muted-foreground text-xs">Antes</span>
                    <Badge
                      variant="secondary"
                      className="bg-destructive/10 text-destructive border-destructive/20 px-4 py-1 text-sm"
                    >
                      {selectedEvent.details.from ?? 'Sin estado'}
                    </Badge>
                  </div>
                  <ArrowRight className="text-muted-foreground h-5 w-5" />
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      Después
                    </span>
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary border-primary/20 px-4 py-1 text-sm"
                    >
                      {selectedEvent.details.to}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              /* ── CASO 3: Diff general (antes / después) ── */
              <div
                className={cn(
                  'grid gap-6',
                  selectedEvent?.details.from ? 'grid-cols-2' : 'grid-cols-1',
                )}
              >
                {selectedEvent?.details.from && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-destructive h-2 w-2 rounded-full" />
                      <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                        Versión Anterior
                      </span>
                    </div>
                    <div className="border-destructive/20 bg-destructive/5 min-h-40 rounded-lg border p-4">
                      <RenderSmartValue
                        value={selectedEvent.details.from}
                        fieldStructure={structure}
                      />
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary h-2 w-2 rounded-full" />
                    <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                      Nueva Versión
                    </span>
                  </div>
                  <div className="border-primary/20 bg-primary/5 min-h-40 rounded-lg border p-4">
                    <RenderSmartValue
                      value={selectedEvent?.details.to}
                      fieldStructure={structure}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-muted/30 flex shrink-0 flex-col gap-3 border-t p-4 md:flex-row md:items-center md:justify-between">
            <Badge variant="outline" className="w-fit text-[10px]">
              {selectedEvent?.tipoOriginal === 'CREACION' &&
              selectedEvent?.source === 'plan'
                ? 'Creación del plan'
                : `Campo: ${selectedEvent?.campo ?? '—'}`}
            </Badge>
            {selectedEvent?.canApply ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    isSelectedVersionApplied('before') ||
                    restorePlanHistoryValue.isPending
                  }
                  onClick={() => void applySelectedVersion('before')}
                >
                  {restorePlanHistoryValue.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Aplicar versión anterior
                </Button>
                <Button
                  size="sm"
                  disabled={
                    isSelectedVersionApplied('after') ||
                    restorePlanHistoryValue.isPending
                  }
                  onClick={() => void applySelectedVersion('after')}
                >
                  {restorePlanHistoryValue.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Aplicar nueva versión
                </Button>
              </div>
            ) : (
              <Badge variant="secondary" className="w-fit text-[10px]">
                Solo lectura
              </Badge>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
