import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { throwIfError } from '../api/_helpers'
import { getSessionAppMetadata } from '../auth/permissions'
import { qk } from '../query/keys'
import { supabaseBrowser } from '../supabase/client'

import type { QueryClient } from '@tanstack/react-query'

let authSyncStarted = false
let startupRefreshPromise: Promise<void> | null = null

function invalidateAuthQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.session() })
  qc.invalidateQueries({ queryKey: qk.meProfile() })
  qc.invalidateQueries({ queryKey: qk.effectiveAuthz() })
  qc.invalidateQueries({ queryKey: qk.auth })
}

function ensureAuthSync(
  supabase: ReturnType<typeof supabaseBrowser>,
  qc: QueryClient,
) {
  if (!authSyncStarted) {
    authSyncStarted = true
    supabase.auth.onAuthStateChange(() => {
      invalidateAuthQueries(qc)
    })
  }

  if (!startupRefreshPromise) {
    startupRefreshPromise = (async () => {
      try {
        const { data: s } = await supabase.auth.getSession()
        if (s.session) await supabase.auth.refreshSession()
      } catch {
        /* ignore startup refresh errors */
      }
    })()
  }
}

export function useSession() {
  const supabase = supabaseBrowser()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: qk.session(),
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession()
      throwIfError(error)
      return data.session ?? null
    },
    staleTime: Infinity,
  })

  useEffect(() => {
    ensureAuthSync(supabase, qc)
  }, [supabase, qc])

  return query
}

export function useMeProfile() {
  const supabase = supabaseBrowser()

  return useQuery({
    queryKey: qk.meProfile(),
    queryFn: async () => {
      const { data: u, error: uErr } = await supabase.auth.getUser()
      throwIfError(uErr)
      const userId = u.user?.id
      if (!userId) return null
      const { data: sessionData } = await supabase.auth.getSession()
      const appMetadata = getSessionAppMetadata(sessionData.session)

      const { data, error } = await supabase
        .from('usuarios_app')
        .select('id,nombre_completo,clave,externo,creado_en,actualizado_en')
        .eq('id', userId)
        .single()

      // si aún no existe perfil en usuarios_app, permite null (tu seed/trigger puede crearlo)
      if (error && (error as any).code === 'PGRST116') return null

      throwIfError(error)
      return data
        ? {
            ...data,
            roles: appMetadata.roles ?? [],
            roles_claves: appMetadata.roles_claves ?? [],
            permisos: appMetadata.permisos ?? [],
            alcances: appMetadata.alcances ?? null,
            authz_bootstrap: appMetadata.authz_bootstrap === true,
          }
        : null
    },
    staleTime: 60_000,
  })
}
