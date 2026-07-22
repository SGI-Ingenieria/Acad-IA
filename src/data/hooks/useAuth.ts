import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { throwIfError } from '../api/_helpers'
import {
  getSessionAppMetadata,
  getSessionEffectiveAuthz,
} from '../auth/permissions'
import { qk } from '../query/keys'
import { supabaseBrowser } from '../supabase/client'

import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'

let authSyncStarted = false
let startupRefreshPromise: Promise<void> | null = null
let authzRealtimeChannel: RealtimeChannel | null = null
let authzRealtimeUserId: string | null = null
let authzRefreshTimer: number | null = null

function startupRefreshNeeded(session: Session): boolean {
  // Solo forzamos un refresh de sesión en el arranque cuando aporta algo:
  // (a) el token está expirado o a punto de expirar (margen 60s), o
  // (b) faltan los claims de authz (roles/permisos) que inyecta el Custom
  //     Access Token Hook — p. ej. si el hook no estaba registrado cuando se
  //     emitió el token.
  // En recargas rápidas con un token todavía fresco y con claims evitamos el
  // round-trip redundante al servidor de auth. Contrapartida: un cambio de
  // permisos hecho mientras la app estuvo cerrada puede tardar hasta el
  // siguiente refresh natural (o evento realtime de authz) en reflejarse.
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = session.expires_at ?? 0
  if (expiresAt - nowSeconds <= 60) return true

  const authz = getSessionEffectiveAuthz(session)
  return (
    !authz.isAdmin && authz.roleKeys.size === 0 && authz.permissions.size === 0
  )
}

function invalidateAuthQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.session() })
  qc.invalidateQueries({ queryKey: qk.meProfile() })
  qc.invalidateQueries({ queryKey: qk.effectiveAuthz() })
  qc.invalidateQueries({ queryKey: qk.auth })
  qc.invalidateQueries({ queryKey: qk.planesRoot() })
  qc.invalidateQueries({ queryKey: qk.asignaturasRoot() })
  qc.invalidateQueries({ queryKey: qk.usuariosRoot() })
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
    supabase.auth.onAuthStateChange((event, session) => {
      startAuthzRealtime(supabase, qc, session)

      // TOKEN_REFRESHED e INITIAL_SESSION se disparan en cada rotación de token
      // (incluido al volver de una pestaña suspendida) y al hidratar la sesión.
      // Invalidar aquí planes/asignaturas/usuarios provocaba una tormenta de
      // refetch que hacía sentir lentísima la app al regresar. En esos casos
      // solo refrescamos la sesión y los claims de authz (barato y local); los
      // cambios reales de permisos siguen recargando los datos vía la
      // sincronización realtime de authz y los eventos de sesión de abajo.
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        qc.invalidateQueries({ queryKey: qk.session() })
        qc.invalidateQueries({ queryKey: qk.effectiveAuthz() })
        return
      }

      // SIGNED_IN / SIGNED_OUT / USER_UPDATED / PASSWORD_RECOVERY: la identidad
      // o los permisos pueden haber cambiado; recargamos todo.
      invalidateAuthQueries(qc)
    })
  }

  if (!startupRefreshPromise) {
    startupRefreshPromise = (async () => {
      try {
        const { data: s } = await supabase.auth.getSession()
        startAuthzRealtime(supabase, qc, s.session ?? null)
        if (s.session && startupRefreshNeeded(s.session)) {
          await supabase.auth.refreshSession()
        }
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
      // Una sola lectura local de la sesión: de ahí salen tanto el id como los
      // claims de authz. Antes hacía getUser() (red) + getSession() (local),
      // duplicando trabajo y añadiendo un round-trip innecesario.
      const { data: sessionData, error: sErr } =
        await supabase.auth.getSession()
      throwIfError(sErr)
      const session = sessionData.session
      const userId = session?.user.id
      if (!userId) return null
      const appMetadata = getSessionAppMetadata(session)

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
