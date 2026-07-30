import type { FaseDisenoCurricular } from '@/data'

export function rutaContinuacionCurricular(
  fase: FaseDisenoCurricular | null | undefined,
): '/planes/$planId/bloques' | '/planes/$planId/mapa' {
  return fase === 'MAPA' ? '/planes/$planId/mapa' : '/planes/$planId/bloques'
}
