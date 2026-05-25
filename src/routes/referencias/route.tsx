import { createFileRoute } from '@tanstack/react-router'

import { ReferencesLayout } from '@/components/referencias/ReferencesLayout'


export const Route = createFileRoute('/referencias')({
  component: ReferencesLayout,
})

