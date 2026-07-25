import { useMemo } from 'react'

import { usePlanLineas } from '@/data'

/**
 * Paleta del halo del agente: los colores de las líneas curriculares del plan.
 *
 * El brief pide que el borde arcoíris que rodea a un elemento en proceso use
 * "los colores de las líneas curriculares actuales", no una paleta genérica. En
 * el mapa eso sale gratis porque la vista ya tiene las líneas cargadas; en el
 * detalle de asignatura no, y sin este atajo cada superficie tendría que
 * duplicar la consulta y el filtrado.
 *
 * Devuelve `null` cuando el plan no define colores, que es justo lo que
 * `estiloHaloAgente` interpreta como "usa los tokens por defecto".
 */
export function useColoresLineas(
  planId: string | null | undefined,
): Array<string> | null {
  const { data: lineas } = usePlanLineas(planId)

  return useMemo(() => {
    const colores = (lineas ?? [])
      .map((linea) => linea.color)
      .filter((color): color is string => Boolean(color))

    return colores.length > 0 ? colores : null
  }, [lineas])
}
