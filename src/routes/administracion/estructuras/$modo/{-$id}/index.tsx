import { createFileRoute } from '@tanstack/react-router'

import { CamposSection } from '@/features/estructuras/CamposSection'
import { EstructuraDetailShell } from '@/features/estructuras/EstructuraDetailShell'

export const Route = createFileRoute(
  '/administracion/estructuras/$modo/{-$id}/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <EstructuraDetailShell>
      {(estructura, modo) => (
        <CamposSection estructura={estructura} modo={modo} />
      )}
    </EstructuraDetailShell>
  )
}
