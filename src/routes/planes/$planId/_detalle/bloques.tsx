import { createFileRoute } from '@tanstack/react-router'

import { BloquesConocimientoPage } from '@/features/planes/bloques/BloquesConocimientoPage'

export const Route = createFileRoute('/planes/$planId/_detalle/bloques')({
  component: BloquesRoute,
})

function BloquesRoute() {
  const { planId } = Route.useParams()

  return <BloquesConocimientoPage planId={planId} />
}
