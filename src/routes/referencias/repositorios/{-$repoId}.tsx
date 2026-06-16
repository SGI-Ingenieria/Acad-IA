import { createFileRoute } from '@tanstack/react-router'

import { RepositoryGrid } from '@/components/referencias/RepositoryGrid'
import { listRepositorios } from '@/data/api/openaiFiles.api'

export const Route = createFileRoute('/referencias/repositorios/{-$repoId}')({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({
      queryKey: ['repositorios'],
      queryFn: listRepositorios,
      staleTime: 30_000,
    })
  },
  preload: true,
  component: RepositoryGrid,
})
