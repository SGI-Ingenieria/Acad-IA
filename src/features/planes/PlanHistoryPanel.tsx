import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  GitBranch,
  Edit3,
  PlusCircle,
  MinusCircle,
  Loader2,
  History,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  BookOpen,
  FileText,
  Layers3,
  Map as MapIcon,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import type { HistoryChangeKind } from '@/lib/history-display'
import type { HistorialPlanGrupo } from '@/types/search'
import type { LucideIcon } from 'lucide-react'

import { HistoryCreationCard } from '@/components/history/HistoryCreationCard'
import { HistoryDiff } from '@/components/history/HistoryDiff'
import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ListFilterSection,
  ListFiltersPopover,
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
  usePlanHistorialDia,
  usePlanHistorialDias,
  usePlanLineas,
  useRestorePlanHistoryValue,
} from '@/data/hooks/usePlans'
import { formatCiclo } from '@/lib/ciclo-utils'
import { formatCarreraNombre, formatFacultadNombre } from '@/lib/facultad-utils'
import {
  isHistoryCreationEvent,
  normalizeHistoryCreation,
} from '@/lib/history-creation'
import {
  areHistoryValuesEqual,
  describeHistoryChange,
  etiquetaDiaHistorial,
  formatHistoryFieldLabel,
  getHistoryGroupForChange,
  HISTORY_GROUPS,
  isHistoryTransitionChange,
  toHistoryDisplayValue,
} from '@/lib/history-display'
import { cn } from '@/lib/utils'
import { HISTORIAL_PLAN_GRUPOS } from '@/types/search'

const HISTORY_GROUP_ORDER = HISTORIAL_PLAN_GRUPOS

const GROUP_ICONS: Record<(typeof HISTORY_GROUP_ORDER)[number], LucideIcon> = {
  datos_basicos_plan: Edit3,
  detalles_plan: FileText,
  estructura_plan: Layers3,
  mapa_curricular: MapIcon,
  cambios_asignatura: BookOpen,
  transiciones: GitBranch,
}

