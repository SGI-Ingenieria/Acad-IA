import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  History,
  FileText,
  List,
  BookMarked,
  Sparkles,
  FileCheck,
  Filter,
  Calendar,
  Loader2,
  PlusCircle,
  ArrowRight,
  GitBranch,
  Map as MapIcon,
} from 'lucide-react'
import { useState, useMemo, useRef } from 'react'

import type { AsignaturaHistorialGrupo } from '@/types/search'

import { HistoryDiff, HistoryValue } from '@/components/history/HistoryDiff'
import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
  useGSAP,
} from '@/lib/animations'
import {
  areHistoryValuesEqual,
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

export function HistorialTab() {
  const { planId, asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId/historial',
  })
  // 1. Obtenemos los datos directamente dentro del componente
  const { data: rawData, isLoading } = useSubjectHistorial(asignaturaId)
  const { data: subject } = useSubject(asignaturaId)
  const { data: plan } = usePlan(planId)
  const capabilities = usePlanCapabilities(plan)
  const { data: estructuras } = useSubjectEstructuras()
  const { data: lineas } = usePlanLineas(planId)
  const { data: asignaturas } = usePlanAsignaturas(planId)
  const restoreSubjectHistoryValue = useRestoreSubjectHistoryValue()

  // Los grupos visibles viven en la URL (param `grupos`): compartibles y
  // restaurables con back/forward. El default (todos) se retira de la URL.
  const { grupos } = useSearch({
    from: '/planes/$planId/asignaturas/$asignaturaId/historial',
  })
  const navigate = useNavigate({
    from: '/planes/$planId/asignaturas/$asignaturaId/historial',
  })
  const filtros = useMemo(() => new Set<string>(grupos), [grupos])

  // ESTADOS PARA EL MODAL
  const [selectedChange, setSelectedChange] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)

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
        descripcion: isCreacion
          ? `Se registró ${displayCampo}`
          : `Se actualizó ${displayCampo}`,
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

  const toggleFiltro = (tipo: AsignaturaHistorialGrupo) => {
    void navigate({
      search: (prev) => {
        const seleccion = new Set(prev.grupos)
        if (seleccion.has(tipo)) seleccion.delete(tipo)
        else seleccion.add(tipo)
        return {
          ...prev,
          grupos: ASIGNATURA_HISTORIAL_GRUPOS.filter((g) => seleccion.has(g)),
        }
      },
      resetScroll: false,
    })
  }

  // 3. Aplicamos filtros y agrupamiento sobre los datos transformados
  const filteredHistorial = historialTransformado.filter((cambio) =>
    filtros.has(cambio.tipo),
  )

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
    b.localeCompare(a),
  )

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
        stagger: { each: 0.02, amount: 0.3 },
      })
    },
    { scope: timelineRef, dependencies: [sortedDates.length] },
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-foreground flex items-center gap-2 text-2xl font-semibold">
            <History className="text-muted-foreground h-6 w-6" />
            Historial de cambios
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {historialTransformado.length} cambios registrados
          </p>
        </div>

        {/* Dropdown de Filtros (Igual al anterior) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filtrar ({filtros.size})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {ASIGNATURA_HISTORIAL_GRUPOS.map((tipo) => {
              const config = tipoConfig[tipo]
              return (
                <DropdownMenuCheckboxItem
                  key={tipo}
                  checked={filtros.has(tipo)}
                  onCheckedChange={() => toggleFiltro(tipo)}
                >
                  <config.icon className="text-muted-foreground mr-2 h-4 w-4" />
                  {config.label}
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {filteredHistorial.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground">No se encontraron cambios.</p>
          </CardContent>
        </Card>
      ) : (
        <div ref={timelineRef} className="space-y-8">
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
                      data-history-item
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
      {/* MODAL DE COMPARACIÓN */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="bg-muted/50 shrink-0 border-b p-6">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <History className="text-muted-foreground h-5 w-5" />
              {(() => {
                const ant = selectedChange?.detalles.valor_anterior
                const isCreacion =
                  selectedChange?.isCreacion ||
                  ant === null ||
                  ant === undefined ||
                  ant === '' ||
                  ant === 'Sin datos previos' ||
                  ant === 'Sin información previa' ||
                  ant === 'Sin información'
                return isCreacion ? 'Registro creado' : 'Comparación de cambios'
              })()}
            </DialogTitle>
            <div className="text-muted-foreground flex items-center gap-4 pt-1 text-xs">
              <span>{selectedChange?.usuario}</span>
              <span>
                {selectedChange &&
                  format(selectedChange.fecha, "d 'de' MMMM, HH:mm", {
                    locale: es,
                  })}
              </span>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {(() => {
              const ant = selectedChange?.detalles.valor_anterior
              const nvo = selectedChange?.detalles.valor_nuevo
              const isCreacion =
                selectedChange?.isCreacion ||
                ant === null ||
                ant === undefined ||
                ant === '' ||
                ant === 'Sin datos previos' ||
                ant === 'Sin información previa' ||
                ant === 'Sin información'

              if (isCreacion) {
                return (
                  <div className="space-y-4">
                    <p className="text-muted-foreground flex items-center gap-2 text-xs">
                      <PlusCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Campo registrado por primera vez — no hay versión
                      anterior.
                    </p>
                    <HistoryValue value={nvo} />
                  </div>
                )
              }

              if (selectedChange?.isTransition) {
                return (
                  <div className="flex flex-col items-center justify-center gap-5 py-8">
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                      Transición de estado
                    </p>
                    <div className="flex items-center gap-4">
                      <Badge
                        variant="outline"
                        className="text-muted-foreground px-3 py-1 text-sm"
                      >
                        {ant}
                      </Badge>
                      <ArrowRight className="text-muted-foreground/60 h-4 w-4" />
                      <Badge
                        variant="outline"
                        className="border-primary/40 text-primary px-3 py-1 text-sm"
                      >
                        {nvo}
                      </Badge>
                    </div>
                  </div>
                )
              }

              return <HistoryDiff from={ant} to={nvo} />
            })()}
          </div>

          <div className="bg-muted/20 border-border flex shrink-0 flex-col gap-3 border-t p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              Campo:{' '}
              <Badge variant="secondary">
                {selectedChange?.detalles.campo ?? '—'}
              </Badge>
            </div>
            {selectedChange?.isReadOnly ? (
              <Badge variant="secondary" className="w-fit text-[10px]">
                Solo lectura
              </Badge>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    !selectedChange ||
                    selectedChange.isCreacion ||
                    isSelectedVersionApplied('before') ||
                    restoreSubjectHistoryValue.isPending
                  }
                  onClick={() => void applySelectedVersion('before')}
                >
                  {restoreSubjectHistoryValue.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Aplicar versión anterior
                </Button>
                <Button
                  size="sm"
                  disabled={
                    !selectedChange ||
                    isSelectedVersionApplied('after') ||
                    restoreSubjectHistoryValue.isPending
                  }
                  onClick={() => void applySelectedVersion('after')}
                >
                  {restoreSubjectHistoryValue.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Aplicar nueva versión
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
