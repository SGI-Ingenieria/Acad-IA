import { AlertTriangle, Archive, BadgeCheck, FileText, KeyRound, LoaderCircle, Network, ScanSearch } from 'lucide-react'

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
  isDragging,
  onClick,
  onViewSeriacion,
  onMouseEnter,
  onMouseLeave,
  isActive = false,
  isModalOpen,
  hasSeriacion,
}: {
  asignatura: Asignatura
  lineaColor: string
  lineaNombre?: string
  onDragStart: (e: React.DragEvent, id: string) => void
  isDragging: boolean
  onClick: () => void
  onViewSeriacion?: (asignatura: Asignatura) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  isActive?: boolean
  isModalOpen?: boolean
  hasSeriacion?: any
  onDragEnd?: () => void
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
              onDragStart={(e) => onDragStart(e, asignatura.id)}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onClick={onClick}
              className={[
                'group bg-background relative h-50 w-40 shrink-0 overflow-hidden rounded-[22px] text-left',
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
              title={asignatura.nombre}
            >
              <div className="relative flex h-full flex-col p-4">
                {/* top */}
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="inline-flex h-8 max-w-32 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold"
                    style={{
                      borderColor: hexToRgba(lineaColor, 0.2),
                      backgroundColor: hexToRgba(lineaColor, 0.1),
                      color: lineaColor,
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {asignatura.clave || 'Sin clave'}
                    </span>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-background/70 flex h-8 items-center rounded-full px-2 backdrop-blur-sm">
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
                <div className="mt-4 flex min-h-18 flex-col items-center text-center">
                  <h3
                    className="text-foreground overflow-hidden pb-1 text-sm leading-[1.08]"
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
                    <span className="text-muted-foreground mt-1 text-[11px] font-semibold">
                      C {asignatura.ciclo}
                    </span>
                  )}
                </div>

                {/* bottom */}
                <div className="mt-auto grid grid-cols-3 gap-2">
                  <div className="bg-muted/70 border-border/70 flex flex-col items-center rounded-2xl border px-2.5 py-2">
                    {/* <Icons.Award className="h-3.5 w-3.5" /> */}
                    <span className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                      CR
                    </span>

                    <div className="text-foreground text-sm font-bold">
                      {asignatura.creditos}
                    </div>
                  </div>

                  <div className="bg-muted/70 border-border/70 flex flex-col items-center rounded-2xl border px-2.5 py-2">
                    <span className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                      HD
                    </span>

                    <div className="text-foreground text-sm font-bold">
                      {asignatura.hd}
                    </div>
                  </div>

                  <div className="bg-muted/70 border-border/70 flex flex-col items-center rounded-2xl border px-2.5 py-2">
                    <span className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                      HI
                    </span>

                    <div className="text-foreground text-sm font-bold">
                      {asignatura.hi}
                    </div>
                  </div>
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
          <button
            onClick={(e) => {
              e.stopPropagation()
              onViewSeriacion(asignatura)
            }}
            className="bg-primary text-primary-foreground absolute -top-2 -right-2 z-30 rounded-full p-1.5 opacity-0 shadow-lg transition-all group-hover:opacity-100 hover:scale-110"
            title="Ver seriación"
          >
            <Network size={14} />
          </button>
        )}
      </TooltipProvider>
    </div>
  )
}
