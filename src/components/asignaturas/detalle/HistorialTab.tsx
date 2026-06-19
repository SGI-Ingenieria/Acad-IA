import { useParams } from '@tanstack/react-router'
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
} from 'lucide-react'
import { useState, useMemo } from 'react'

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
import { usePlanAsignaturas, usePlanLineas } from '@/data/hooks/usePlans'
import {
  useRestoreSubjectHistoryValue,
  useSubject,
  useSubjectEstructuras,
  useSubjectHistorial,
} from '@/data/hooks/useSubjects'
import {
  areHistoryValuesEqual,
  formatHistoryFieldLabel,
  toHistoryDisplayValue,
} from '@/lib/history-display'
import { cn } from '@/lib/utils'

const tipoConfig = {
  datos: { label: 'Datos generales', icon: FileText, color: 'text-info' },
  contenido: {
    label: 'Contenido temático',
    icon: List,
    color: 'text-accent',
  },
  bibliografia: {
    label: 'Bibliografía',
    icon: BookMarked,
    color: 'text-success',
  },
  ia: { label: 'IA', icon: Sparkles, color: 'text-amber-500' },
  documento: {
    label: 'Documento SEP',
    icon: FileCheck,
    color: 'text-primary',
  },
} as const

export function HistorialTab() {
  const { planId, asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId/historial',
  })
  // 1. Obtenemos los datos directamente dentro del componente
  const { data: rawData, isLoading } = useSubjectHistorial(asignaturaId)
  const { data: subject } = useSubject(asignaturaId)
  const { data: estructuras } = useSubjectEstructuras()
  const { data: lineas } = usePlanLineas(planId)
  const { data: asignaturas } = usePlanAsignaturas(planId)
  const restoreSubjectHistoryValue = useRestoreSubjectHistoryValue()

  const [filtros, setFiltros] = useState<Set<string>>(
    new Set(['datos', 'contenido', 'bibliografia', 'ia', 'documento']),
  )

  // ESTADOS PARA EL MODAL
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
              label: subject.planes_estudio.nombre,
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

  const RenderValue = ({
    value,
    depth = 0,
  }: {
    value: any
    depth?: number
  }) => {
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      value === 'Sin información previa' ||
      value === 'Sin datos previos'
    ) {
      return (
        <span className="text-muted-foreground italic">Sin información</span>
      )
    }

    if (Array.isArray(value)) {
      if (value.length === 0)
        return <span className="text-muted-foreground italic">Lista vacía</span>
      return (
        <div className="space-y-3">
          {value.map((item, index) => (
            <div
              key={index}
              className="bg-muted/20 border-border/50 rounded-lg border p-3"
            >
              <RenderValue value={item} depth={depth + 1} />
            </div>
          ))}
        </div>
      )
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <div className="space-y-3">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                {key
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <div className="text-foreground text-sm">
                {typeof val === 'object' && val !== null ? (
                  <div className="border-border/50 mt-1 border-l-2 pl-3">
                    <RenderValue value={val} depth={depth + 1} />
                  </div>
                ) : val === null || val === undefined ? (
                  <span className="text-muted-foreground italic">Vacío</span>
                ) : (
                  <p className="leading-relaxed whitespace-pre-wrap">
                    {String(val)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )
    }

    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {String(value)}
      </p>
    )
  }

  const historialTransformado = useMemo(() => {
    if (!rawData) return []

    return rawData.map((item: any) => {
      const campo = item.campo ?? 'desconocido'
      const displayCampo =
        fieldStructure?.[campo]?.title ?? formatHistoryFieldLabel(campo)
      const rawFrom = item.valor_anterior
      const rawTo = item.valor_nuevo
      const isCreacion =
        item.tipo === 'CREACION' ||
        rawFrom === null ||
        rawFrom === undefined ||
        rawFrom === ''

      return {
        id: item.id,
        tipo:
          campo === 'contenido_tematico'
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
          item.fuente === 'HUMANO'
            ? (item.usuarios_app?.nombre_completo ?? 'Usuario Staff')
            : 'Sistema IA',
        isCreacion,
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
  }, [fieldStructure, rawData, referenceCatalog])

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
    if (!selectedChange) return

    const value =
      target === 'before' ? selectedChange.rawFrom : selectedChange.rawTo
    const campo = selectedChange.detalles.campoOriginal
    const current = getCurrentSubjectValue(campo)

    if (areHistoryValuesEqual(value, current)) return

    const ok = window.confirm(
      target === 'before'
        ? '¿Aplicar la versión anterior de este cambio?'
        : '¿Aplicar la nueva versión registrada en este cambio?',
    )
    if (!ok) return

    await restoreSubjectHistoryValue.mutateAsync({
      subjectId: asignaturaId,
      campo,
      value,
    })
    setIsModalOpen(false)
  }

  const isSelectedVersionApplied = (target: 'before' | 'after') => {
    if (!selectedChange) return true
    const value =
      target === 'before' ? selectedChange.rawFrom : selectedChange.rawTo
    return areHistoryValuesEqual(
      value,
      getCurrentSubjectValue(selectedChange.detalles.campoOriginal),
    )
  }

  const toggleFiltro = (tipo: string) => {
    const newFiltros = new Set(filtros)
    if (newFiltros.has(tipo)) newFiltros.delete(tipo)
    else newFiltros.add(tipo)
    setFiltros(newFiltros)
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
            <History className="text-accent h-6 w-6" />
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
            {Object.entries(tipoConfig).map(([tipo, config]) => (
              <DropdownMenuCheckboxItem
                key={tipo}
                checked={filtros.has(tipo)}
                onCheckedChange={() => toggleFiltro(tipo)}
              >
                <config.icon className={cn('mr-2 h-4 w-4', config.color)} />
                {config.label}
              </DropdownMenuCheckboxItem>
            ))}
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
        <div className="space-y-8">
          {sortedDates.map((dateKey) => (
            <div key={dateKey}>
              <div className="mb-4 flex items-center gap-3">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <h3 className="text-foreground font-semibold">
                  {format(parseISO(dateKey), "EEEE, d 'de' MMMM", {
                    locale: es,
                  })}
                </h3>
              </div>

              <div className="border-border ml-4 space-y-4 border-l-2 pl-6">
                {(groupedHistorial[dateKey] ?? []).map((cambio) => {
                  type TipoConfigItem =
                    (typeof tipoConfig)[keyof typeof tipoConfig]

                  const config =
                    (tipoConfig as Partial<Record<string, TipoConfigItem>>)[
                      cambio.tipo
                    ] ?? tipoConfig.datos
                  const Icon = config.icon
                  return (
                    <div key={cambio.id} className="relative">
                      <div
                        className={cn(
                          'border-background absolute -left-7.75 h-4 w-4 rounded-full border-2',
                          `bg-current ${config.color}`,
                        )}
                      />
                      <Card
                        className="border-border card-interactive hover:border-primary/50 flex-1 cursor-pointer shadow-none transition-colors"
                        onClick={() => openCompareModal(cambio)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ')
                            openCompareModal(cambio)
                        }}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-start gap-4">
                            <div
                              className={cn(
                                'bg-muted rounded-lg p-2',
                                config.color,
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <p className="font-medium">
                                  {cambio.descripcion}
                                </p>

                                <span className="text-muted-foreground text-xs">
                                  {format(cambio.fecha, 'HH:mm')}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {config.label}
                                </Badge>
                                <span className="text-muted-foreground text-xs italic">
                                  por {cambio.usuario}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
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
              <History className="text-primary h-5 w-5" />
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
                    <div className="border-primary/20 bg-primary/5 flex items-center gap-3 rounded-lg border p-4">
                      <div className="bg-primary/10 text-primary shrink-0 rounded-full p-2">
                        <PlusCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-foreground font-semibold">
                          Campo registrado por primera vez
                        </p>
                        <p className="text-muted-foreground text-sm">
                          No existe versión anterior para este campo.
                        </p>
                      </div>
                    </div>
                    <div className="border-border bg-muted/20 rounded-lg border p-4">
                      <p className="text-muted-foreground mb-3 text-[10px] font-bold tracking-widest uppercase">
                        Valor inicial
                      </p>
                      <RenderValue value={nvo} />
                    </div>
                  </div>
                )
              }

              if (selectedChange?.tipo === 'estado') {
                return (
                  <div className="flex flex-col items-center justify-center gap-6 py-10">
                    <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                      Transición de estado
                    </p>
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-muted-foreground text-xs">
                          Antes
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-destructive/10 text-destructive border-destructive/20 px-4 py-1 text-sm"
                        >
                          {ant}
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
                          {nvo}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-destructive h-2 w-2 rounded-full" />
                      <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                        Versión Anterior
                      </span>
                    </div>
                    <div className="border-destructive/20 bg-destructive/5 min-h-40 rounded-xl border p-4">
                      <RenderValue value={ant} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary h-2 w-2 rounded-full" />
                      <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                        Nueva Versión
                      </span>
                    </div>
                    <div className="border-primary/20 bg-primary/5 min-h-40 rounded-xl border p-4">
                      <RenderValue value={nvo} />
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          <div className="bg-muted/20 border-border flex shrink-0 flex-col gap-3 border-t p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              Campo:{' '}
              <Badge variant="secondary">
                {selectedChange?.detalles.campo ?? '—'}
              </Badge>
            </div>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
