import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  History,
  FileText,
  List,
  BookMarked,
  Sparkles,
  FileCheck,
  Calendar,
  Loader2,
  ArrowRight,
  GitBranch,
  Map as MapIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type {
  AsignaturaHistorialGrupo,
  AsignaturaHistorialSearch,
} from '@/types/search'

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
  ListFiltersDialog,
  ListSortMenu,
  ListToolbar,
} from '@/components/ui/list-controls'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import {
  usePlan,
  usePlanAsignaturas,
  usePlanLineas,
} from '@/data/hooks/usePlans'
import {
  useRestoreSubjectHistoryValue,
  useSubject,
  useSubjectEstructuras,
  useSubjectHistorial,
} from '@/data/hooks/useSubjects'
import { formatCiclo } from '@/lib/ciclo-utils'
import {
  areHistoryValuesEqual,
  describeHistoryChange,
  formatHistoryFieldLabel,
  getHistoryGroupForChange,
  toHistoryDisplayValue,
} from '@/lib/history-display'
import { getPlanDisplayName } from '@/lib/plan-display'
import { ASIGNATURA_HISTORIAL_GRUPOS } from '@/types/search'

const tipoConfig = {
  datos: { label: 'Datos generales', icon: FileText },
  mapa: { label: 'Mapa curricular', icon: MapIcon },
  revision: { label: 'Transiciones', icon: GitBranch },
  contenido: { label: 'Contenido temático', icon: List },
  bibliografia: { label: 'Bibliografía', icon: BookMarked },
  ia: { label: 'IA', icon: Sparkles },
  documento: { label: 'Documento SEP', icon: FileCheck },
} as const satisfies Record<
  AsignaturaHistorialGrupo,
  { label: string; icon: typeof FileText }
>

