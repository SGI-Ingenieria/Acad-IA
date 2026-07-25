import { useMemo } from 'react'

import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Colores por defecto del halo cuando la superficie no tiene una paleta propia
 * (p. ej. datos generales del plan, donde no hay líneas curriculares a la
 * vista). Son tokens, no literales: siguen al tema.
 */
const COLORES_POR_DEFECTO = [
  'var(--primary)',
  'var(--chart-5)',
  'var(--chart-3)',
  'var(--accent)',
]

/**
 * Cómo se dibuja el halo sobre el elemento en curso:
 *
 * - `'borde'` — marco completo. Es lo correcto cuando el elemento ya es una
 *   superficie (tarjeta, celda, post-it).
 * - `'subrayado'` — sólo la rayita inferior, encendida. Es lo correcto cuando
 *   el elemento es una cifra suelta que ya se apoya en un subrayado: rodearla
 *   con una caja añadiría un borde donde ya había uno.
 */
export type VarianteHalo = 'borde' | 'subrayado'

export const CLASE_HALO: Record<VarianteHalo, string> = {
  borde: 'agente-borde-arcoiris',
  subrayado: 'agente-subrayado-arcoiris',
}

/**
 * Traduce una paleta de líneas curriculares a las cuatro variables que consume
 * el halo. Se ciclan los colores disponibles para que el degradado cierre
 * siempre con cuatro paradas, sin importar si el plan tiene una línea o doce.
 */
export function estiloHaloAgente(
  colores?: Array<string> | null,
): CSSProperties {
  const paleta = colores && colores.length > 0 ? colores : COLORES_POR_DEFECTO

  return {
    '--agente-c1': paleta[0 % paleta.length],
    '--agente-c2': paleta[1 % paleta.length],
    '--agente-c3': paleta[2 % paleta.length],
    '--agente-c4': paleta[3 % paleta.length],
  } as CSSProperties
}

/**
 * Props para pegar el halo a un elemento que ya existe, sin envolverlo en un
 * `div` extra (importante en grids y flex, donde un wrapper rompería el
 * layout).
 *
 * ```tsx
 * const halo = usePropsHalo(ejecutando, palette)
 * <Card {...halo} />
 * ```
 */
export function usePropsHalo(
  activo: boolean,
  colores?: Array<string> | null,
  variante: VarianteHalo = 'borde',
): { className?: string; style?: CSSProperties } {
  return useMemo(() => {
    if (!activo) return {}
    return {
      className: CLASE_HALO[variante],
      style: estiloHaloAgente(colores),
    }
  }, [activo, colores, variante])
}

export type AgenteHaloProps = {
  /** Mientras es `true`, el elemento lleva el borde arcoíris girando. */
  activo: boolean
  /** Paleta de las líneas curriculares del plan, si la superficie la conoce. */
  colores?: Array<string> | null
  variante?: VarianteHalo
  className?: string
  children: ReactNode
}

/**
 * Envoltura para cuando sí conviene un contenedor propio (celdas del mapa,
 * post-its). Para tarjetas ya existentes prefiere `usePropsHalo`.
 */
export function AgenteHalo({
  activo,
  colores,
  variante = 'borde',
  className,
  children,
}: AgenteHaloProps) {
  const style = useMemo(
    () => (activo ? estiloHaloAgente(colores) : undefined),
    [activo, colores],
  )

  return (
    <div
      className={cn(
        'rounded-[inherit]',
        activo && CLASE_HALO[variante],
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}
