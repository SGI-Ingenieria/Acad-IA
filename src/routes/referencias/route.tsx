import { createFileRoute } from '@tanstack/react-router'

import { ReferencesLayout } from '@/components/referencias/ReferencesLayout'
import { requireAnyPermission } from '@/data/auth/routeGuards'

export const Route = createFileRoute('/referencias')({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, [
      'archivos.ver',
      'archivos.gestionar',
    ]),
  component: ReferencesLayout,
})
