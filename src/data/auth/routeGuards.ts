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
    staleTime: 0,
  })
}

export async function requireAnyPermission(
  queryClient: QueryClient,
  permissions: Array<AppPermission>,
) {
  const session = await ensureSession(queryClient)
  const effectiveAuthz = await resolveEffectiveAuthz(supabaseBrowser(), session)

  if (
    !session ||
    (!effectiveAuthz.isAdmin &&
      permissions.length > 0 &&
      !permissions.some((permission) =>
        effectiveAuthz.permissions.has(permission),
      ))
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
  const effectiveAuthz = await resolveEffectiveAuthz(supabaseBrowser(), session)

  if (
    !session ||
    (!effectiveAuthz.hasBootstrapAccess &&
      !effectiveAuthz.isAdmin &&
      permissions.length > 0 &&
      !permissions.some((permission) =>
        effectiveAuthz.permissions.has(permission),
      ))
  ) {
    throw redirect({ to: '/' })
  }

  return session
}
