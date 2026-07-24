import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/administracion/estructuras/')({
  beforeLoad: () => {
    throw redirect({
      to: '/administracion/estructuras/$modo/{-$id}',
      params: { modo: 'planes', id: undefined },
      search: { tipo: 'CURRICULAR' },
    })
  },
})
