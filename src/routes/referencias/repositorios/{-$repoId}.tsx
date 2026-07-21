import { createFileRoute, redirect } from '@tanstack/react-router'

import { defaultReferenciasSearch } from '@/types/search'

export const Route = createFileRoute('/referencias/repositorios/{-$repoId}')({
  beforeLoad: () => {
    throw redirect({ to: '/referencias', search: defaultReferenciasSearch })
  },
})
