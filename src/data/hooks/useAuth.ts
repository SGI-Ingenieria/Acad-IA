import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { throwIfError } from '../api/_helpers'
import { getSessionAppMetadata } from '../auth/permissions'
import { qk } from '../query/keys'
import { supabaseBrowser } from '../supabase/client'

import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'

let authSyncStarted = false
let startupRefreshPromise: Promise<void> | null = null
let authzRealtimeChannel: RealtimeChannel | null = null
let authzRealtimeUserId: string | null = null
let authzRefreshTimer: number | null = null

function invalidateAuthQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.session() })
  qc.invalidateQueries({ queryKey: qk.meProfile() })
  qc.invalidateQueries({ queryKey: qk.effectiveAuthz() })
  qc.invalidateQueries({ queryKey: qk.auth })
  qc.invalidateQueries({ queryKey: ['planes'] })
  qc.invalidateQueries({ queryKey: ['asignaturas'] })
  qc.invalidateQueries({ queryKey: ['usuarios'] })
}

function scheduleAuthzRefresh(
  supabase: ReturnType<typeof supabaseBrowser>,
  qc: QueryClient,
) {
  if (authzRefreshTimer !== null) {
    window.clearTimeout(authzRefreshTimer)
  }

  authzRefreshTimer = window.setTimeout(() => {
    authzRefreshTimer = null
    void supabase.auth
      .refreshSession()
      .catch((error) =>
        console.warn('[authz realtime] session refresh failed', error),
      )
      .finally(() => invalidateAuthQueries(qc))
  }, 250)
}

function stopAuthzRealtime(supabase: ReturnType<typeof supabaseBrowser>) {
  if (!authzRealtimeChannel) return
  try {
    supabase.removeChannel(authzRealtimeChannel)
  } catch {
    /* noop */
  }
  authzRealtimeChannel = null
  authzRealtimeUserId = null
}

function startAuthzRealtime(
  supabase: ReturnType<typeof supabaseBrowser>,
  qc: QueryClient,
  session: Session | null,
) {
  const userId = session?.user.id ?? null
  if (!userId) {
    stopAuthzRealtime(supabase)
    return
  }

  if (authzRealtimeChannel && authzRealtimeUserId === userId) return

  stopAuthzRealtime(supabase)
  authzRealtimeUserId = userId
  authzRealtimeChannel = supabase
    .channel(`authz-sync:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'usuarios_app',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        const nextProfile = payload.new as { dado_de_baja_en?: string | null }
        if (nextProfile.dado_de_baja_en) {
          void supabase.auth.signOut().finally(() => invalidateAuthQueries(qc))
          return
        }
        scheduleAuthzRefresh(supabase, qc)
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'usuarios_roles',
        filter: `usuario_id=eq.${userId}`,
      },
      () => scheduleAuthzRefresh(supabase, qc),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'usuarios_roles',
        filter: `usuario_id=eq.${userId}`,
      },
      () => scheduleAuthzRefresh(supabase, qc),
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'usuarios_roles',
      },
      () => scheduleAuthzRefresh(supabase, qc),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'roles_permisos',
      },
      () => scheduleAuthzRefresh(supabase, qc),
    )
    .subscribe()
}

function ensureAuthSync(
  supabase: ReturnType<typeof supabaseBrowser>,
  qc: QueryClient,
) {
  if (!authSyncStarted) {
    authSyncStarted = true
    supabase.auth.onAuthStateChange((_event, session) => {
      startAuthzRealtime(supabase, qc, session)
      invalidateAuthQueries(qc)
    })
  }

  if (!startupRefreshPromise) {
    startupRefreshPromise = (async () => {
      try {
        const { data: s } = await supabase.auth.getSession()
        startAuthzRealtime(supabase, qc, s.session ?? null)
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
