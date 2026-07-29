import { ZoomIn, ZoomOut } from 'lucide-react'
import { useState } from 'react'

import type { CSSProperties } from 'react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Pasos de la lupa. Saltos perceptibles pero no bruscos: cada uno crece
 * ~15–18 % sobre el anterior, de modo que el texto llega al doble en cinco
 * pulsaciones sin que ninguna reflowee el párrafo entero de golpe.
 */
const ESCALAS = [1, 1.15, 1.35, 1.6, 1.9, 2.25] as const

export type ZoomTipografico = ReturnType<typeof useZoomTipografico>

/**
 * Zoom que aumenta **sólo el tamaño de la letra** del contenido, no el de la
 * página. Nace de una necesidad concreta: al presentar un campo largo la gente
 * recurría al zoom del navegador, que agranda también cabecera, mandos y
 * márgenes y acaba obligando a hacer scroll horizontal.
 *
 * No es una opción de tipografía del documento: es una lente de la vista
 * ampliada. Por eso el paso de la lupa sólo cuenta mientras esa vista está
 * abierta (`activo`) y se olvida al cerrarla —el texto vuelve a su tamaño
 * normal, y un encabezado al suyo—. Antes la escala seguía aplicada a la
 * tarjeta plegada, donde ya no había mandos para deshacerla.
 *
 * El estado es presentación efímera de un componente concreto —no sobrevive a
 * la navegación ni pertenece a la URL— así que `useState` local es el dueño
 * correcto. La escala se publica como variable CSS y las reglas viven en
 * `richtext-editor.css` (`.zoom-tipografico`).
 *
 * @param escalaBase Tamaño de partida relativo (1 = base del canvas). Las
 * tarjetas destacadas arrancan por encima de 1 y la lupa multiplica desde ahí.
 * @param activo Si la vista ampliada está abierta. Con `false` la lupa no
 * aplica y su paso se descarta.
 */
export function useZoomTipografico(escalaBase = 1, activo = true) {
  const [indice, setIndice] = useState(0)

  // Ajuste de estado durante el render (patrón documentado de React para
  // reiniciar estado al cambiar una prop, sin efecto ni render desperdiciado):
  // abrir la vista ampliada empieza siempre al 100 %.
  const [activoPrevio, setActivoPrevio] = useState(activo)
  if (activo !== activoPrevio) {
    setActivoPrevio(activo)
    setIndice(0)
  }

  const paso = activo ? ESCALAS[indice] : 1
  const escala = paso * escalaBase

  return {
    escala,
    puedeAumentar: activo && indice < ESCALAS.length - 1,
    puedeReducir: activo && indice > 0,
    aumentar: () =>
      setIndice((actual) => Math.min(actual + 1, ESCALAS.length - 1)),
    reducir: () => setIndice((actual) => Math.max(actual - 1, 0)),
    /** Props del contenedor que envuelve al texto ampliable. */
    contenedor: {
      className: 'zoom-tipografico',
      style: { '--zoom-tipografico': escala } as CSSProperties,
    },
  }
}

/**
 * Mandos de la lupa. Sólo iconos: el porcentaje vive en el tooltip, que es
 * donde hace falta, y no en una etiqueta permanente que compita con el texto.
 */
export function ControlesZoomTipografico({
  zoom,
  className,
}: {
  zoom: ZoomTipografico
  className?: string
}) {
  const porcentaje = `${Math.round(zoom.escala * 100)} %`

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-full"
            aria-label="Reducir el tamaño de la letra"
            disabled={!zoom.puedeReducir}
            onClick={zoom.reducir}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reducir la letra ({porcentaje})</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-full"
            aria-label="Aumentar el tamaño de la letra"
            disabled={!zoom.puedeAumentar}
            onClick={zoom.aumentar}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Aumentar la letra ({porcentaje})</TooltipContent>
      </Tooltip>
    </div>
  )
}
