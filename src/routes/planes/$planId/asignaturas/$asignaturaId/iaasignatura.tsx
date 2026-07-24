import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId/iaasignatura',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { planId, asignaturaId } = Route.useParams()

  return (
    <Navigate
      to="/planes/$planId/asignaturas/$asignaturaId"
      params={{ planId, asignaturaId }}
      state={(previous) => ({
        ...previous,
        reopenContextualPanel: 'subject-ia',
      })}
      replace
    />
  )
}
