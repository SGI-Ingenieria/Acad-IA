import { createFileRoute } from '@tanstack/react-router'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  GitBranch,
  Edit3,
  PlusCircle,
  RefreshCw,
  User,
  Loader2,
  Clock,
  History,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePlan, usePlanHistorial } from '@/data/hooks/usePlans'

export const Route = createFileRoute('/planes/$planId/_detalle/historial')({
  component: RouteComponent,
})

const getEventConfig = (tipo: string, campo: string) => {
  if (tipo === 'CREACION')
    return {
      label: 'Creación',
      icon: <PlusCircle className="h-4 w-4" />,
      color: 'primary',
    }
  if (campo === 'estado')
    return {
      label: 'Cambio de estado',
      icon: <GitBranch className="h-4 w-4" />,
      color: 'secondary',
    }
  if (campo === 'datos')
    return {
      label: 'Edición de Datos',
      icon: <Edit3 className="h-4 w-4" />,
      color: 'accent',
    }
  return {
    label: 'Actualización',
    icon: <RefreshCw className="h-4 w-4" />,
    color: 'muted',
  }
}

function RouteComponent() {
  const { planId } = Route.useParams()
  const [page, setPage] = useState(0)
  const pageSize = 4
  const { data: response, isLoading } = usePlanHistorial(planId, page)
  const rawData = response?.data ?? []
  const totalRecords = response?.count ?? 0
  const totalPages = Math.ceil(totalRecords / pageSize)
  const [structure, setStructure] = useState<any>(null)
  const { data } = usePlan(planId)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    if (data?.estructuras_plan?.definicion?.properties) {
      setStructure(data.estructuras_plan.definicion.properties)
    }
  }, [data])

  const historyEvents = useMemo(() => {
    if (!rawData) return []
    return rawData.map((item: any) => {
      const config = getEventConfig(item.tipo, item.campo)
      return {
        id: item.id,
        type: config.label,
        user:
          item.cambiado_por === '11111111-1111-1111-1111-111111111111'
            ? 'Administrador'
            : 'Usuario Staff',
        description:
          item.campo === 'datos'
            ? `Actualización general de: ${item.valor_nuevo?.nombre || 'información del plan'}`
            : `Se modificó el campo ${
                structure?.[item.campo]?.title ?? item.campo
              }`,
        date: parseISO(item.cambiado_en),
        icon: config.icon,
        campo:
          data?.estructuras_plan?.definicion?.properties?.[item.campo]?.title,
        details: {
          from: item.valor_anterior,
          to: item.valor_nuevo,
        },
      }
    })
  }, [rawData, structure, data])

  const openCompareModal = (event: any) => {
    setSelectedEvent(event)
    setIsModalOpen(true)
  }

  const renderValue = (val: any) => {
    if (!val) return 'Sin información'
    if (typeof val === 'object') return JSON.stringify(val, null, 2)
    return String(val)
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

      <div className="relative space-y-0">
        <div className="bg-border absolute top-0 bottom-0 left-6 w-px md:left-9" />
        {historyEvents.length === 0 ? (
          <div className="text-muted-foreground ml-20 py-10">
            No hay registros.
          </div>
        ) : (
          historyEvents.map((event) => (
            <div
              key={event.id}
              className="group relative flex gap-3 pb-8 md:gap-6"
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
                    {/* LÍNEA SUPERIOR: Título a la izquierda --- Usuario, Botón y Fecha a la derecha */}
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
                      </div>

                      {/* Grupo de elementos alineados a la derecha */}
                      <div className="text-muted-foreground flex flex-wrap items-center gap-3 md:gap-4">
                        {/* Usuario e Icono */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <User className="h-3.5 w-3.5" />
                          <span className="text-muted-foreground">
                            {event.user}
                          </span>
                        </div>

                        {/* Fecha exacta (Solo visible en desktop para no amontonar) */}
                        <span className="text-muted-foreground/70 hidden text-[11px] lg:block">
                          {format(event.date, 'yyyy-MM-dd HH:mm')}
                        </span>
                      </div>
                    </div>

                    {/* LÍNEA INFERIOR: Descripción */}
                    <div className="mt-1">
                      <p className="text-muted-foreground text-sm">
                        {event.description}
                      </p>

                      {/* Badges de transición opcionales (de estado) */}
                      {event.details &&
                        typeof event.details.from === 'string' &&
                        event.campo === 'estado' && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <Badge
                              variant="secondary"
                              className="bg-destructive/10 text-destructive px-1.5 text-[9px]"
                            >
                              {event.details.from}
                            </Badge>
                            <span className="text-muted-foreground/70 text-[10px]">
                              →
                            </span>
                            <Badge
                              variant="secondary"
                              className="bg-primary/10 text-primary px-1.5 text-[9px]"
                            >
                              {event.details.to}
                            </Badge>
                          </div>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
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
                onClick={() => {
                  setPage((p) => Math.max(0, p - 1))
                  window.scrollTo(0, 0) // Opcional: volver arriba
                }}
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
                onClick={() => {
                  setPage((p) => p + 1)
                  window.scrollTo(0, 0)
                }}
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
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
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
            <div className="grid h-full grid-cols-2 gap-6">
              {/* Lado Antes: Solo se renderiza si existe valor_anterior */}
              {selectedEvent?.details.from && (
                <div className="flex flex-col space-y-2">
                  <div className="bg-background sticky top-0 z-10 flex items-center gap-2 py-1">
                    <div className="bg-destructive h-2 w-2 rounded-full" />
                    <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                      Versión Anterior
                    </span>
                  </div>
                  <div className="border-destructive/20 bg-destructive/5 text-foreground max-h-125 min-h-62.5 flex-1 overflow-y-auto rounded-lg border p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {renderValue(selectedEvent.details.from)}
                  </div>
                </div>
              )}

              {/* Lado Después */}
              <div className="flex flex-col space-y-2">
                <div className="bg-background sticky top-0 z-10 flex items-center gap-2 py-1">
                  <div className="bg-primary h-2 w-2 rounded-full" />
                  <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                    Nueva Versión
                  </span>
                </div>
                <div className="border-primary/20 bg-primary/5 text-foreground max-h-125 min-h-62.5 flex-1 overflow-y-auto rounded-lg border p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {renderValue(selectedEvent?.details.to)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted/30 flex justify-center border-t p-4">
            <Badge variant="outline" className="font-mono text-[10px]">
              Campo: {selectedEvent?.campo}
            </Badge>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
