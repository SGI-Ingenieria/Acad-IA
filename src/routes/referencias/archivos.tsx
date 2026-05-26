import { createFileRoute } from '@tanstack/react-router'

import { FileTableDetailed } from '@/components/referencias/FileTableDetailed'
import { files_list } from '@/data/api/files.api'

export const Route = createFileRoute('/referencias/archivos')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ['files', 'list', {}],
      queryFn: () => files_list(),
      staleTime: 30_000,
    }),
  preload: true,
  component: FileTableDetailed,
})
