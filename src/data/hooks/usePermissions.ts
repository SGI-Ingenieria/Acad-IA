import { useMemo } from 'react'

import { useSession } from './useAuth'

import {
  type AppPermission,
  getSessionPermissions,
  hasAnyPermission,
  hasBootstrapAccess,
  hasPermission,
} from '@/data/auth/permissions'

export function usePermissions() {
  const sessionQuery = useSession()
  const session = sessionQuery.data ?? null

  const permissions = useMemo(
    () => getSessionPermissions(session),
    [session?.access_token],
  )

  return {
    session,
    permissions,
    isLoading: sessionQuery.isLoading,
    has: (permission: AppPermission) => hasPermission(session, permission),
    hasAny: (items: Array<AppPermission>) => hasAnyPermission(session, items),
    hasBootstrapAccess: () => hasBootstrapAccess(session),
  }
}
