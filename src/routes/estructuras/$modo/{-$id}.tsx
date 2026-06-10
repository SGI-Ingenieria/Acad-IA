import { createFileRoute, redirect } from '@tanstack/react-router'

import { MasterDetailSkeleton } from '@/components/ui/route-pending-skeleton'
import { EstructurasPage } from '@/features/estructuras/EstructurasPage'

export const Route = createFileRoute('/estructuras/$modo/{-$id}')({
  beforeLoad: ({ params }) => {
    if (params.modo !== 'planes' && params.modo !== 'materias') {
      throw redirect({
        to: '/estructuras/$modo/{-$id}',
        params: { modo: 'planes', id: undefined },
      })
    }
  },
  pendingComponent: MasterDetailSkeleton,
  component: EstructurasPage,
})
