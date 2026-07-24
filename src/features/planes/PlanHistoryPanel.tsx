import { format, parseISO } from 'date-fns'
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
import { useMemo, useRef, useState } from 'react'

import type { HistorialPlanGrupo } from '@/types/search'

import { HistoryDiff, HistoryValue } from '@/components/history/HistoryDiff'
import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ListFilterSection,
  ListFiltersDialog,
  ListSortMenu,
  ListToolbar,
} from '@/components/ui/list-controls'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import { useEstadosPlan } from '@/data/hooks/useMeta'
import {
  useCatalogosPlanes,
  usePlan,
  usePlanAsignaturas,
  usePlanHistorial,
  usePlanLineas,
  useRestorePlanHistoryValue,
} from '@/data/hooks/usePlans'
import {
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
  useGSAP,
} from '@/lib/animations'
import { formatCarreraNombre, formatFacultadNombre } from '@/lib/facultad-utils'
import {
  areHistoryValuesEqual,
  formatHistoryFieldLabel,
  getHistoryGroupForChange,
  HISTORY_GROUPS,
  toHistoryDisplayValue,
} from '@/lib/history-display'
import { HISTORIAL_PLAN_GRUPOS } from '@/types/search'

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

const HISTORY_GROUP_ORDER = HISTORIAL_PLAN_GRUPOS

const GROUP_ICONS: Record<
  (typeof HISTORY_GROUP_ORDER)[number],
  typeof FileText
> = {
  datos_basicos_plan: Edit3,
  detalles_plan: FileText,
  estructura_plan: Layers3,
  mapa_curricular: MapIcon,
  cambios_asignatura: BookOpen,
  transiciones: GitBranch,
}

export type PlanHistorySearch = {
  page: number
  grupos: Array<HistorialPlanGrupo>
  q: string
  orden: 'reciente' | 'antiguo'
}

