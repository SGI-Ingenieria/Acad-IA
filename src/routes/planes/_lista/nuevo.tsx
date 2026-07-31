import { createFileRoute } from '@tanstack/react-router'

import { RoutePendingDialog } from '@/components/ui/route-pending-skeleton'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import NuevoPlanModalContainer from '@/features/planes/nuevo/NuevoPlanModalContainer'

export const Route = createFileRoute('/planes/_lista/nuevo')({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, ['planes.crear']),
  pendingComponent: NuevoPlanPending,
  component: NuevoPlanModalContainer,
})

function NuevoPlanPending() {
  return <RoutePendingDialog title="Nuevo plan de estudios" />
}
