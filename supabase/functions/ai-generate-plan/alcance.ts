/**
 * Alcance de la generación: qué se le pide a la IA además del plan.
 *
 * Hasta ahora la función generaba siempre lo mismo —el plan y sus líneas
 * curriculares— y el usuario no tenía forma de pedir más ni de pedir menos.
 * Las opciones son jerárquicas y no independientes: acomodar, ordenar, poner
 * horas y proponer bibliografía son cosas que se le hacen *a las asignaturas*,
 * y no significan nada si no se generan asignaturas. `normalizarAlcance` es
 * quien impone esa dependencia, en el servidor, para que una carga útil
 * incoherente —fabricada a mano o venida de un cliente viejo— no acabe en un
 * prompt que pide ordenar una lista vacía.
 */

export type AlcanceGeneracionPlan = {
  lineasCurriculares: boolean
  asignaturas: boolean
  acomodarAsignaturas: boolean
  ordenarAsignaturas: boolean
  horasAsignaturas: boolean
  bibliografia: boolean
}

/**
 * Lo que hacía la función antes de que el alcance existiera. Es también lo que
 * recibe un cliente que no manda `alcance`: sin este valor, desplegar el
 * backend antes que el frontend dejaría de generar líneas sin que nadie lo
 * hubiera pedido.
 */
export const ALCANCE_POR_DEFECTO: AlcanceGeneracionPlan = {
  lineasCurriculares: true,
  asignaturas: false,
  acomodarAsignaturas: false,
  ordenarAsignaturas: false,
  horasAsignaturas: false,
  bibliografia: false,
}

export function normalizarAlcance(
  entrada: Partial<AlcanceGeneracionPlan> | null | undefined,
): AlcanceGeneracionPlan {
  const base = { ...ALCANCE_POR_DEFECTO, ...(entrada ?? {}) }

  if (!base.asignaturas) {
    return {
      lineasCurriculares: base.lineasCurriculares,
      asignaturas: false,
      acomodarAsignaturas: false,
      ordenarAsignaturas: false,
      horasAsignaturas: false,
      bibliografia: false,
    }
  }

  return {
    ...base,
    // Sin líneas curriculares no hay dónde acomodar: el ciclo sí se puede
    // asignar, pero la línea no, así que la opción se apaga sola.
    acomodarAsignaturas: base.acomodarAsignaturas,
    // El orden dentro de una celda sólo tiene sentido si algo las agrupa en
    // celdas; si no se acomodan, todas caen fuera del mapa.
    ordenarAsignaturas: base.acomodarAsignaturas && base.ordenarAsignaturas,
  }
}
