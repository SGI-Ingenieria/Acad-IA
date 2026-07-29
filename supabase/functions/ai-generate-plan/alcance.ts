/**
 * Alcance de la generación: qué se le pide a la IA además del plan.
 *
 * Hasta ahora la función generaba siempre lo mismo —el plan y sus líneas
 * curriculares— y el usuario no tenía forma de pedir más ni de pedir menos.
 * Las opciones son jerárquicas y no independientes. Organizar las asignaturas
 * en el mapa requiere generar tanto asignaturas como líneas curriculares.
 * `acomodarAsignaturas` y `ordenarAsignaturas` permanecen en el contrato por
 * compatibilidad, pero representan una sola decisión y siempre se normalizan
 * al mismo valor.
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

  const organizarEnMapa =
    base.lineasCurriculares && base.asignaturas && base.acomodarAsignaturas

  return {
    ...base,
    acomodarAsignaturas: organizarEnMapa,
    ordenarAsignaturas: organizarEnMapa,
  }
}
