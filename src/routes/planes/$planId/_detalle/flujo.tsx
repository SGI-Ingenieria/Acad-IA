import { createFileRoute } from '@tanstack/react-router'

import { PlanFlowPanel } from '@/features/planes/PlanFlowPanel'

export const Route = createFileRoute('/planes/$planId/_detalle/flujo')({
  component: RouteComponent,
})

function RouteComponent() {
  const { planId } = Route.useParams()
  return <PlanFlowPanel planId={planId} />
}
