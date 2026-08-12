import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/administracion/estructuras/')({
  beforeLoad: () => {
    throw redirect({
      to: '/administracion/estructuras/$modo/{-$id}',
      params: { modo: 'paquetes', id: undefined },
      search: {
        q: '',
        orden: 'nombre_asc',
        estado: 'vigentes',
      },
    })
  },
})
