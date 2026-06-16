import { createFileRoute } from '@tanstack/react-router'

import { RecentActivityGrid } from '@/components/referencias/RecentActivityGrid'
import { listInteraccionesRecientes } from '@/data/api/interaccionesIa.api'

export const Route = createFileRoute('/referencias/recientes')({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({
      queryKey: ['interacciones-recientes', 12],
      queryFn: () => listInteraccionesRecientes(12),
      staleTime: 30_000,
    })
  },
  preload: true,
  component: RecentActivityGrid,
})
