import * as React from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type EtiquetaEnFocoProps = {
  /** Lo que el control ES. Hace de `label` mientras está enfocado. */
  etiqueta: string
  side?: React.ComponentProps<typeof TooltipContent>['side']
  className?: string
  children: React.ReactNode
}

/**
 * Etiqueta diferida para los controles que viven dentro de una frase editable.
 *
 * En esas frases —«Tiene 9 semestres»— no cabe un `Label` sobre cada control:
 * rompería la lectura y duplicaría el texto que la propia frase ya dice. Pero
 * al enfocar uno hace falta saber qué se está tocando. La solución es un
 * tooltip que no depende del hover: se abre con el foco y **permanece abierto**
 * mientras dure, así que funciona igual con teclado que con ratón, y desaparece
 * solo al salir del control.
 *
 * Complementa a `.grupo-enfoque` (styles.css): esa clase apaga el resto de la
 * frase y ésta nombra lo que queda encendido.
 */
export function EtiquetaEnFoco({
  etiqueta,
  side = 'bottom',
  className,
  children,
}: EtiquetaEnFocoProps) {
  const [enfocado, setEnfocado] = React.useState(false)

  return (
    <Tooltip open={enfocado}>
      <TooltipTrigger asChild>
        <span
          className={cn('inline-flex items-center', className)}
          onFocus={() => setEnfocado(true)}
          onBlur={(event) => {
            // El foco puede saltar entre el número y sus pasos +/−, que son
            // hermanos dentro de este mismo envoltorio: sólo se cierra cuando
            // sale de verdad del grupo.
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setEnfocado(false)
            }
          }}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side}>{etiqueta}</TooltipContent>
    </Tooltip>
  )
}
