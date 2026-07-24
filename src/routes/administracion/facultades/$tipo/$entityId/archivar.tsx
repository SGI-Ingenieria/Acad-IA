import { createFileRoute } from '@tanstack/react-router'

import { requireAnyPermission } from '@/data/auth/routeGuards'
import EntidadCrudModal from '@/features/facultades/EntidadCrudModal'

export const Route = createFileRoute('/administracion/facultades/$tipo/$entityId/archivar')({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, ['catalogos.gestionar']),
  component: RouteComponent,
})

function RouteComponent() {
  const { tipo, entityId } = Route.useParams()

  return (
    <EntidadCrudModal
      entityType={tipo as 'facultad' | 'carrera'}
      mode="archivar"
      entityId={entityId}
    />
  )
}
