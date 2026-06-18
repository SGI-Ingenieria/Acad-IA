import type { QueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'

import { redirect } from '@tanstack/react-router'

import {
  type AppPermission,
  hasAnyPermission,
  hasBootstrapAccess,
} from './permissions'

import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'

async function ensureSession(queryClient: QueryClient): Promise<Session | null> {
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

  if (!session || !hasAnyPermission(session, permissions)) {
    throw redirect({ to: '/' })
  }

  return session
}

export async function requireAnyPermissionOrBootstrap(
  queryClient: QueryClient,
  permissions: Array<AppPermission>,
) {
  const session = await ensureSession(queryClient)

  if (
    !session ||
    (!hasBootstrapAccess(session) && !hasAnyPermission(session, permissions))
  ) {
    throw redirect({ to: '/' })
  }

  return session
}
