import { createFileRoute, useParams } from '@tanstack/react-router'

import { SubjectRevisionPanel } from '@/features/asignaturas/SubjectRevisionPanel'

export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId/revision',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { planId, asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId/revision',
  })
  return <SubjectRevisionPanel planId={planId} asignaturaId={asignaturaId} />
}
