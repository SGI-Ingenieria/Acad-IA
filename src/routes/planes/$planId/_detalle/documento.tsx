import { createFileRoute, useParams } from '@tanstack/react-router'

import { usePlan } from '@/data'
import { DocumentoOficialView } from '@/features/documentos/DocumentoOficialView'

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
      entityName={plan?.nombre ?? 'plan_estudios'}
    />
  )
}
