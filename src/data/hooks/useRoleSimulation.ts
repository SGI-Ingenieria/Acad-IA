import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  activarRolSimulacion,
  buscarAsignaturasParaSimulacion,
  desactivarRolSimulacion,
  getRoleSimulationCatalogos,
} from '../api/usuarios.api'
import { isRoleSimulationActive } from '../auth/permissions'
import { qk } from '../query/keys'
import { supabaseBrowser } from '../supabase/client'

import type { ActivarRolSimulacionInput } from '../api/usuarios.api'
import type { Session } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'

type SimulationExpectation = 'active' | 'inactive'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sessionMatchesExpectation(
  session: Session | null,
  expectation: SimulationExpectation,
) {
  const active = isRoleSimulationActive(session)
  return expectation === 'active' ? active : !active
}

async function refreshSessionForSimulation(
  expectation: SimulationExpectation,
): Promise<Session | null> {
  const supabase = supabaseBrowser()
  let session: Session | null = null

  for (const delay of [0, 300]) {
    if (delay > 0) await wait(delay)

    const { data, error } = await supabase.auth.refreshSession()
    if (error) throw error

    session = data.session ?? null
    if (sessionMatchesExpectation(session, expectation)) return session
  }

  throw new Error(
    expectation === 'active'
      ? 'La sesión todavía no refleja la simulación activa. Intenta de nuevo.'
      : 'La sesión todavía conserva la simulación activa. Intenta de nuevo.',
  )
}

async function refreshAuthz(
  queryClient: QueryClient,
  expectation: SimulationExpectation,
) {
  const session = await refreshSessionForSimulation(expectation)

  queryClient.setQueryData(qk.session(), session)
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.meProfile() }),
    queryClient.invalidateQueries({ queryKey: qk.effectiveAuthz() }),
  ])
}

export function useRoleSimulationCatalogos(enabled: boolean) {
  return useQuery({
    queryKey: [...qk.usuariosCatalogos(), 'simulation'],
    queryFn: getRoleSimulationCatalogos,
    enabled,
    staleTime: 30_000,
  })
}

export function useRoleSimulationSubjects(
  filters: { q: string; limit?: number },
  enabled: boolean,
) {
  return useQuery({
    queryKey: qk.rolSimulacionAsignaturas(filters),
    queryFn: () => buscarAsignaturasParaSimulacion(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useActivateRoleSimulation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ActivarRolSimulacionInput) =>
      activarRolSimulacion(input),
    onSuccess: async () => {
      await refreshAuthz(queryClient, 'active')
    },
  })
}

export function useDeactivateRoleSimulation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: desactivarRolSimulacion,
    onSuccess: async () => {
      await refreshAuthz(queryClient, 'inactive')
    },
  })
}
