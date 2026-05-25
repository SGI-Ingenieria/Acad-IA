import { createFileRoute } from '@tanstack/react-router'

import EntidadCrudModal from '@/features/facultades/EntidadCrudModal'

export const Route = createFileRoute('/facultades/$tipo/$entityId/editar')({
  component: RouteComponent,
})

function RouteComponent() {
  const { tipo, entityId } = Route.useParams()

  return (
    <EntidadCrudModal
      entityType={tipo as 'facultad' | 'carrera'}
      mode="editar"
      entityId={entityId}
    />
  )
}