export function SubjectHistoryPanel({
  planId,
  asignaturaId,
  search,
  onChange,
}: {
  planId: string
  asignaturaId: string
  search: AsignaturaHistorialSearch
  onChange: (search: Partial<AsignaturaHistorialSearch>) => void
}) {
  const { grupos, q, orden } = search
  const { data: rawData, isLoading } = useSubjectHistorial(asignaturaId)
  const { data: subject } = useSubject(asignaturaId)
  const { data: plan } = usePlan(planId)
  const capabilities = usePlanCapabilities(plan)
  const { data: estructuras } = useSubjectEstructuras()
  const { data: lineas } = usePlanLineas(planId)
  const { data: asignaturas } = usePlanAsignaturas(planId)
  const restoreSubjectHistoryValue = useRestoreSubjectHistoryValue()
  const filtros = useMemo(() => new Set<string>(grupos), [grupos])

  const [selectedChange, setSelectedChange] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fieldStructure = useMemo(
    () =>
      (subject?.estructuras_asignatura?.definicion as any)?.properties ?? null,
    [subject],
  )

  const referenceCatalog = useMemo(
    () => ({
      estructuras: (estructuras ?? []).map((estructura) => ({
        id: estructura.id,
        label: estructura.nombre,
      })),
      lineas: (lineas ?? []).map((linea) => ({
        id: linea.id,
        label: linea.nombre,
      })),
      planes: subject?.planes_estudio
        ? [
            {
              id: subject.planes_estudio.id,
              label: getPlanDisplayName(subject.planes_estudio),
            },
          ]
        : [],
      asignaturas: (asignaturas ?? []).map((asignatura) => ({
        id: asignatura.id,
        label: asignatura.nombre,
      })),
    }),
    [asignaturas, estructuras, lineas, subject],
  )

  const historialTransformado = useMemo(() => {
    if (!rawData) return []

    return rawData.map((item: any) => {
      const campo = item.campo ?? 'desconocido'
      const displayCampo =
        fieldStructure?.[campo]?.title ?? formatHistoryFieldLabel(campo)
      const rawFrom = item.valor_anterior
      const rawTo = item.valor_nuevo
      const group = getHistoryGroupForChange({
        source: 'asignatura',
        tipo: item.tipo,
        campo,
      })
      const isTransition =
        item.tipo === 'TRANSICION_ESTADO' || campo === 'estado'
      const isCreacion =
        item.tipo === 'CREACION' ||
        rawFrom === null ||
        rawFrom === undefined ||
        rawFrom === ''

      return {
        id: item.id,
        tipo: isTransition
          ? 'revision'
          : group.id === 'mapa_curricular'
            ? 'mapa'
            : campo === 'contenido_tematico'
              ? 'contenido'
              : campo.includes('bibliografia')
                ? 'bibliografia'
                : item.fuente === 'IA' || item.interaccion_ia_id
                  ? 'ia'
                  : 'datos',
        descripcion: describeHistoryChange({
          source: 'asignatura',
          tipo: item.tipo,
          campo,
          campoLabel: displayCampo,
          from: toHistoryDisplayValue(rawFrom, referenceCatalog, campo),
          to: toHistoryDisplayValue(rawTo, referenceCatalog, campo),
          formatCiclo: (numero) =>
            formatCiclo(
              subject?.planes_estudio?.tipo_ciclo,
              numero,
            ).toLocaleLowerCase('es'),
        }).text,
        fecha: item.cambiado_en ? parseISO(item.cambiado_en) : new Date(),
        usuario:
          item.fuente === 'IA' || item.interaccion_ia_id
            ? 'Sistema IA'
            : (item.usuarios_app?.nombre_completo ?? 'Usuario Staff'),
        isCreacion,
        isTransition,
        isReadOnly: isTransition || !capabilities.canEditAsignaturas,
        rawFrom,
        rawTo,
        detalles: {
          campo: displayCampo,
          campoOriginal: campo,
          valor_anterior: toHistoryDisplayValue(
            rawFrom,
            referenceCatalog,
            campo,
          ),
          valor_nuevo: toHistoryDisplayValue(rawTo, referenceCatalog, campo),
        },
      }
    })
  }, [
    capabilities.canEditAsignaturas,
    fieldStructure,
    rawData,
    referenceCatalog,
    subject,
  ])

  const openCompareModal = (cambio: any) => {
    setSelectedChange(cambio)
    setIsModalOpen(true)
  }

  const getCurrentSubjectValue = (campo: string) => {
    if (!subject) return undefined
    if (campo === 'datos') return subject.datos
    if (Object.hasOwn(subject, campo)) {
      return (subject as Record<string, unknown>)[campo]
    }
    return (subject.datos as Record<string, unknown> | null | undefined)?.[
      campo
    ]
  }

  const applySelectedVersion = async (target: 'before' | 'after') => {
    if (!selectedChange || selectedChange.isReadOnly) return

    const value =
      target === 'before' ? selectedChange.rawFrom : selectedChange.rawTo
    const campo = selectedChange.detalles.campoOriginal
    const current = getCurrentSubjectValue(campo)

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
          'restaurar una version de la asignatura fuera de su etapa normal',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    await restoreSubjectHistoryValue.mutateAsync({
      subjectId: asignaturaId,
      campo,
      value,
      adminOverrideReason,
    })
    setIsModalOpen(false)
  }

  const isSelectedVersionApplied = (target: 'before' | 'after') => {
    if (!selectedChange || selectedChange.isReadOnly) return true
    const value =
      target === 'before' ? selectedChange.rawFrom : selectedChange.rawTo
    return areHistoryValuesEqual(
      value,
      getCurrentSubjectValue(selectedChange.detalles.campoOriginal),
    )
  }

  const normalizedQuery = q.trim().toLocaleLowerCase('es')
  const filteredHistorial = historialTransformado
    .filter((cambio) => filtros.has(cambio.tipo))
    .filter((cambio) =>
      normalizedQuery
        ? [
            cambio.descripcion,
            cambio.usuario,
            cambio.detalles.campo,
            tipoConfig[cambio.tipo as AsignaturaHistorialGrupo].label,
          ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(normalizedQuery)
        : true,
    )
    .sort((left, right) => {
      const comparison = left.fecha.getTime() - right.fecha.getTime()
      return orden === 'antiguo' ? comparison : -comparison
    })

  const groupedHistorial = filteredHistorial.reduce(
    (groups: Record<string, Array<any> | undefined>, cambio) => {
      const dateKey = format(cambio.fecha, 'yyyy-MM-dd')
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(cambio)
      return groups
    },
    {},
  )

  const sortedDates = Object.keys(groupedHistorial).sort((a, b) =>
    orden === 'antiguo' ? a.localeCompare(b) : b.localeCompare(a),
  )

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-foreground flex items-center gap-2 text-2xl font-semibold">
            <History className="text-muted-foreground h-6 w-6" />
            Historial de cambios
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {historialTransformado.length} cambios registrados
          </p>
        </div>

        <ListToolbar
          search={
            <div className="relative">
              <History className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={q}
                onChange={(event) => onChange({ q: event.target.value })}
                placeholder="Buscar cambios, campos o autores"
                className="pl-9"
                aria-label="Buscar en el historial de la asignatura"
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
                onValueChange={(nextOrden) => onChange({ orden: nextOrden })}
                label="Ordenar historial de asignatura"
              />
              <ListFiltersDialog
                title="Filtrar historial de asignatura"
                value={{ grupos }}
                defaultValue={{ grupos: [...ASIGNATURA_HISTORIAL_GRUPOS] }}
                activeCount={ASIGNATURA_HISTORIAL_GRUPOS.length - grupos.length}
                onApply={(next, { resetAll }) =>
                  onChange({
                    grupos: next.grupos,
                    q: resetAll ? '' : q,
                    orden: resetAll ? 'reciente' : orden,
                  })
                }
                label="Filtrar historial de asignatura"
              >
                {(draft, setDraft) => (
                  <ListFilterSection title="Categorías">
                    <div className="space-y-2">
                      {ASIGNATURA_HISTORIAL_GRUPOS.map((tipo) => {
                        const config = tipoConfig[tipo]
                        return (
                          <Label
                            key={tipo}
                            className="border-border flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3"
                          >
                            <Checkbox
                              checked={draft.grupos.includes(tipo)}
                              onCheckedChange={() => {
                                const selected = new Set(draft.grupos)
                                if (selected.has(tipo)) selected.delete(tipo)
                                else selected.add(tipo)
                                setDraft({
                                  grupos: ASIGNATURA_HISTORIAL_GRUPOS.filter(
                                    (item) => selected.has(item),
                                  ),
                                })
                              }}
                            />
                            <config.icon className="text-muted-foreground size-4" />
                            {config.label}
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

      {filteredHistorial.length === 0 ? (
        <div className="border-border border-y py-12 text-center">
          <History className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">No se encontraron cambios.</p>
        </div>
      ) : (
        <div className="animate-in fade-in space-y-8 duration-300">
          {sortedDates.map((dateKey) => (
            <div key={dateKey} className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {format(parseISO(dateKey), "EEEE, d 'de' MMMM", {
                    locale: es,
                  })}
                </h3>
              </div>

              <div className="-mx-3 space-y-0.5">
                {(groupedHistorial[dateKey] ?? []).map((cambio) => {
                  type TipoConfigItem =
                    (typeof tipoConfig)[keyof typeof tipoConfig]

                  const config =
                    (tipoConfig as Partial<Record<string, TipoConfigItem>>)[
                      cambio.tipo
                    ] ?? tipoConfig.datos
                  const Icon = config.icon
                  return (
                    <button
                      key={cambio.id}
                      type="button"
                      onClick={() => openCompareModal(cambio)}
                      className="organic-interactive hover:bg-muted/40 focus-visible:ring-ring/40 group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Icon className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-colors" />
                      <span className="text-foreground truncate text-sm">
                        {cambio.descripcion}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {cambio.usuario} · {format(cambio.fecha, 'HH:mm')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b p-5 text-left">
            <DialogTitle className="text-base">
              {selectedChange?.descripcion ?? 'Cambio del historial'}
            </DialogTitle>
            <DialogDescription>
              {selectedChange?.usuario} ·{' '}
              {selectedChange &&
                format(selectedChange.fecha, "d 'de' MMMM 'de' yyyy, HH:mm", {
                  locale: es,
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5">
            {selectedChange?.isTransition ? (
              <div className="flex items-center justify-center gap-4 py-6">
                <Badge variant="outline" className="text-muted-foreground">
                  {selectedChange.detalles.valor_anterior}
                </Badge>
                <ArrowRight className="text-muted-foreground/60 size-4" />
                <Badge
                  variant="outline"
                  className="border-primary/40 text-primary"
                >
                  {selectedChange.detalles.valor_nuevo}
                </Badge>
              </div>
            ) : (
              <HistoryDiff
                from={selectedChange?.detalles.valor_anterior ?? null}
                to={selectedChange?.detalles.valor_nuevo ?? null}
              />
            )}
          </div>

          {/* Sin permiso de edición no hay acciones: el diálogo es de consulta. */}
          {selectedChange && !selectedChange.isReadOnly && (
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t p-4">
              <Button
                variant="outline"
                size="sm"
                disabled={
                  selectedChange.isCreacion ||
                  isSelectedVersionApplied('before') ||
                  restoreSubjectHistoryValue.isPending
                }
                onClick={() => void applySelectedVersion('before')}
              >
                {restoreSubjectHistoryValue.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Restaurar versión original
              </Button>
              <Button
                size="sm"
                disabled={
                  isSelectedVersionApplied('after') ||
                  restoreSubjectHistoryValue.isPending
                }
                onClick={() => void applySelectedVersion('after')}
              >
                {restoreSubjectHistoryValue.isPending ? (
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
