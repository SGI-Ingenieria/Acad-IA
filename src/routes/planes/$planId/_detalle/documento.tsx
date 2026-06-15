import { createFileRoute, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'

import { TabPanelSkeleton } from '@/components/ui/route-pending-skeleton'
import { usePlan, useEstructurasPlanCrud } from '@/data'
import { DocumentoOficialView } from '@/features/documentos/DocumentoOficialView'

export const Route = createFileRoute('/planes/$planId/_detalle/documento')({
  component: RouteComponent,
  pendingComponent: TabPanelSkeleton,
})

function RouteComponent() {
  const { planId } = useParams({ from: '/planes/$planId/_detalle/documento' })
  const { data: plan } = usePlan(planId)
  const planCrud = useEstructurasPlanCrud()

  const estructuraId = plan?.estructuras_plan?.id ?? null
  const templateId = plan?.estructuras_plan?.template_id ?? null

  const handleTemplateChange = async (newTemplateId: string) => {
    if (!estructuraId) return
    await planCrud.update.mutateAsync({
      id: estructuraId,
      input: { template_id: newTemplateId },
    })
    toast.success('Plantilla actualizada')
  }

  return (
    <DocumentoOficialView
      modo="plan"
      entityId={planId}
      entityName={plan?.nombre ?? 'plan_estudios'}
      estructuraId={estructuraId}
      templateId={templateId}
      onTemplateChange={handleTemplateChange}
    />
  )
}
