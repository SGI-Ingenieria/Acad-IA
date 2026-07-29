import { useMutation } from '@tanstack/react-query'

import { analizar_encuadre_plan } from '@/data/api/aiBrief.api'
import { mk } from '@/data/query/keys'

export function useAnalizarEncuadrePlan() {
  return useMutation({
    mutationKey: mk.encuadrePlan(),
    mutationFn: analizar_encuadre_plan,
    // El wizard conserva el contexto y muestra el error una sola vez.
    meta: { errorMessage: false },
  })
}
