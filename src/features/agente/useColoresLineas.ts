import { useMemo } from 'react'

import { usePlanLineas } from '@/data'
import { colorLineaCurricular } from '@/lib/linea-curricular-colors'

/**
 * Paleta del halo del agente: los colores de las líneas curriculares del plan.
 *
 * El brief pide que el borde arcoíris que rodea a un elemento en proceso use
 * "los colores de las líneas curriculares actuales", no una paleta genérica. En
 * el mapa eso sale gratis porque la vista ya tiene las líneas cargadas; en el
 * detalle de asignatura no, y sin este atajo cada superficie tendría que
 * duplicar la consulta y el filtrado.
 *
 * Una línea heredada puede no traer color persistido. En ese caso usa la
 * misma paleta estable que el mapa curricular, para que el resto de vistas no
 * caiga a gris mientras el mapa sí consigue distinguirlas. Sólo devuelve
 * `null` cuando el plan realmente no tiene líneas.
 */
export function useColoresLineas(
  planId: string | null | undefined,
): Array<string> | null {
  const { data: lineas } = usePlanLineas(planId)

  return useMemo(() => {
    const colores = (lineas ?? []).map((linea, index) =>
      colorLineaCurricular(linea, index),
    )

    return colores.length > 0 ? colores : null
  }, [lineas])
}
