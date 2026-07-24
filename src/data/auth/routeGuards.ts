import { redirect } from '@tanstack/react-router'

import { resolveEffectiveAuthz } from './permissions'

import type { AppPermission } from './permissions'
import type { Session } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'

import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'

async function ensureSession(
  queryClient: QueryClient,
): Promise<Session | null> {
  return queryClient.ensureQueryData({
    queryKey: qk.session(),
    queryFn: async () => {
      const { data } = await supabaseBrowser().auth.getSession()
      return data.session ?? null
    },
    staleTime: 60_000,
  })
}

function ensureEffectiveAuthz(
  queryClient: QueryClient,
  session: Session | null,
) {
  return queryClient.ensureQueryData({
    queryKey: [...qk.effectiveAuthz(), session?.access_token ?? null],
    queryFn: () => resolveEffectiveAuthz(supabaseBrowser(), session),
    staleTime: 5 * 60_000,
  })
}

/**
 * Resuelve la sesión y el authz efectivo desde la caché (o la red) para
 * decisiones de ruta que no son un simple permitir/denegar, p. ej. redirigir
 * al primer destino visible. Redirige a `/` si no hay sesión.
 */
export async function resolveRouteAuthz(queryClient: QueryClient) {
  const session = await ensureSession(queryClient)
  if (!session) {
    throw redirect({ to: '/' })
  }
  const effectiveAuthz = await ensureEffectiveAuthz(queryClient, session)
  return { session, effectiveAuthz }
}

export async function requireAnyPermission(
  queryClient: QueryClient,
  permissions: Array<AppPermission>,
) {
  const session = await ensureSession(queryClient)
  if (!session) {
    throw redirect({ to: '/' })
  }

  const effectiveAuthz = await ensureEffectiveAuthz(queryClient, session)

  if (
    !effectiveAuthz.isAdmin &&
    permissions.length > 0 &&
    !permissions.some((permission) =>
      effectiveAuthz.permissions.has(permission),
    )
  ) {
    throw redirect({ to: '/' })
  }

  return session
}

export async function requireAnyPermissionOrBootstrap(
  queryClient: QueryClient,
  permissions: Array<AppPermission>,
) {
  const session = await ensureSession(queryClient)
  if (!session) {
    throw redirect({ to: '/' })
  }

  const effectiveAuthz = await ensureEffectiveAuthz(queryClient, session)

  if (
    !effectiveAuthz.hasBootstrapAccess &&
    !effectiveAuthz.isAdmin &&
    permissions.length > 0 &&
    !permissions.some((permission) =>
      effectiveAuthz.permissions.has(permission),
    )
  ) {
    throw redirect({ to: '/' })
  }

  return session
}

export async function requireAcademicCatalogEditor(queryClient: QueryClient) {
  const session = await ensureSession(queryClient)
  if (!session) {
    throw redirect({ to: '/' })
  }

  const effectiveAuthz = await ensureEffectiveAuthz(queryClient, session)
  const allowed =
    effectiveAuthz.isAdmin ||
    effectiveAuthz.permissions.has('catalogos.gestionar') ||
    effectiveAuthz.permissions.has('planes.editar') ||
    effectiveAuthz.roleKeys.has('VICERRECTOR_ACADEMICO') ||
    effectiveAuthz.roleKeys.has('DIRECTOR_FACULTAD') ||
    effectiveAuthz.roleKeys.has('SECRETARIO_ACADEMICO') ||
    effectiveAuthz.roleKeys.has('JEFE_POSGRADO') ||
    effectiveAuthz.roleKeys.has('JEFE_CARRERA')

  if (!allowed) {
    throw redirect({ to: '/' })
  }

  return session
}

export async function requireAdmin(queryClient: QueryClient) {
  const session = await ensureSession(queryClient)
  if (!session) {
    throw redirect({ to: '/' })
  }

  const effectiveAuthz = await ensureEffectiveAuthz(queryClient, session)
  if (!effectiveAuthz.isAdmin) {
    throw redirect({ to: '/' })
  }

  return session
}
