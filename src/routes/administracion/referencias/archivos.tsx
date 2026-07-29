import { createFileRoute, redirect } from '@tanstack/react-router'

import { defaultReferenciasSearch } from '@/types/search'

export const Route = createFileRoute('/administracion/referencias/archivos')({
  beforeLoad: () => {
    throw redirect({
      to: '/administracion/referencias',
      search: defaultReferenciasSearch,
    })
  },
})
