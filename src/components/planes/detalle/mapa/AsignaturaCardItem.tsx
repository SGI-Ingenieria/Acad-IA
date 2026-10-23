import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  FileText,
  GripVertical,
  KeyRound,
  LoaderCircle,
  Network,
  ScanSearch,
} from 'lucide-react'

import type { Asignatura } from '@/types/plan'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { nombreBloqueAreaComun } from '@/lib/area-comun-bloques'

const estadoConfig: Record<
  Asignatura['estado'],
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  borrador: {
    label: 'Borrador',
    icon: FileText,
  },
  revisada: {
    label: 'Revisada',
    icon: ScanSearch,
  },
  aprobada: {
    label: 'Aprobada',
    icon: BadgeCheck,
  },
  generando: {
    label: 'Generando',
    icon: LoaderCircle,
  },
  archivada: {
    label: 'Archivada',
    icon: Archive,
  },
  fallida: {
    label: 'Fallida',
    icon: AlertTriangle,
  },
}

export default function AsignaturaCardItem({
  asignatura,
  lineaColor,
  lineaNombre,
  onDragStart,
  onDragEnd,
  isDragging,
  onClick,
  onViewSeriacion,
  onMouseEnter,
  onMouseLeave,
  isActive = false,
  isModalOpen,
  hasSeriacion,
  ariaLabel,
}: {
  asignatura: Asignatura
  lineaColor: string
  lineaNombre?: string
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd?: () => void
  isDragging: boolean
  onClick: () => void
  onViewSeriacion?: (asignatura: Asignatura) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  isActive?: boolean
  isModalOpen?: boolean
  hasSeriacion?: any
  /**
   * Reemplaza el nombre accesible de la tarjeta. Se usa en modo agente, donde
   * el clic ya no abre el editor sino que le pide a la IA que la coloque: el
   * lector de pantalla debe anunciar lo que va a pasar, no el contenido.
   */
  ariaLabel?: string
}) {
  const estado = estadoConfig[asignatura.estado]
  const EstadoIcon = estado.icon
  const nombreVisible = asignatura.nombre.trim() || 'Nombre pendiente'
  const bloqueVisible = nombreBloqueAreaComun(asignatura.bloqueAreaComun)

  return (
    <div className="group relative shrink-0">
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              draggable={!asignatura.areaComunOrigenId}
              aria-grabbed={isDragging}
              aria-label={
                ariaLabel ??
                `${nombreVisible}${bloqueVisible ? `, bloque ${bloqueVisible}` : ''}${asignatura.areaComunOrigenId ? ', Área común, solo lectura' : ''}`
              }
              onDragStart={(e) => onDragStart(e, asignatura.id)}
              onDragEnd={onDragEnd}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onClick={onClick}
              className={[
                'organic-interactive group bg-card relative block h-44 min-h-44 w-40 min-w-40 shrink-0 overflow-hidden rounded-xl p-0 text-left whitespace-normal shadow-xs',
                'focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none',
                asignatura.areaComunOrigenId
                  ? 'cursor-pointer'
                  : 'cursor-grab active:cursor-grabbing',
                isActive ? 'scale-[1.03] border-2' : 'border',
                isDragging ? 'opacity-45 shadow-none' : 'hover:shadow-lg',
              ].join(' ')}
              style={{
                borderColor: isActive
                  ? lineaColor
                  : asignatura.bloqueAreaComun
                    ? lineaColor
                    : `color-mix(in oklch, ${lineaColor} 60%, var(--border))`,

                boxShadow: isActive ? 'var(--shadow-lg)' : undefined,
              }}
            >
              <div className="p-grupo relative flex h-full flex-col">
                {/* top */}
                <div className="gap-relacionado flex items-start justify-between">
                  <div>
                    <div className="gap-micro flex items-center">
                      {!asignatura.areaComunOrigenId && (
                        <GripVertical
                          className="text-muted-foreground/70 h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <KeyRound className="h-3.5 w-3.5 shrink-0" />
                      {asignatura.areaComunOrigenId && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground text-[10px] font-semibold">
                              AC
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Área común · Solo lectura
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <span className="block max-w-full truncate">
                      {asignatura.clave
                        ? `${asignatura.clave.slice(0, 8)}${
                            asignatura.clave.length > 8 ? '...' : ''
                          }`
                        : 'Sin clave'}
                    </span>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex h-8 items-center">
                        <EstadoIcon className="text-foreground/65 h-3.5 w-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <span className="text-xs font-semibold">
                        {estado.label}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* titulo */}
                <div className="mt-control flex min-h-0 flex-1 flex-col items-center text-center">
                  <span className="text-foreground pb-micro line-clamp-3 text-sm leading-tight">
                    {nombreVisible}
                  </span>

                  {/* 🔥 semestre abajo */}
                  {asignatura.ciclo && (
                    <span className="text-muted-foreground mt-micro text-[11px] font-semibold">
                      C {asignatura.ciclo}
                    </span>
                  )}
                </div>

                {/* bottom: créditos como dato principal; horas en segundo plano */}
                <div className="gap-relacionado mt-auto flex items-end justify-between">
                  <div className="gap-micro flex items-baseline">
                    <span className="text-foreground text-2xl leading-none font-bold tabular-nums">
                      {asignatura.creditos}
                    </span>
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                      cr
                    </span>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground text-right text-[10px] leading-tight tabular-nums">
                        {asignatura.hd + asignatura.hi} h
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-sm">
                      HD {asignatura.hd} + HI {asignatura.hi} ={' '}
                      {asignatura.hd + asignatura.hi} h
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </Button>
          </TooltipTrigger>

          <TooltipContent side="bottom">
            <div className="text-lg">
              {/* ciclo */}
              {asignatura.ciclo ? (
                <span className="font-bold">C{asignatura.ciclo} · </span>
              ) : null}
              {lineaNombre ? (
                <span className="font-medium">{lineaNombre} · </span>
              ) : null}
              {asignatura.nombre}
            </div>
          </TooltipContent>
        </Tooltip>
        {!isModalOpen && hasSeriacion && onViewSeriacion && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                aria-label={`Ver seriación de ${asignatura.nombre}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onViewSeriacion(asignatura)
                }}
                className="organic-interactive bg-primary text-primary-foreground absolute -top-2 -right-2 z-30 rounded-full shadow-lg"
              >
                <Network size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver seriación</TooltipContent>
          </Tooltip>
        )}
      </>
    </div>
  )
}
