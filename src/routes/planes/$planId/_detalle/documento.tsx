import { createFileRoute, useParams } from '@tanstack/react-router'

import { usePlan } from '@/data'
import { DocumentoOficialView } from '@/features/documentos/DocumentoOficialView'
import { getPlanDisplayName } from '@/lib/plan-display'

export const Route = createFileRoute('/planes/$planId/_detalle/documento')({
  component: RouteComponent,
})

function RouteComponent() {
  const { planId } = useParams({ from: '/planes/$planId/_detalle/documento' })
  const { data: plan } = usePlan(planId)

  return (
    <DocumentoOficialView
      modo="plan"
      entityId={planId}
      entityName={plan ? getPlanDisplayName(plan) : 'plan_estudios'}
    />
  )
}
