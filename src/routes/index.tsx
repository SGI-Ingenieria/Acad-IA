import { createFileRoute } from '@tanstack/react-router'
import { BadgeCheck, BookOpenText, LayoutGrid } from 'lucide-react'
import { useMemo } from 'react'

import { catalogosOptions, planesListOptions } from '@/data'
import { useCatalogosPlanes, usePlanes } from '@/data/hooks/usePlans'

const RECIENTES_FILTERS = { limit: 6, offset: 0 } as const

export const Route = createFileRoute('/')({
  component: RouteComponent,
  // Solo precalentamos la caché; no bloqueamos la navegación. El shell de la
  // portada se pinta de inmediato y las zonas con datos muestran su skeleton.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(catalogosOptions())
    void context.queryClient.prefetchQuery(planesListOptions(RECIENTES_FILTERS))
  },
})

function RouteComponent() {
  const { data: catalogos, isLoading: catalogosLoading } = useCatalogosPlanes()
  const { data: planesResp, isLoading: planesLoading } =
    usePlanes(RECIENTES_FILTERS)

  // Excluimos los planes FALLIDO (p. ej. generaciones canceladas o con error),
  // igual que la lista de planes (`_lista`), para no mostrarlos en la portada.
  const planesActuales = (planesResp?.data ?? []).filter((plan) => {
    const clave = String(plan.estados_plan?.clave ?? '').toUpperCase()
    return clave !== 'FALLIDO'
  })
  const facultades = catalogos?.facultades ?? []

  const resumenEstados = useMemo(() => {
    const map = new Map<string, number>()

    planesActuales.forEach((plan) => {
      const label = plan.estados_plan?.etiqueta ?? 'Sin estado'
      map.set(label, (map.get(label) ?? 0) + 1)
    })

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  }, [planesActuales])

  const indicadores = [
    {
      label: 'Planes actuales',
      value: planesResp?.count ?? planesActuales.length,
      icon: BookOpenText,
      loading: planesLoading,
    },
    {
      label: 'Facultades activas',
      value: facultades.length,
      icon: LayoutGrid,
      loading: catalogosLoading,
    },
    {
      label: 'Estados visibles',
      value: resumenEstados.length,
      icon: BadgeCheck,
      loading: planesLoading,
    },
  ]

  const userName = 'Usuario institucional'
  const userRole = 'Vista general'
  const dicebearUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(userName)}`
  const initials = userName
    .split(' ')
    .map((name) => name[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return <main className="bg-background min-h-screen w-full"></main>
}
