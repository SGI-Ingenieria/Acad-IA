import type { CSSProperties } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface EstadoBadgeProps {
  /** Texto del estado (p. ej. "En revisión de Planeación Curricular"). */
  etiqueta: string
  /** Color del estado en hex; si viene, tiñe el fondo y el borde del badge. */
  colorHex?: string | null
  /** Clases de color de respaldo cuando no hay `colorHex` (p. ej. 'bg-secondary'). */
  claseColor?: string
  className?: string
}

/**
 * Badge del estado de un plan/asignatura: texto blanco con contorno negro sobre
 * el color del estado.
 *
 * Trunca por elipsis las etiquetas largas (el texto completo queda disponible en
 * el `title`) y puede encogerse dentro de su contenedor —anula el `shrink-0` del
 * Badge base y usa `min-w-0`— para no desbordar la tarjeta o cabecera que lo
 * contiene.
 */
export function EstadoBadge({
  etiqueta,
  colorHex,
  claseColor,
  className,
}: EstadoBadgeProps) {
  const style: CSSProperties | undefined = colorHex
    ? { backgroundColor: colorHex, borderColor: colorHex }
    : undefined

  return (
    <Badge
      style={style}
      title={etiqueta}
      className={cn(
        'max-w-full min-w-0 shrink text-sm font-semibold',
        !colorHex && claseColor,
        className,
      )}
    >
      <span className="min-w-0 truncate text-white [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000,0_1px_0_#000,0_-1px_0_#000,1px_0_0_#000,-1px_0_0_#000]">
        {etiqueta}
      </span>
    </Badge>
  )
}
