import type { CarreraRow, TipoEstructuraPlan } from '@/data/types/domain'

import { formatNombrePlanCurricular } from '@/lib/plan-curricular'

/**
 * Nombre normativo de un plan curricular, o `null` si todavía no puede
 * derivarse (falta la carrera, falta el mes de impartición o el plan no es
 * curricular).
 *
 * El nombre de un plan curricular no se escribe: se deriva del nivel, la
 * carrera y el inicio de impartición. Vive aquí —y no en el paso que lo
 * muestra— porque son tres pasos distintos los que pueden invalidarlo: elegir
 * la naturaleza del plan, elegir la carrera y cambiar el mes.
 */
export function nombrePlanCurricularDerivado(
  carrera: CarreraRow | undefined,
  fecha: string | null,
  tipoEstructura: TipoEstructuraPlan | null,
): string | null {
  if (tipoEstructura !== 'CURRICULAR') return null
  if (!carrera || !fecha) return null
  return formatNombrePlanCurricular(carrera.nivel, carrera.nombre, fecha)
}

/** Nombre inicial de un plan no curricular, que sí es editable a mano. */
export function nombrePlanPorOmision(carrera: CarreraRow | undefined) {
  return carrera ? `${carrera.nombre} (${new Date().getFullYear()})` : ''
}