/** El icono comunica qué pasó (alta, baja, transición) antes que de qué área. */
const KIND_ICONS: Partial<Record<HistoryChangeKind, LucideIcon>> = {
  creacion: PlusCircle,
  alta: PlusCircle,
  baja: MinusCircle,
  transicion: GitBranch,
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
  fillHeight = false,
  conTitulo = true,
}: {
  planId: string
  page: number
  grupos: Array<HistorialPlanGrupo>
  q: string
  orden: 'reciente' | 'antiguo'
  onChange: (next: Partial<PlanHistorySearch>) => void
  /** En el panel lateral la lista scrollea y el paginado queda fijo abajo. */
  fillHeight?: boolean
  /**
   * Como página el panel se encabeza a sí mismo; dentro del panel lateral el
   * título lo pone la cabecera del Sheet y repetirlo dejaría dos encabezados
   * seguidos.
   */
  conTitulo?: boolean
}) {
  const { data: dias, isLoading: diasLoading } = usePlanHistorialDias(planId)
  // Una página es un día. El orden de lectura decide qué día es la página 0,
  // así que «más antiguos» no reordena filas sueltas: recorre los días al revés.
  const diasOrdenados = useMemo(() => {
    const lista = dias ?? []
    return orden === 'antiguo' ? [...lista].reverse() : lista
  }, [dias, orden])
  const totalPages = diasOrdenados.length
  const diaActual = diasOrdenados.at(
    Math.min(page, Math.max(totalPages - 1, 0)),
  )
  const { data: cambiosDelDia, isFetching: diaFetching } = usePlanHistorialDia(
    planId,
    diaActual?.dia,
  )
  const isLoading = diasLoading || (Boolean(diaActual) && !cambiosDelDia)
  const rawData = useMemo(() => cambiosDelDia ?? [], [cambiosDelDia])
  const totalRecords = useMemo(
    () => (dias ?? []).reduce((suma, item) => suma + item.total, 0),
    [dias],
  )
  const { data } = usePlan(planId)
  const capabilities = usePlanCapabilities(data)
  const { data: estados } = useEstadosPlan()
  const { data: catalogos } = useCatalogosPlanes()
  const { data: lineas } = usePlanLineas(planId)
  const { data: asignaturas } = usePlanAsignaturas(planId)
  const restorePlanHistoryValue = useRestorePlanHistoryValue()
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null)
  const filtros = useMemo(() => new Set<string>(grupos), [grupos])

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

  const tipoCiclo = data?.tipo_ciclo
  const cicloLabel = useMemo(
    () => (numero: number) =>
      formatCiclo(tipoCiclo, numero).toLocaleLowerCase('es'),
    [tipoCiclo],
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
      const isTransition = isHistoryTransitionChange(item.tipo, item.campo)
      const group = getHistoryGroupForChange({
        source,
        tipo: item.tipo,
        campo: item.campo,
      })
      const campo = isEstado ? 'estado_actual_id' : item.campo
      const campoLabel = isEstado
        ? 'Estado'
        : (structure?.[item.campo]?.title ??
          formatHistoryFieldLabel(item.campo))
      const subjectName = source === 'asignatura' ? subjectLabel(item) : null

      const details = isEstado
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
          }

      const description = describeHistoryChange({
        source,
        tipo: item.tipo,
        campo: item.campo,
        campoLabel,
        from: details.from,
        to: details.to,
        subjectName,
        formatCiclo: cicloLabel,
      })

      // Restaurar solo tiene sentido en campos del plan que el usuario edita:
      // los estados y los cambios de asignatura se gestionan en su propio flujo.
      const canApply =
        capabilities.canEditPlan &&
        source === 'plan' &&
        item.tipo !== 'CREACION' &&
        !isTransition

      const user =
        item.usuarios_app?.nombre_completo ??
        (item.cambiado_por === '11111111-1111-1111-1111-111111111111'
          ? 'Administrador'
          : item.fuente === 'IA' || item.interaccion_ia_id
            ? 'Sistema IA'
            : 'Sistema')
      const date = parseISO(item.cambiado_en)
      const isCreation = isHistoryCreationEvent(item.tipo)

      return {
        id: item.id,
        source,
        group,
        tipoOriginal: item.tipo,
        user,
        description: description.text,
        kind: description.kind,
        date,
        campoOriginal: campo,
        subjectName,
        isTransition,
        canApply,
        rawFrom: item.valor_anterior,
        rawTo: item.valor_nuevo,
        creationSummary: isCreation
          ? normalizeHistoryCreation({
              entity: source,
              rawValue: item.valor_nuevo,
              createdAt: date,
              createdBy: user,
              fallbackName: source === 'plan' ? data?.nombre : subjectName,
              planName:
                source === 'asignatura'
                  ? (data?.nombre_display ??
                    data?.nombre_propuesto ??
                    data?.nombre)
                  : null,
            })
          : null,
        details,
      }
    })
  }, [
    rawData,
    data,
    structure,
    estadosById,
    referenceCatalog,
    capabilities.canEditPlan,
    cicloLabel,
  ])

  const visibleGroups = useMemo(() => {
    const normalizedQuery = q.trim().toLocaleLowerCase('es')
    const displayed = historyEvents
      .filter((event) => filtros.has(event.group.id))
      .filter((event) =>
        normalizedQuery
          ? [event.user, event.description, event.subjectName]
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

    return HISTORY_GROUP_ORDER.map((groupId) => ({
      groupId,
      events: displayed.filter((event) => event.group.id === groupId),
    })).filter((section) => section.events.length > 0)
  }, [filtros, historyEvents, orden, q])

  const openCompareModal = (event: any, trigger: HTMLButtonElement) => {
    selectedTriggerRef.current = trigger
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
      title: 'Restaurar una versión del historial',
      description:
        target === 'before'
          ? 'Se volverá al valor que tenía antes de este cambio.'
          : 'Se volverá a aplicar el valor que dejó este cambio.',
      confirmLabel: 'Restaurar',
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

  return (
    <div className={cn('flex flex-col gap-4', fillHeight && 'h-full min-h-0')}>
      <div className="shrink-0 space-y-4">
        {conTitulo && (
          <h2 className="text-foreground flex items-center gap-2 text-lg font-semibold">
            <History className="text-muted-foreground size-5" />
            Historial de cambios
          </h2>
        )}

        <ListToolbar
          search={
            <Input
              value={q}
              onChange={(event) => onChange({ q: event.target.value, page: 0 })}
              placeholder="Buscar cambios, campos o autores"
              aria-label="Buscar en el historial del plan"
            />
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
              <ListFiltersPopover
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
                            className="flex cursor-pointer items-center gap-3 py-1.5"
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
              </ListFiltersPopover>
            </>
          }
        />
      </div>

      {diaActual && (
        <div className="flex shrink-0 items-baseline justify-between gap-3">
          <h3 className="text-foreground text-xl font-semibold tracking-tight">
            {etiquetaDiaHistorial(diaActual.dia)}
          </h3>
          <span className="text-muted-foreground text-xs tabular-nums">
            {diaActual.total} {diaActual.total === 1 ? 'cambio' : 'cambios'}
          </span>
        </div>
      )}

      <div className={cn('flex-1', fillHeight && 'min-h-0 overflow-y-auto')}>
        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
            <Loader2 className="size-4 animate-spin" /> Cargando historial…
          </div>
        ) : historyEvents.length === 0 ? (
          <p className="text-muted-foreground py-10 text-sm">
            Todavía no se ha registrado ningún cambio en este plan. Cada
            edición, movimiento del mapa y transición de estado quedará aquí.
          </p>
        ) : visibleGroups.length === 0 ? (
          <p className="text-muted-foreground py-10 text-sm">
            Ningún cambio de este día coincide con la búsqueda o las categorías
            seleccionadas.
          </p>
        ) : (
          <div
            className={cn(
              'animate-in fade-in space-y-5 duration-300',
              // El día siguiente se pide con el anterior en pantalla: atenuarlo
              // dice «se está cargando» sin vaciar la lista.
              diaFetching && 'opacity-60',
            )}
          >
            {visibleGroups.map(({ groupId, events }) => {
              const GroupIcon = GROUP_ICONS[groupId]
              return (
                /* El grupo es un rótulo, no una fila: tipografía pequeña y en
                   mayúsculas frente a cambios de tamaño normal. Antes ambos
                   eran renglones con icono y pesaban lo mismo. */
                <section key={groupId} className="space-y-1">
                  <h4 className="text-muted-foreground flex items-center gap-2 px-2 text-[11px] font-semibold tracking-wide uppercase">
                    <GroupIcon className="size-3.5 shrink-0" />
                    {HISTORY_GROUPS[groupId].label}
                    <span className="tabular-nums opacity-70">
                      {events.length}
                    </span>
                  </h4>
                  <ul>
                    {events.map((event) => {
                      const Icon = KIND_ICONS[event.kind] ?? GroupIcon
                      return (
                        <li key={event.id}>
                          <button
                            type="button"
                            onClick={(clickEvent) =>
                              openCompareModal(event, clickEvent.currentTarget)
                            }
                            className="hover:bg-muted/50 focus-visible:ring-ring/40 group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-2 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
                          >
                            <Icon
                              className={cn(
                                'size-4 shrink-0',
                                event.kind === 'baja'
                                  ? 'text-destructive/70'
                                  : event.kind === 'alta' ||
                                      event.kind === 'creacion'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-muted-foreground',
                              )}
                            />
                            <span className="text-foreground truncate text-sm">
                              {event.description}
                            </span>
                            {/* La fecha ya la da el encabezado de la página:
                                en el renglón sólo queda la hora. */}
                            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                              {event.user} ·{' '}
                              {format(event.date, 'HH:mm', { locale: es })}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t pt-3">
          <p className="text-muted-foreground text-xs tabular-nums">
            Día {page + 1} de {totalPages} · {totalRecords} cambios en total
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                orden === 'antiguo' ? 'Día anterior' : 'Día siguiente'
              }
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0 || isLoading}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                orden === 'antiguo' ? 'Día siguiente' : 'Día anterior'
              }
              onClick={() => setPage(page + 1)}
              disabled={page + 1 >= totalPages || isLoading}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            selectedTriggerRef.current?.focus()
          }}
        >
          <DialogHeader className="shrink-0 border-b p-5 text-left">
            <DialogTitle className="text-base">
              {selectedEvent?.description ?? 'Cambio del historial'}
            </DialogTitle>
            <DialogDescription
              className={selectedEvent?.creationSummary ? 'sr-only' : undefined}
            >
              {selectedEvent?.creationSummary
                ? 'Registro de creación.'
                : `${selectedEvent?.user ?? ''} · ${
                    selectedEvent
                      ? format(
                          selectedEvent.date,
                          "d 'de' MMMM 'de' yyyy, HH:mm",
                          { locale: es },
                        )
                      : ''
                  }`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5">
            {selectedEvent?.creationSummary ? (
              <HistoryCreationCard
                summary={selectedEvent.creationSummary}
                active={isModalOpen}
              />
            ) : selectedEvent?.isTransition ? (
              <div className="flex items-center justify-center gap-4 py-6">
                <Badge variant="outline" className="text-muted-foreground">
                  {selectedEvent.details.from ?? 'Sin estado'}
                </Badge>
                <ArrowRight className="text-muted-foreground/60 size-4" />
                <Badge
                  variant="outline"
                  className="border-primary/40 text-primary"
                >
                  {selectedEvent.details.to}
                </Badge>
              </div>
            ) : (
              <HistoryDiff
                from={selectedEvent?.details.from ?? null}
                to={selectedEvent?.details.to ?? null}
              />
            )}
          </div>

          {/* Sin permiso o sin sentido restaurar: simplemente no hay acciones. */}
          {selectedEvent?.canApply && (
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t p-4">
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
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Restaurar versión original
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
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Volver a aplicar este cambio
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
