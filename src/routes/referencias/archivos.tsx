import { createFileRoute, redirect } from '@tanstack/react-router'

import { defaultReferenciasSearch } from '@/types/search'

export const Route = createFileRoute('/referencias/archivos')({
  beforeLoad: () => {
    throw redirect({ to: '/referencias', search: defaultReferenciasSearch })
  },
})
