import { createFileRoute } from '@tanstack/react-router'

import { SistemaEvaluacion } from '@/components/asignaturas/detalle/SistemaEvaluacion'

export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId/evaluacion',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <SistemaEvaluacion />
}
