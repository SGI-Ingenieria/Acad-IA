import { createFileRoute } from '@tanstack/react-router'

import { RoutePendingDialog } from '@/components/ui/route-pending-skeleton'
import { requirePlanPermission } from '@/data/auth/routeGuards'
import { NuevaAsignaturaModalContainer } from '@/features/asignaturas/nueva/NuevaAsignaturaModalContainer'

export const Route = createFileRoute(
  '/planes/$planId/_detalle/asignaturas/nueva',
)({
  beforeLoad: ({ context, params }) =>
    requirePlanPermission(context.queryClient, params.planId, [
      'asignaturas.editar',
    ]),
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
