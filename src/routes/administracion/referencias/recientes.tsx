import { createFileRoute, redirect } from '@tanstack/react-router'

import { defaultReferenciasSearch } from '@/types/search'

export const Route = createFileRoute('/administracion/referencias/recientes')({
  beforeLoad: () => {
    throw redirect({ to: '/administracion/referencias', search: defaultReferenciasSearch })
  },
})
