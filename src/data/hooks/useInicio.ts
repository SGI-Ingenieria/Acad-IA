import { useQuery } from '@tanstack/react-query'

import type { ContextoMesaTrabajo } from '@/data/api/inicio.api'

import { inicio_mesa_trabajo } from '@/data/api/inicio.api'
import { qk } from '@/data/query/keys'

export function useMesaTrabajo(contexto: ContextoMesaTrabajo | null) {
  return useQuery({
    queryKey: qk.inicio(contexto),
    queryFn: () => inicio_mesa_trabajo(contexto!),
    enabled: Boolean(contexto),
    staleTime: 30_000,
  })
}