export function PlanHistoryPanel({
  planId,
  page,
  grupos,
  q,
  orden,
  onChange,
}: {
  planId: string
  page: number
  grupos: Array<HistorialPlanGrupo>
  q: string
  orden: 'reciente' | 'antiguo'
  onChange: (next: Partial<PlanHistorySearch>) => void
}) {
  const pageSize = 4
  const { data: response, isLoading } = usePlanHistorial(planId, page)
  const rawData = useMemo(() => response?.data ?? [], [response])
  const totalRecords = response?.count ?? 0
  const totalPages = Math.ceil(totalRecords / pageSize)
  const { data } = usePlan(planId)
  const capabilities = usePlanCapabilities(data)
  const { data: estados } = useEstadosPlan()
  const { data: catalogos } = useCatalogosPlanes()
  const { data: lineas } = usePlanLineas(planId)
  const { data: asignaturas } = usePlanAsignaturas(planId)
  const restorePlanHistoryValue = useRestorePlanHistoryValue()
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const filtros = useMemo(() => new Set<string>(grupos), [grupos])
  const timelineRef = useRef<HTMLDivElement>(null)

  const setPage = (nextPage: number) => onChange({ page: nextPage })

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
        label: formatCarreraNombre(carrera),
      })),
      facultades: (catalogos?.facultades ?? []).map((facultad) => ({
        id: facultad.id,
        label: formatFacultadNombre(facultad),
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
        capabilities.canEditPlan &&
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
  }, [
    rawData,
    structure,
    estadosById,
    referenceCatalog,
    capabilities.canEditPlan,
  ])

  const groupedHistoryEvents = useMemo(() => {
    const normalizedQuery = q.trim().toLocaleLowerCase('es')
    const displayed = historyEvents
      .filter((event) =>
        normalizedQuery
          ? [
              event.user,
              event.description,
              event.campo,
              event.subjectName,
              event.type,
            ]
              .filter(Boolean)
              .join(' ')
              .toLocaleLowerCase('es')
              .includes(normalizedQuery)
          : true,
      )
      .sort((left, right) => {
        const comparison = left.date.getTime() - right.date.getTime()
        return orden === 'antiguo' ? comparison : -comparison
      })
    const groups = new Map<(typeof HISTORY_GROUP_ORDER)[number], Array<any>>()

    for (const event of displayed) {
      const key = event.group.id
      groups.set(key, [...(groups.get(key) ?? []), event])
    }

    return HISTORY_GROUP_ORDER.map((groupId) => ({
      group: displayed.find((event) => event.group.id === groupId)?.group,
      events: groups.get(groupId) ?? [],
    })).filter((section) => section.group && section.events.length > 0)
  }, [historyEvents, orden, q])

  const visibleGroups = groupedHistoryEvents.filter(
    (section) => section.group && filtros.has(section.group.id),
  )

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

    const ok = await showAppConfirm({
      title: 'Restaurar versión del historial',
      description:
        target === 'before'
          ? '¿Aplicar la versión anterior de este cambio?'
          : '¿Aplicar la nueva versión registrada en este cambio?',
      confirmLabel: 'Aplicar versión',
    })
    if (!ok) return
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'restaurar una version del historial fuera de su etapa normal',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    await restorePlanHistoryValue.mutateAsync({
      planId,
      campo,
      value,
      adminOverrideReason,
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

  useGSAP(
    () => {
      if (!getOrganicMotion() || !timelineRef.current) return
      const items = timelineRef.current.querySelectorAll('[data-history-item]')
      if (!items.length) return
      gsap.from(items, {
        opacity: 0,
        y: 10,
        duration: organicDuration.base,
        ease: organicEase,
        stagger: 0.04,
      })
    },
    { scope: timelineRef, dependencies: [groupedHistoryEvents.length, page] },
  )

  if (isLoading)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )

  return (
    <div className="mx-auto">
      <div className="mb-8 space-y-4">
        <div>
          <h1 className="text-foreground flex items-center gap-2 text-xl font-bold">
            <Clock className="text-muted-foreground h-5 w-5" /> Historial de
            Cambios del Plan
          </h1>
          <p className="text-muted-foreground text-sm">
            Registro cronológico de modificaciones realizadas
          </p>
        </div>

        <ListToolbar
          search={
            <div className="relative">
              <History className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={q}
                onChange={(event) =>
                  onChange({ q: event.target.value, page: 0 })
                }
                placeholder="Buscar cambios, campos o autores"
                className="pl-9"
                aria-label="Buscar en el historial del plan"
              />
            </div>
          }
          actions={
            <>
              <ListSortMenu
                value={orden}
                defaultValue="reciente"
                options={[
                  { value: 'reciente', label: 'Más recientes' },
                  { value: 'antiguo', label: 'Más antiguos' },
                ]}
                onValueChange={(nextOrden) =>
                  onChange({ orden: nextOrden, page: 0 })
                }
                label="Ordenar historial del plan"
              />
              <ListFiltersDialog
                title="Filtrar historial del plan"
                value={{ grupos }}
                defaultValue={{ grupos: [...HISTORIAL_PLAN_GRUPOS] }}
                activeCount={HISTORIAL_PLAN_GRUPOS.length - grupos.length}
                onApply={(next, { resetAll }) =>
                  onChange({
                    grupos: next.grupos,
                    q: resetAll ? '' : q,
                    orden: resetAll ? 'reciente' : orden,
                    page: 0,
                  })
                }
                label="Filtrar historial del plan"
              >
                {(draft, setDraft) => (
                  <ListFilterSection title="Categorías">
                    <div className="space-y-2">
                      {HISTORY_GROUP_ORDER.map((groupId) => {
                        const Icon = GROUP_ICONS[groupId]
                        return (
                          <Label
                            key={groupId}
                            className="border-border flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3"
                          >
                            <Checkbox
                              checked={draft.grupos.includes(groupId)}
                              onCheckedChange={() => {
                                const selected = new Set(draft.grupos)
                                if (selected.has(groupId))
                                  selected.delete(groupId)
                                else selected.add(groupId)
                                setDraft({
                                  grupos: HISTORIAL_PLAN_GRUPOS.filter((item) =>
                                    selected.has(item),
                                  ),
                                })
                              }}
                            />
                            <Icon className="text-muted-foreground size-4" />
                            {HISTORY_GROUPS[groupId].label}
                          </Label>
                        )
                      })}
                    </div>
                  </ListFilterSection>
                )}
              </ListFiltersDialog>
            </>
          }
        />
      </div>

      <div ref={timelineRef} className="space-y-8">
        {historyEvents.length === 0 ? (
          <div className="text-muted-foreground py-10">No hay registros.</div>
        ) : visibleGroups.length === 0 ? (
          <div className="text-muted-foreground py-10 text-sm">
            No hay cambios de estas categorías en esta página.
          </div>
        ) : (
          visibleGroups.map(({ group, events }) => (
            <section key={group!.id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3 border-b pb-2">
                <div>
                  <h2 className="text-foreground text-sm font-semibold">
                    {group!.label}
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    {group!.description}
                  </p>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {events.length} {events.length === 1 ? 'cambio' : 'cambios'}
                </span>
              </div>

              <div className="-mx-3 space-y-0.5">
                {events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    data-history-item
                    onClick={() => openCompareModal(event)}
                    className="organic-interactive hover:bg-muted/40 focus-visible:ring-ring/40 group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="text-muted-foreground group-hover:text-primary transition-colors">
                      {event.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="text-foreground block truncate text-sm">
                        {event.description}
                      </span>
                      {event.campo === 'estado' &&
                        typeof event.details.from === 'string' &&
                        typeof event.details.to === 'string' && (
                          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                            {event.details.from} → {event.details.to}
                          </span>
                        )}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {event.user} ·{' '}
                      {format(event.date, 'd MMM, HH:mm', { locale: es })}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
        {historyEvents.length > 0 && totalPages > 1 && (
          <div className="mt-10 flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-muted-foreground text-xs">
              Mostrando {rawData.length} de {totalRecords} cambios
            </p>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(0, page - 1))}
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
                onClick={() => setPage(page + 1)}
                disabled={page + 1 >= totalPages || isLoading}
              >
                Siguiente
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="bg-muted/50 border-b p-6">
            <DialogTitle className="flex items-center gap-2">
              <History className="text-muted-foreground h-5 w-5" /> Comparación
              de Versiones
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
            {selectedEvent?.tipoOriginal === 'CREACION' &&
            selectedEvent?.source === 'plan' ? (
              <div className="space-y-4">
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <PlusCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Plan de estudios creado — registro inicial, no hay versión
                  anterior.
                </p>
                {selectedEvent.details.to && (
                  <HistoryValue value={selectedEvent.details.to} />
                )}
              </div>
            ) : selectedEvent?.campo === 'estado' ? (
              <div className="flex flex-col items-center justify-center gap-5 py-8">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                  Transición de estado
                </p>
                <div className="flex items-center gap-4">
                  <Badge
                    variant="outline"
                    className="text-muted-foreground px-3 py-1 text-sm"
                  >
                    {selectedEvent.details.from ?? 'Sin estado'}
                  </Badge>
                  <ArrowRight className="text-muted-foreground/60 h-4 w-4" />
                  <Badge
                    variant="outline"
                    className="border-primary/40 text-primary px-3 py-1 text-sm"
                  >
                    {selectedEvent.details.to}
                  </Badge>
                </div>
              </div>
            ) : (
              <HistoryDiff
                from={selectedEvent?.details.from ?? null}
                to={selectedEvent?.details.to ?? null}
              />
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
