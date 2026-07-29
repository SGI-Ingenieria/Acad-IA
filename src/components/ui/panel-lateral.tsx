import { X } from 'lucide-react'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { SheetDescription, SheetTitle } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Cabecera de un panel lateral: título, acciones del panel y cierre, todo en
 * una sola fila.
 *
 * `SheetContent` trae un cierre propio posicionado en absoluto sobre la esquina
 * superior derecha. Es cómodo mientras el panel no pone nada ahí, pero estos
 * paneles sí lo hacen —«Invitar», el orden y los filtros de una lista— y el
 * aspa acababa encima de esos controles; la solución anterior, reservarle una
 * franja de 48 px arriba, dejaba el título del panel por debajo del cierre y un
 * hueco vacío a media altura.
 *
 * Aquí el cierre deja de flotar y se rinde como un control más de la fila, que
 * es lo que ya hacía la cabecera del chat de IA. Así el encabezado y el aspa
 * comparten línea base, el ancho útil se reparte por layout en vez de por
 * posicionamiento absoluto, y ningún panel puede volver a colisionar con un
 * elemento que no sabe que existe.
 *
 * Quien la use debe suprimir el cierre por defecto con
 * `showCloseButton={false}` en `SheetContent`.
 *
 * El título se emite como `SheetTitle` (y la descripción como
 * `SheetDescription`), así que este componente satisface por sí solo el
 * requisito de accesibilidad de Radix: no hace falta una cabecera `sr-only`
 * aparte.
 */
export function PanelLateralHeader({
  icono: Icono,
  titulo,
  descripcion,
  acciones,
  onCerrar,
  className,
}: {
  icono?: LucideIcon
  titulo: ReactNode
  /** Contexto para lectores de pantalla; no se pinta. */
  descripcion?: string
  /** Acciones propias del panel. Se alinean a la izquierda del cierre. */
  acciones?: ReactNode
  onCerrar: () => void
  className?: string
}) {
  return (
    <header
      className={cn(
        'border-border/60 flex min-h-12 shrink-0 items-center gap-2 border-b px-4 py-2',
        className,
      )}
    >
      <SheetTitle className="flex min-w-0 flex-1 items-center gap-2 text-base">
        {Icono && (
          <Icono
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        )}
        <span className="truncate">{titulo}</span>
      </SheetTitle>

      {descripcion && (
        <SheetDescription className="sr-only">{descripcion}</SheetDescription>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {acciones}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8"
              onClick={onCerrar}
              aria-label="Cerrar panel"
            >
              <X className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cerrar panel</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
