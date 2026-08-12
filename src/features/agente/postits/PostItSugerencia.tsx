import { Play, RotateCcw, X } from 'lucide-react'
import { useRef } from 'react'

import { usePropsHalo } from '../AgenteHalo'
import { EsqueletoAgente } from '../EsqueletoAgente'

import type { SugerenciaSlot } from '@/data'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Una propuesta de asignatura en la tira del modo agente.
 *
 * Tamaño fijo a propósito: la tira no crece, se desplaza. Así diez propuestas
 * ocupan lo mismo que una y la tabla de asignaturas —que es lo que el usuario
 * vino a ver— no se va empujando hacia abajo.
 */
export function PostItSugerencia({
  slot,
  colores,
  puedeLanzar,
  lanzando = false,
  onDescartar,
  onReintentar,
  onLanzar,
}: {
  slot: SugerenciaSlot
  /** Paleta de las líneas curriculares del plan, para el halo mientras piensa. */
  colores?: Array<string> | null
  puedeLanzar: boolean
  lanzando?: boolean
  onDescartar: () => void
  onReintentar: () => void
  /** Recibe el nodo para poder animarlo hacia su fila antes de que desaparezca. */
  onLanzar: (nodo: HTMLElement) => void
}) {
  const nodo = useRef<HTMLElement>(null)
  const halo = usePropsHalo(slot.estado === 'pidiendo', colores)

  const nombre = slot.sugerencia?.nombre ?? ''

  return (
    <article
      ref={nodo}
      className={cn(
        'group/postit border-border/70 bg-card p-control relative h-32 w-56 shrink-0 rounded-xl border shadow-[var(--shadow-xs)]',
        halo.className,
      )}
      style={halo.style}
      aria-busy={slot.estado === 'pidiendo'}
      aria-label={
        slot.estado === 'listo'
          ? `Propuesta: ${nombre}`
          : slot.estado === 'error'
            ? 'Propuesta fallida'
            : 'La IA está proponiendo una asignatura'
      }
    >
      {slot.estado === 'pidiendo' && (
        <div className="gap-relacionado flex flex-col overflow-hidden">
          <EsqueletoAgente className="h-5 w-4/5" />
          <EsqueletoAgente className="h-3 w-full" />
          <EsqueletoAgente className="h-3 w-11/12" />
          <EsqueletoAgente className="h-3 w-2/3" />
        </div>
      )}

      {/* La descripción viene recortada a tres líneas para que la tira no
          crezca; el diálogo es la única forma de leerla entera, así que el
          cuerpo del post-it es un botón real y no un `div` con `onClick`. */}
      {slot.estado === 'listo' && slot.sugerencia && (
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={`Ver la propuesta ${nombre}`}
              className="focus-visible:ring-ring/40 block h-full w-full rounded-md text-left focus-visible:ring-2 focus-visible:outline-none"
            >
              <h3 className="line-clamp-2 text-base leading-snug font-semibold tracking-tight">
                {nombre}
              </h3>
              <p className="text-muted-foreground mt-micro line-clamp-3 text-xs leading-snug">
                {slot.sugerencia.descripcion}
              </p>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{nombre}</DialogTitle>
              <DialogDescription className="text-foreground text-sm leading-relaxed whitespace-pre-line">
                {slot.sugerencia.descripcion}
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )}

      {slot.estado === 'error' && (
        <div className="gap-relacionado flex h-full flex-col justify-between">
          <p className="text-muted-foreground line-clamp-3 text-xs leading-snug">
            {slot.error}
          </p>
          <Button
            variant="ghost"
            size="xs"
            className="self-start"
            onClick={onReintentar}
          >
            <RotateCcw />
            Reintentar
          </Button>
        </div>
      )}

      {/* Descartar y lanzar viven en las esquinas y aparecen al acercarse. Se
          mantienen visibles con el foco para que también existan por teclado. */}
      <span
        className={cn(
          'absolute -top-2 -right-2 transition-opacity',
          'opacity-100 lg:opacity-0',
          'lg:group-focus-within/postit:opacity-100 lg:group-hover/postit:opacity-100',
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon-xs"
              className="rounded-full shadow-[var(--shadow-sm)]"
              aria-label={
                nombre ? `Descartar ${nombre}` : 'Descartar esta propuesta'
              }
              onClick={onDescartar}
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Descartar</TooltipContent>
        </Tooltip>
      </span>

      {slot.estado === 'listo' && (
        <span className="absolute -right-2 -bottom-2 opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                className="rounded-full shadow-[var(--shadow-sm)]"
                aria-label={`Crear ${nombre} y generarla con IA`}
                disabled={!puedeLanzar || lanzando}
                onClick={() => {
                  if (nodo.current && puedeLanzar && !lanzando) {
                    onLanzar(nodo.current)
                  }
                }}
              >
                <Play className="fill-current" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {puedeLanzar
                ? 'Crear y generar con IA'
                : 'No hay una plantilla de asignatura disponible para este plan.'}
            </TooltipContent>
          </Tooltip>
        </span>
      )}
    </article>
  )
}
