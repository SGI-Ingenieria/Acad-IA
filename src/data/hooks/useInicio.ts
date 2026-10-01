import { useQuery } from '@tanstack/react-query'

import type { ContextoMesaTrabajo } from '@/data/api/inicio.api'

import { inicio_workspace } from '@/data/api/inicio.api'
import { qk } from '@/data/query/keys'

export function useMesaTrabajo(contexto: ContextoMesaTrabajo | null) {
  return useQuery({
    queryKey: qk.inicioWorkspace(contexto),
    queryFn: () => inicio_workspace(contexto!),
    enabled: Boolean(contexto),
    staleTime: 30_000,
  })
}
