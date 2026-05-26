import { createFileRoute } from '@tanstack/react-router'

import { RepositoryGrid } from '@/components/referencias/RepositoryGrid'
import { listRepositorios } from '@/data/api/openaiFiles.api'

export const Route = createFileRoute('/referencias/repositorios')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ['repositorios'],
      queryFn: listRepositorios,
      staleTime: 30_000,
    }),
  preload: true,
  component: RepositoryGrid,
})
