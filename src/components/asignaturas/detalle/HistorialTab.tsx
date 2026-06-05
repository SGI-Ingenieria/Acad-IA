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
import { useSubjectHistorial } from '@/data/hooks/useSubjects'
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
  const { asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId/historial',
  })
  // 1. Obtenemos los datos directamente dentro del componente
  const { data: rawData, isLoading } = useSubjectHistorial(asignaturaId)

  const [filtros, setFiltros] = useState<Set<string>>(
    new Set(['datos', 'contenido', 'bibliografia', 'ia', 'documento']),
  )

  // ESTADOS PARA EL MODAL
  const [selectedChange, setSelectedChange] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const RenderValue = ({ value }: { value: any }) => {
    // 1. Caso: Nulo o vacío
    if (
      value === null ||
      value === undefined ||
      value === 'Sin información previa'
    ) {
      return (
        <span className="text-muted-foreground italic">Sin información</span>
      )
    }

    // 2. Caso: Es un ARRAY (como tu lista de unidades)
    if (Array.isArray(value)) {
      return (
        <div className="space-y-4">
          {value.map((item, index) => (
            <div
              key={index}
              className="bg-muted/20 border-border/60 rounded-lg border p-3 shadow-sm"
            >
              <RenderValue value={item} />
            </div>
          ))}
        </div>
      )
    }

    // 3. Caso: Es un OBJETO (como cada unidad con titulo, temas, etc.)
    if (typeof value === 'object' && value !== null) {
      return (
        <div className="grid gap-2">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="flex flex-col">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                {key.replace(/_/g, ' ')}
              </span>
              <div className="text-foreground text-sm">
                {/* Llamada recursiva para manejar lo que haya dentro del valor */}
                {typeof val === 'object' ? (
                  <div className="border-border/60 mt-1 border-l-2 pl-2">
                    <RenderValue value={val} />
                  </div>
                ) : (
                  String(val)
                )}
              </div>
            </div>
          ))}
        </div>
      )
    }

    // 4. Caso: Texto o número simple
    return <span className="text-sm leading-relaxed">{String(value)}</span>
  }

  const historialTransformado = useMemo(() => {
    if (!rawData) return []

    return rawData.map((item: any) => {
      const campo = item.campo ?? 'desconocido'

      return {
        id: item.id,
        tipo: campo === 'contenido_tematico' ? 'contenido' : 'datos',
        descripcion: `Se actualizó el campo ${campo.replace(/_/g, ' ')}`,
        fecha: item.cambiado_en ? parseISO(item.cambiado_en) : new Date(),
        usuario: item.fuente === 'HUMANO' ? 'Usuario Staff' : 'Sistema IA',
        detalles: {
          campo,
          valor_anterior: item.valor_anterior || 'Sin datos previos',
          valor_nuevo: item.valor_nuevo,
        },
      }
    })
  }, [rawData])

  const openCompareModal = (cambio: any) => {
    setSelectedChange(cambio)
    setIsModalOpen(true)
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
        <DialogContent className="flex max-h-[90vh] w-full flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <History className="text-primary h-5 w-5" />
              Comparación de cambios
            </DialogTitle>
            {/* ... info de usuario y fecha */}
          </DialogHeader>

          <div className="custom-scrollbar mt-4 flex-1 overflow-y-auto pr-2">
            <div className="grid h-full grid-cols-2 gap-6">
              {/* Lado Antes */}
              <div className="flex flex-col space-y-3">
                <div className="bg-background sticky top-0 z-10 flex items-center gap-2 pb-2">
                  <div className="bg-destructive h-2 w-2 rounded-full" />
                  <span className="text-muted-foreground text-xs font-bold uppercase">
                    Versión Anterior
                  </span>
                </div>
                <div className="border-destructive/20 bg-destructive/5 flex-1 rounded-xl border p-4">
                  <RenderValue
                    value={selectedChange?.detalles.valor_anterior}
                  />
                </div>
              </div>

              {/* Lado Después */}
              <div className="flex flex-col space-y-3">
                <div className="bg-background sticky top-0 z-10 flex items-center gap-2 pb-2">
                  <div className="bg-primary h-2 w-2 rounded-full" />
                  <span className="text-muted-foreground text-xs font-bold uppercase">
                    Nueva Versión
                  </span>
                </div>
                <div className="border-primary/20 bg-primary/5 flex-1 rounded-xl border p-4">
                  <RenderValue value={selectedChange?.detalles.valor_nuevo} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted/20 border-border text-muted-foreground mt-4 flex shrink-0 items-center justify-center gap-2 rounded-lg border p-3 text-xs">
            Campo modificado:{' '}
            <Badge variant="secondary">
              {selectedChange?.detalles.campo ?? 'Sin campo'}
            </Badge>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
