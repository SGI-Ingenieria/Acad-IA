import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useSession } from './useAuth'

import type { AppPermission } from '@/data/auth/permissions'

import {
  getSessionEffectiveAuthz,
  resolveEffectiveAuthz,
} from '@/data/auth/permissions'
import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'

export function usePermissions() {
  const sessionQuery = useSession()
  const session = sessionQuery.data ?? null
  const sessionAuthz = useMemo(
    () => getSessionEffectiveAuthz(session),
    [session],
  )

  const effectiveAuthzQuery = useQuery({
    queryKey: [...qk.effectiveAuthz(), session?.access_token ?? null],
    queryFn: () => resolveEffectiveAuthz(supabaseBrowser(), session),
    enabled: !!session,
    staleTime: 5 * 60_000,
  })

  const effectiveAuthz = effectiveAuthzQuery.data ?? sessionAuthz

  return {
    session,
    permissions: effectiveAuthz.permissions,
    roleKeys: effectiveAuthz.roleKeys,
    isAdmin: effectiveAuthz.isAdmin,
    isLoading: sessionQuery.isLoading || effectiveAuthzQuery.isLoading,
    has: (permission: AppPermission) =>
      effectiveAuthz.isAdmin || effectiveAuthz.permissions.has(permission),
    hasAny: (items: Array<AppPermission>) =>
      effectiveAuthz.isAdmin ||
      items.length === 0 ||
      items.some((permission) => effectiveAuthz.permissions.has(permission)),
    hasBootstrapAccess: () => effectiveAuthz.hasBootstrapAccess,
  }
}
