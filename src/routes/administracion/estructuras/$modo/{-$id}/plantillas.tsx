import { createFileRoute } from '@tanstack/react-router'

import { EstructuraDetailShell } from '@/features/estructuras/EstructuraDetailShell'
import { PlantillasSection } from '@/features/estructuras/PlantillasSection'

export const Route = createFileRoute(
  '/administracion/estructuras/$modo/{-$id}/plantillas',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <EstructuraDetailShell>
      {(estructura, modo) => (
        <PlantillasSection estructura={estructura} modo={modo} />
      )}
    </EstructuraDetailShell>
  )
}
