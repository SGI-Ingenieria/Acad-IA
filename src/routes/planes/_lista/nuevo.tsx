import { createFileRoute } from '@tanstack/react-router'

import { requireAnyPermission } from '@/data/auth/routeGuards'
import NuevoPlanModalContainer from '@/features/planes/nuevo/NuevoPlanModalContainer'

export const Route = createFileRoute('/planes/_lista/nuevo')({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, ['planes.crear']),
  component: NuevoPlanModalContainer,
})
