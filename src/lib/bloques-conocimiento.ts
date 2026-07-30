import type { LineaPlan } from '@/data/types/domain'

/**
 * `proposito` es el campo canónico. Los otros dos pertenecen a la primera
 * versión del modelo y se siguen leyendo para no ocultar contenido histórico.
 */
export function descripcionBloque(
  linea: Pick<
    LineaPlan,
    'proposito' | 'aporte_perfil_egreso' | 'alcance_formativo'
  >,
): string {
  return [linea.proposito, linea.aporte_perfil_egreso, linea.alcance_formativo]
    .map((parte) => (parte ?? '').trim())
    .filter(Boolean)
    .join('\n\n')
}

export const GUIA_DESCRIPCION_BLOQUE =
  'Explica qué cuerpo de conocimiento organiza, qué aporta al perfil de egreso y qué delimita.'
