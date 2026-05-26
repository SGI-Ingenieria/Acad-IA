import { createFileRoute } from '@tanstack/react-router'

import { RecentActivityGrid } from '@/components/referencias/RecentActivityGrid'
import { files_list } from '@/data/api/files.api'

export const Route = createFileRoute('/referencias/recientes')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ['files', 'list', { limit: 6 }],
      queryFn: () => files_list({ limit: 6 }),
      staleTime: 30_000,
    }),
  preload: true,
  component: RecentActivityGrid,
})
