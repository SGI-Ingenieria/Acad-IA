import { createFileRoute, redirect } from '@tanstack/react-router'

import { EstructurasPage } from '@/features/estructuras/EstructurasPage'

export type EstructurasSearch = {
  tipo: 'CURRICULAR' | 'NO_CURRICULAR'
}

const parseEstructurasSearch = (
  search: Record<string, unknown>,
): EstructurasSearch => ({
  tipo: search.tipo === 'NO_CURRICULAR' ? 'NO_CURRICULAR' : 'CURRICULAR',
})

export const Route = createFileRoute('/estructuras/$modo/{-$id}')({
  validateSearch: parseEstructurasSearch,
  beforeLoad: ({ params }) => {
    if (params.modo !== 'planes' && params.modo !== 'materias') {
      throw redirect({
        to: '/estructuras/$modo/{-$id}',
        params: { modo: 'planes', id: undefined },
        search: { tipo: 'CURRICULAR' },
      })
    }
  },
  component: EstructurasPage,
})
