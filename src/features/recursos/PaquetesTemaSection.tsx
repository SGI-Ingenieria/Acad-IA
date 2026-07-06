import { AlertCircle, Download, Loader2, Package } from 'lucide-react'

import type { PaqueteTipoExportable } from '@/data/api/paquetes.api'
import type { Tables } from '@/types/supabase'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PAQUETE_ESTADO_LABEL,
  PAQUETE_TIPO_LABEL,
  PAQUETES_TIPOS_OPCIONES,
} from '@/data/api/paquetes.api'
import {
  useAsignaturaPaquetes,
  useDescargarPaquete,
  useExportarPaquete,
} from '@/data/hooks/usePaquetes'

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PaquetesTemaSection({
  asignaturaId,
  unidadId,
  temaId,
  canManage,
}: {
  asignaturaId: string
  unidadId: string
  temaId: string
  canManage: boolean
}) {
  const { data: paquetes = [] } = useAsignaturaPaquetes(asignaturaId)
  const exportar = useExportarPaquete(asignaturaId)
  const descargar = useDescargarPaquete()

  const paquetesDelTema = paquetes.filter(
    (p) => p.unidad_id === unidadId && p.tema_id === temaId,
  )

  const handleExportar = (tipo: PaqueteTipoExportable) => {
    exportar.mutate({
      tipo,
      scope: 'tema',
      unidadId,
      temaId,
      incluirEstados: ['generated', 'reviewed', 'published'],
    })
  }

  if (!canManage && paquetesDelTema.length === 0) return null

  return (
    <div className="mt-3 border-t pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Exportaciones
        </p>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={exportar.isPending}>
                {exportar.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Package className="mr-1.5 h-3.5 w-3.5" />
                )}
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PAQUETES_TIPOS_OPCIONES.map((opcion) => (
                <DropdownMenuItem
                  key={opcion.value}
                  onSelect={() => handleExportar(opcion.value)}
                >
                  {opcion.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {paquetesDelTema.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aún no hay paquetes exportados. Se exportan los recursos generados,
          revisados o publicados del tema.
        </p>
      ) : (
        <div className="space-y-1.5">
          {paquetesDelTema.map((paquete) => (
            <PaqueteItem
              key={paquete.id}
              paquete={paquete}
              onDescargar={() => descargar.mutate(paquete)}
              isDownloading={
                descargar.isPending && descargar.variables.id === paquete.id
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PaqueteItem({
  paquete,
  onDescargar,
  isDownloading,
}: {
  paquete: Tables<'learning_packages'>
  onDescargar: () => void
  isDownloading: boolean
}) {
  const isReady = paquete.estado === 'ready'
  const isFailed = paquete.estado === 'failed'

  return (
    <div className="bg-background flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Badge variant="secondary" className="shrink-0 font-normal">
          {PAQUETE_TIPO_LABEL[paquete.tipo]}
        </Badge>
        <span className="truncate" title={paquete.archivo_nombre ?? undefined}>
          {paquete.archivo_nombre ?? PAQUETE_ESTADO_LABEL[paquete.estado]}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {fechaCorta(paquete.creado_en)}
        </span>
      </div>
      {isReady ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2"
          onClick={onDescargar}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span className="sr-only">Descargar</span>
        </Button>
      ) : isFailed ? (
        <span
          className="text-destructive flex shrink-0 items-center gap-1 text-xs"
          title={paquete.error ?? undefined}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {PAQUETE_ESTADO_LABEL.failed}
        </span>
      ) : (
        <span className="text-muted-foreground shrink-0 text-xs">
          {PAQUETE_ESTADO_LABEL[paquete.estado]}
        </span>
      )}
    </div>
  )
}
