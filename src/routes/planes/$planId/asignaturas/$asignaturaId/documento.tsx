import { createFileRoute, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'

import { useSubject, useEstructurasAsignatura, useEstructurasAsignaturaCrud } from '@/data'
import { DocumentoOficialView } from '@/features/documentos/DocumentoOficialView'

export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId/documento',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId/documento',
  })

  const { data: asignatura } = useSubject(asignaturaId)
  const { data: estructuras = [] } = useEstructurasAsignatura()
  const asigCrud = useEstructurasAsignaturaCrud()

  const estructuraId = asignatura?.estructura_id ?? null
  const estructura = estructuras.find((e) => e.id === estructuraId)
  const templateId = estructura?.template_id ?? null

  const handleTemplateChange = async (newTemplateId: string) => {
    if (!estructuraId) return
    await asigCrud.update.mutateAsync({
      id: estructuraId,
      input: { template_id: newTemplateId },
    })
    toast.success('Plantilla actualizada')
  }

  return (
    <DocumentoOficialView
      modo="asignatura"
      entityId={asignaturaId}
      entityName={asignatura?.nombre ?? 'documento_sep'}
      estructuraId={estructuraId}
      templateId={templateId}
      onTemplateChange={handleTemplateChange}
    />
  )
}
