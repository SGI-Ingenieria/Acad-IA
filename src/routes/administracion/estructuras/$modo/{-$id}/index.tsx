import { createFileRoute } from '@tanstack/react-router'

import { EstructuraDetailShell } from '@/features/estructuras/EstructuraDetailShell'

export const Route = createFileRoute(
  '/administracion/estructuras/$modo/{-$id}/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <EstructuraDetailShell />
}
