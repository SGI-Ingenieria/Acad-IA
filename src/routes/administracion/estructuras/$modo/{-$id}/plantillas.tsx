import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/administracion/estructuras/$modo/{-$id}/plantillas',
)({
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: '/administracion/estructuras/$modo/{-$id}',
      params: { modo: 'paquetes', id: params.id },
      search,
    })
  },
})
