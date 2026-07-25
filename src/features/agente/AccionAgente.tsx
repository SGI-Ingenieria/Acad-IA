import { useAccionAgente } from './useAccionAgente'

import type {
  OpcionesAccionAgente,
  ResultadoAccionAgente,
} from './useAccionAgente'
import type { ReactNode } from 'react'

/**
 * Adaptador de `useAccionAgente` para listas: dentro de un `map` no se pueden
 * llamar hooks, y el mapa curricular necesita una acción por línea y una por
 * asignatura suelta.
 *
 * No pinta nada —ni un envoltorio— a propósito: las celdas del mapa son hijas
 * directas de un `grid`, así que cualquier `div` intermedio rompería el layout.
 * El consumidor decide dónde van las props de interceptación y el halo.
 */
export function AccionAgente<TResultado = unknown, TSnapshot = unknown>({
  opciones,
  children,
}: {
  opciones: OpcionesAccionAgente<TResultado, TSnapshot>
  children: (estado: ResultadoAccionAgente) => ReactNode
}) {
  const estado = useAccionAgente(opciones)
  return <>{children(estado)}</>
}
