import { Play, RotateCcw, X } from 'lucide-react'
import { useRef } from 'react'

import { usePropsHalo } from '../AgenteHalo'
import { EsqueletoAgente } from '../EsqueletoAgente'

import type { SugerenciaSlot } from '@/data'

import { Button } from '@/components/ui/button'
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
  onDescartar,
  onReintentar,
  onLanzar,
}: {
  slot: SugerenciaSlot
  /** Paleta de las líneas curriculares del plan, para el halo mientras piensa. */
  colores?: Array<string> | null
  puedeLanzar: boolean
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
        'group/postit border-border/70 bg-card relative h-32 w-56 shrink-0 rounded-xl border p-3 shadow-[var(--shadow-xs)]',
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
        <div className="flex flex-col gap-2 overflow-hidden">
          <EsqueletoAgente className="h-5 w-4/5" />
          <EsqueletoAgente className="h-3 w-full" />
          <EsqueletoAgente className="h-3 w-11/12" />
          <EsqueletoAgente className="h-3 w-2/3" />
        </div>
      )}

      {slot.estado === 'listo' && slot.sugerencia && (
        <>
          <h3 className="line-clamp-2 text-base leading-snug font-semibold tracking-tight">
            {nombre}
          </h3>
          <p className="text-muted-foreground mt-1 line-clamp-3 text-xs leading-snug">
            {slot.sugerencia.descripcion}
          </p>
        </>
      )}

      {slot.estado === 'error' && (
        <div className="flex h-full flex-col justify-between gap-2">
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

      {slot.estado === 'listo' && puedeLanzar && (
        <span
          className={cn(
            'absolute -right-2 -bottom-2 transition-opacity',
            'opacity-100 lg:opacity-0',
            'lg:group-focus-within/postit:opacity-100 lg:group-hover/postit:opacity-100',
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                className="rounded-full shadow-[var(--shadow-sm)]"
                aria-label={`Crear ${nombre} y generarla con IA`}
                onClick={() => {
                  if (nodo.current) onLanzar(nodo.current)
                }}
              >
                <Play className="fill-current" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Crear y generar con IA</TooltipContent>
          </Tooltip>
        </span>
      )}
    </article>
  )
}
