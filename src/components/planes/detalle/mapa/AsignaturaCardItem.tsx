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

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const estadoConfig: Record<
  Asignatura['estado'],
  {
    label: string
    dot: string
    soft: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  borrador: {
    label: 'Borrador',
    dot: 'bg-slate-500',
    soft: 'bg-slate-100 text-slate-700',
    icon: FileText,
  },
  revisada: {
    label: 'Revisada',
    dot: 'bg-amber-500',
    soft: 'bg-amber-100 text-amber-700',
    icon: ScanSearch,
  },
  aprobada: {
    label: 'Aprobada',
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-100 text-emerald-700',
    icon: BadgeCheck,
  },
  generando: {
    label: 'Generando',
    dot: 'bg-sky-500',
    soft: 'bg-sky-100 text-sky-700',
    icon: LoaderCircle,
  },
  archivada: {
    label: 'Archivada',
    dot: 'bg-slate-400',
    soft: 'bg-slate-100 text-slate-600',
    icon: Archive,
  },
  fallida: {
    label: 'Fallida',
    dot: 'bg-rose-500',
    soft: 'bg-rose-100 text-rose-700',
    icon: AlertTriangle,
  },
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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

  return (
    <div className="group relative shrink-0">
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              draggable
              aria-grabbed={isDragging}
              aria-label={ariaLabel}
              onDragStart={(e) => onDragStart(e, asignatura.id)}
              onDragEnd={onDragEnd}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onClick={onClick}
              className={[
                'group bg-card dark:bg-background relative h-44 w-40 shrink-0 overflow-hidden rounded-[22px] text-left shadow-xs dark:shadow-none',
                'transition-all duration-300 ease-out',
                'focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none',
                'cursor-grab active:cursor-grabbing',
                isActive ? 'scale-[1.03] border-2' : 'border',
                isDragging
                  ? 'scale-[0.985] opacity-45 shadow-none'
                  : 'hover:-translate-y-1 hover:shadow-lg',
              ].join(' ')}
              style={{
                borderColor: isActive ? lineaColor : hexToRgba(lineaColor, 0.6),

                boxShadow: isActive
                  ? `0 0 0 2px ${hexToRgba(lineaColor, 0.25)}, 0 8px 20px rgba(0,0,0,0.15)`
                  : undefined,
              }}
            >
              <div className="p-grupo relative flex h-full flex-col">
                {/* top */}
                <div className="gap-relacionado flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1">
                      <GripVertical
                        className="text-muted-foreground/70 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <KeyRound className="h-3.5 w-3.5 shrink-0" />
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
                      <div className="bg-card/80 dark:bg-background/70 px-relacionado flex h-8 items-center rounded-full shadow-xs backdrop-blur-sm dark:shadow-none">
                        <EstadoIcon className="text-foreground/65 h-3.5 w-3.5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <span className="text-xs font-semibold">
                        {estado.label}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* titulo */}
                <div className="mt-grupo flex min-h-18 flex-col items-center text-center">
                  <h3
                    className="text-foreground pb-micro overflow-hidden text-sm leading-[1.08]"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {asignatura.nombre}
                  </h3>

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
            </button>
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
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onViewSeriacion(asignatura)
                }}
                className="bg-primary text-primary-foreground p-relacionado absolute -top-2 -right-2 z-30 rounded-full opacity-0 shadow-lg transition-all group-hover:opacity-100 hover:scale-110"
              >
                <Network size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Ver seriación</TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  )
}
