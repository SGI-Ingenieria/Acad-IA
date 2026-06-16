import { createFileRoute, useParams } from '@tanstack/react-router'

import { useSubject } from '@/data'
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

  return (
    <DocumentoOficialView
      modo="asignatura"
      entityId={asignaturaId}
      entityName={asignatura?.nombre ?? 'documento_sep'}
    />
  )
}
