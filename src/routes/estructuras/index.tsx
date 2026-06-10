import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/estructuras/')({
  beforeLoad: () => {
    throw redirect({
      to: '/estructuras/$modo/{-$id}',
      params: { modo: 'planes', id: undefined },
    })
  },
})
