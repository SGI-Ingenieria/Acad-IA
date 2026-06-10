import { createFileRoute } from '@tanstack/react-router'

import { IAAsignaturaTab } from '@/components/asignaturas/detalle/IAAsignaturaTab'

export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId/iaasignatura_/chat',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <IAAsignaturaTab chatOnly />
}
