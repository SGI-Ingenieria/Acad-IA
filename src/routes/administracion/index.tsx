import { createFileRoute, redirect } from '@tanstack/react-router'

import { resolveRouteAuthz } from '@/data/auth/routeGuards'
import {
  adminSections,
  canSeeAdminSection,
} from '@/features/administracion/sections'

export const Route = createFileRoute('/administracion/')({
  // /administracion no tiene contenido propio: redirige a la primera sección
  // visible según los permisos del usuario.
  beforeLoad: async ({ context }) => {
    const { effectiveAuthz } = await resolveRouteAuthz(context.queryClient)

    const first = adminSections.find((section) =>
      canSeeAdminSection(effectiveAuthz, section),
    )

    throw redirect({ to: (first?.to ?? '/') as any, replace: true })
  },
})
