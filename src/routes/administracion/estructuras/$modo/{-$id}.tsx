import { createFileRoute, redirect } from '@tanstack/react-router'

import { requireAnyPermission } from '@/data/auth/routeGuards'
import { EstructurasPage } from '@/features/estructuras/EstructurasPage'

export type EstructurasSearch = {
  tipo: 'CURRICULAR' | 'NO_CURRICULAR'
  q?: string
  orden?: 'nombre_asc' | 'nombre_desc' | 'actualizado_desc'
}

const parseEstructurasSearch = (
  search: Record<string, unknown>,
): EstructurasSearch => ({
  tipo: search.tipo === 'NO_CURRICULAR' ? 'NO_CURRICULAR' : 'CURRICULAR',
  q: typeof search.q === 'string' ? search.q : '',
  orden:
    search.orden === 'nombre_desc' || search.orden === 'actualizado_desc'
      ? search.orden
      : 'nombre_asc',
})

export const Route = createFileRoute('/administracion/estructuras/$modo/{-$id}')({
  validateSearch: parseEstructurasSearch,
  beforeLoad: async ({ context, params }) => {
    await requireAnyPermission(context.queryClient, ['catalogos.gestionar'])

    if (params.modo !== 'planes' && params.modo !== 'materias') {
      throw redirect({
        to: '/administracion/estructuras/$modo/{-$id}',
        params: { modo: 'planes', id: undefined },
        search: { tipo: 'CURRICULAR', q: '', orden: 'nombre_asc' },
      })
    }
  },
  component: EstructurasPage,
})
