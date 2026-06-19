import { createFileRoute } from '@tanstack/react-router'

import { requireAnyPermission } from '@/data/auth/routeGuards'
import { NuevaAsignaturaModalContainer } from '@/features/asignaturas/nueva/NuevaAsignaturaModalContainer'

export const Route = createFileRoute(
  '/planes/$planId/_detalle/asignaturas/nueva',
)({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, ['asignaturas.editar']),
  component: NuevaAsignaturaModal,
})

function NuevaAsignaturaModal() {
  const { planId } = Route.useParams()
  return <NuevaAsignaturaModalContainer planId={planId} />
}
