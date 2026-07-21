import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenText,
  BookText,
  LayoutGrid,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useMemo } from 'react'

import PlanEstudiosCard from '@/components/planes/PlanEstudiosCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlanCardGridSkeleton } from '@/components/ui/route-pending-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { catalogosOptions, planesListOptions } from '@/data'
import { useCatalogosPlanes, usePlanes } from '@/data/hooks/usePlans'
import { DynamicIcon } from '@/features/planes/utils/icon-utils'
import { getPlanDisplayName } from '@/lib/plan-display'
import { defaultPlanesSearch } from '@/types/search'

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

  return (
    <main className="bg-background min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <section className="bg-card/80 relative overflow-hidden rounded-4xl border p-6 shadow-sm backdrop-blur md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.11),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.05),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.15),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.04),transparent_40%)]" />

          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:items-center">
            <div className="flex flex-col gap-5">
              <div className="space-y-3">
                <h1 className="text-foreground max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">
                  Acad-IA
                </h1>
                <p className="text-muted-foreground max-w-2xl text-base leading-7 md:text-lg">
                  {userName} puede revisar qué planes existen, cómo se
                  distribuyen por estado y entrar directo al catálogo cuando
                  necesite trabajar con un registro específico.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="shadow-md">
                  <Link to="/planes" search={defaultPlanesSearch}>
                    <BookText className="mr-2 h-4 w-4" />
                    Ir a planes
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="shadow-sm">
                  <Link to="/planes/nuevo" search={defaultPlanesSearch}>
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Crear plan
                  </Link>
                </Button>
              </div>
            </div>

            <div className="bg-background/80 rounded-4xl border p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border">
                  <AvatarImage src={dicebearUrl} alt={userName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-sm">{userRole}</p>
                  <h2 className="truncate text-xl font-bold tracking-tight">
                    {userName}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {catalogosLoading
                      ? 'Cargando…'
                      : (facultades[0]?.nombre ?? 'Institución')}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {indicadores.map((item) => {
                  const Icon = item.icon

                  return (
                    <div
                      key={item.label}
                      className="bg-muted/40 flex flex-col gap-2 rounded-2xl border p-3"
                    >
                      <div className="text-primary bg-background flex h-9 w-9 items-center justify-center rounded-xl shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        {item.loading ? (
                          <Skeleton className="mb-1 h-7 w-10" />
                        ) : (
                          <p className="text-foreground text-2xl font-bold tracking-tight">
                            {item.value}
                          </p>
                        )}
                        <p className="text-muted-foreground text-xs leading-tight">
                          {item.label}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
          <div className="bg-card rounded-4xl border p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm font-medium">
                  <Search className="h-4 w-4" />
                  Estado actual
                </div>
                <h3 className="text-foreground text-2xl font-bold tracking-tight">
                  Distribución real de planes
                </h3>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {planesLoading ? '…' : `${planesActuales.length} visibles`}
              </Badge>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {planesLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-muted/30 flex items-center justify-between rounded-2xl border px-4 py-3"
                  >
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-8 rounded-full" />
                  </div>
                ))
              ) : (
                <>
                  {resumenEstados.map((estado) => (
                    <div
                      key={estado.label}
                      className="bg-muted/30 flex items-center justify-between rounded-2xl border px-4 py-3"
                    >
                      <span className="text-sm font-medium">
                        {estado.label}
                      </span>
                      <Badge variant="secondary" className="rounded-full">
                        {estado.count}
                      </Badge>
                    </div>
                  ))}

                  {resumenEstados.length === 0 && (
                    <div className="text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-sm">
                      Todavía no hay planes cargados.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="text-muted-foreground mt-5 flex items-start gap-2 text-sm leading-6">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                No se muestran revisiones pendientes ni flujos intermedios: la
                portada solo refleja el estado actual de cada plan.
              </p>
            </div>
          </div>

          <div className="bg-card rounded-4xl border p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm font-medium">
                  <Activity className="h-4 w-4" />
                  Contenido activo
                </div>
                <h3 className="text-foreground text-2xl font-bold tracking-tight">
                  Planes recientes
                </h3>
              </div>
              <Button asChild variant="ghost" className="text-muted-foreground">
                <Link to="/planes" search={defaultPlanesSearch}>
                  Ver todo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {planesLoading && (
                <PlanCardGridSkeleton
                  count={4}
                  className="contents [&>div]:h-44"
                />
              )}

              {!planesLoading &&
                planesActuales.map((plan) => {
                  const facultad = plan.carreras?.facultades
                  const estado = plan.estados_plan
                  const ciclos = `${plan.numero_ciclos} ${String(plan.tipo_ciclo).toLowerCase() || 'ciclos'}`
                  const estadoColorHex = (estado as { color?: string } | null)
                    ?.color

                  return (
                    <Link
                      key={plan.id}
                      to="/planes/$planId"
                      params={{ planId: plan.id }}
                      className="block h-full"
                    >
                      <PlanEstudiosCard
                        Icono={(props) => (
                          <DynamicIcon
                            name={facultad?.icono ?? ''}
                            {...props}
                          />
                        )}
                        nombrePrograma={getPlanDisplayName(plan)}
                        ciclos={ciclos}
                        facultad={facultad?.nombre ?? 'Sin facultad'}
                        estado={estado?.etiqueta ?? 'Sin estado'}
                        claseColorEstado={!estadoColorHex ? 'bg-secondary' : ''}
                        colorEstadoHex={estadoColorHex}
                        colorFacultad={facultad?.color ?? '#2563eb'}
                      />
                    </Link>
                  )
                })}

              {!planesLoading && planesActuales.length === 0 && (
                <div className="text-muted-foreground rounded-2xl border border-dashed px-4 py-10 text-sm sm:col-span-2">
                  No hay planes recientes para mostrar. Cuando existan
                  registros, aparecerán aquí automáticamente.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
