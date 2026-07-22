import { createFileRoute, useParams } from '@tanstack/react-router'

import { SubjectResponsablesPanel } from '@/features/asignaturas/SubjectResponsablesPanel'

export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId/responsables',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { planId, asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId/responsables',
  })
  return (
    <SubjectResponsablesPanel planId={planId} asignaturaId={asignaturaId} />
  )
}
