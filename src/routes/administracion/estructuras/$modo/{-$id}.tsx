import { createFileRoute, redirect } from '@tanstack/react-router'

import { estructura_asignatura_parent_id } from '@/data/api/meta.api'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { EstructurasPage } from '@/features/estructuras/EstructurasPage'

export type EstructurasSearch = {
  q?: string
  orden?: 'nombre_asc' | 'nombre_desc' | 'actualizado_desc'
  estado?: 'vigentes' | 'archivados' | 'todos'
}

const parseEstructurasSearch = (
  search: Record<string, unknown>,
): EstructurasSearch => ({
  q: typeof search.q === 'string' ? search.q : '',
  orden:
    search.orden === 'nombre_desc' || search.orden === 'actualizado_desc'
      ? search.orden
      : 'nombre_asc',
  estado:
    search.estado === 'archivados' || search.estado === 'todos'
      ? search.estado
      : 'vigentes',
})

export const Route = createFileRoute(
  '/administracion/estructuras/$modo/{-$id}',
)({
  validateSearch: parseEstructurasSearch,
  beforeLoad: async ({ context, params }) => {
    await requireAnyPermission(context.queryClient, ['catalogos.gestionar'])

    if (params.modo === 'materias') {
      const packageId = params.id
        ? await estructura_asignatura_parent_id(params.id)
        : undefined
      throw redirect({
        to: '/administracion/estructuras/$modo/{-$id}',
        params: { modo: 'paquetes', id: packageId ?? undefined },
        search: {
          q: '',
          orden: 'nombre_asc',
          estado: 'vigentes',
        },
      })
    }
    if (params.modo !== 'paquetes') {
      throw redirect({
        to: '/administracion/estructuras/$modo/{-$id}',
        params: { modo: 'paquetes', id: params.id },
        search: {
          q: '',
          orden: 'nombre_asc',
          estado: 'vigentes',
        },
      })
    }
  },
  component: EstructurasPage,
})
