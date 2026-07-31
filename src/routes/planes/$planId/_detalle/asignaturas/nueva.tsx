import { createFileRoute } from '@tanstack/react-router'

import { RoutePendingDialog } from '@/components/ui/route-pending-skeleton'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { NuevaAsignaturaModalContainer } from '@/features/asignaturas/nueva/NuevaAsignaturaModalContainer'

export const Route = createFileRoute(
  '/planes/$planId/_detalle/asignaturas/nueva',
)({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, ['asignaturas.editar']),
  pendingComponent: NuevaAsignaturaPending,
  component: NuevaAsignaturaModal,
})

function NuevaAsignaturaPending() {
  return <RoutePendingDialog title="Nueva asignatura" />
}

function NuevaAsignaturaModal() {
  const { planId } = Route.useParams()
  return <NuevaAsignaturaModalContainer planId={planId} />
}
