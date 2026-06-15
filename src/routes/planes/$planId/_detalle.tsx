import {
  createFileRoute,
  Outlet,
  Link,
  notFound,
  useLocation,
} from '@tanstack/react-router'
import {
  ChevronLeft,
  GraduationCap,
  Clock,
  Hash,
  CalendarDays,
  BookOpen,
  Calculator,
} from 'lucide-react'
import { useState, useEffect, forwardRef, Activity } from 'react'

import type { Database } from '@/types/supabase'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NotFoundPage } from '@/components/ui/NotFoundPage'
import { DetailShellSkeleton } from '@/components/ui/route-pending-skeleton'
// Nivel is derived from `carreras` and must not be editable here.
import { Skeleton } from '@/components/ui/skeleton'
import {
  usePlan,
  usePlanAsignaturas,
  useUpdatePlanFields,
} from '@/data/hooks/usePlans'
import {
  planAsignaturasOptions,
  planLineasOptions,
  planOptions,
} from '@/data/query/queryOptions'
import { calcularCreditos } from '@/lib/creditos-utils'
import { cn } from '@/lib/utils'
import { defaultPlanesSearch } from '@/types/search'

type NivelPlanEstudio = Database['public']['Enums']['nivel_plan_estudio']

const planTabs = [
  { to: '/planes/$planId/', label: 'Datos Generales' },
  { to: '/planes/$planId/mapa', label: 'Mapa Curricular' },
  { to: '/planes/$planId/asignaturas', label: 'Tabla de Asignaturas' },
  { to: '/planes/$planId/flujo', label: 'Flujo y Estados' },
  { to: '/planes/$planId/iaplan', label: 'IA del Plan de Estudios' },
  { to: '/planes/$planId/documento', label: 'Documento SEP' },
  { to: '/planes/$planId/historial', label: 'Historial de Cambios' },
] as const

export const Route = createFileRoute('/planes/$planId/_detalle')({
  loader: async ({ context: { queryClient }, params: { planId } }) => {
    try {
      await queryClient.ensureQueryData(planOptions(planId))
    } catch (e: unknown) {
      // PGRST116: The result contains 0 rows
      if (e && typeof e === 'object' && 'code' in e && e.code === 'PGRST116')
        throw notFound()
      throw e
    }
    await Promise.all([
      queryClient.prefetchQuery(planAsignaturasOptions(planId)),
      queryClient.prefetchQuery(planLineasOptions(planId)),
    ])
  },
  notFoundComponent: () => {
    return (
      <NotFoundPage
        title="Plan de Estudios no encontrado"
        message="El plan de estudios que intentas consultar no existe o no tienes permisos para verlo."
      />
    )
  },
  component: RouteComponent,
  pendingComponent: DetailShellSkeleton,
  preload: true,
})

function RouteComponent() {
  const { planId } = Route.useParams()
  const location = useLocation()
  const { data, isLoading } = usePlan(planId)
  const { mutate } = useUpdatePlanFields()
  const { data: asignaturasData } = usePlanAsignaturas(planId)
  const isPureChatRoute = location.pathname === `/planes/${planId}/iaplan/chat`

  // Estados locales para manejar la edición "en vivo" antes de persistir
  const [nombrePlan, setNombrePlan] = useState('')
  const [nivelPlan, setNivelPlan] = useState<NivelPlanEstudio | undefined>(
    undefined,
  )
  const [showCreditosDialog, setShowCreditosDialog] = useState(false)

  useEffect(() => {
    if (data) {
      setNombrePlan(data.nombre || '')
      setNivelPlan(data.carreras?.nivel ?? undefined)
    }
  }, [data])

  // Nivel values are kept for reference only; UI must not allow editing nivel here.

  const MAX_CHARACTERS = 200

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    // 1. Permitir teclas de control (Borrar, flechas, etc.) siempre
    const isControlKey =
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key.includes('Arrow') ||
      e.metaKey ||
      e.ctrlKey

    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
      return
    }

    // 2. Bloquear si excede los 200 caracteres y no es una tecla de control
    const currentText = e.currentTarget.textContent || ''
    if (currentText.length >= MAX_CHARACTERS && !isControlKey) {
      e.preventDefault()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLSpanElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    const currentText = e.currentTarget.textContent || ''

    // Calcular cuánto espacio queda
    const remainingSpace = MAX_CHARACTERS - currentText.length

    if (remainingSpace > 0) {
      const slicedText = text.slice(0, remainingSpace)
      document.execCommand('insertText', false, slicedText)
    }
  }

  if (isPureChatRoute) {
    return <Outlet />
  }

  return (
    <div className="bg-background min-h-screen">
      {/* 1. Header Superior */}
      <div className="bg-background/80 sticky top-0 z-20 border-b shadow-sm backdrop-blur-sm">
        <div className="mx-auto w-full max-w-7xl px-4 py-2 md:px-6 lg:px-8">
          <Link
            to="/planes"
            search={defaultPlanesSearch}
            className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-xs transition-colors"
          >
            <ChevronLeft size={14} /> Volver a planes
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        {/* 2. Header del Plan */}
        {isLoading ? (
          /* ===== SKELETON ===== */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <DatosGeneralesSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
            <div>
              <h1 className="text-foreground flex flex-wrap items-baseline gap-2 text-3xl leading-tight font-bold tracking-tight">
                {/* El prefijo "Nivel en" lo mantenemos simple */}
                <Activity
                  mode={
                    nivelPlan?.toLowerCase() !== 'otro' ? 'visible' : 'hidden'
                  }
                >
                  <span className="shrink-0">{nivelPlan} en</span>
                </Activity>
                <span
                  role="textbox"
                  tabIndex={0}
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  aria-label="Nombre del plan"
                  title="Nombre del plan"
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onBlur={(e) => {
                    const nuevoNombre = e.currentTarget.textContent.trim()
                    setNombrePlan(nuevoNombre)
                    if (nuevoNombre !== data?.nombre) {
                      mutate({ planId, patch: { nombre: nuevoNombre } })
                    }
                  }}
                  className="hover:border-input focus:border-primary block w-full cursor-text border-b border-transparent wrap-break-word whitespace-pre-wrap no-underline transition-colors outline-none select-text sm:inline-block sm:w-auto"
                >
                  {nombrePlan}
                </span>
              </h1>
              <p className="text-muted-foreground mt-1 text-lg font-medium">
                {data?.carreras?.facultades?.nombre}{' '}
                {data?.carreras?.nombre_corto}
              </p>
            </div>

            {(() => {
              const estadoColorHex = (data?.estados_plan as any)?.color as
                | string
                | undefined
              const badgeStyle = estadoColorHex
                ? ({
                    backgroundColor: estadoColorHex,
                    borderColor: estadoColorHex,
                  } as const)
                : undefined

              return (
                <Badge
                  style={badgeStyle}
                  className={cn(
                    'text-sm font-semibold',
                    !estadoColorHex &&
                      'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20',
                  )}
                >
                  <span className="text-white [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000,0_1px_0_#000,0_-1px_0_#000,1px_0_0_#000,-1px_0_0_#000]">
                    {data?.estados_plan?.etiqueta}
                  </span>
                </Badge>
              )
            })()}
          </div>
        )}

        {/* 3. Cards de Información */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="border-border/60 bg-muted/30 flex h-18 w-full items-center gap-4 rounded-xl border p-4 shadow-sm transition-all">
            <div className="bg-background flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm">
              <GraduationCap className="text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-0.5 truncate text-[10px] font-bold tracking-wider uppercase">
                Nivel
              </p>
              <p className="text-foreground truncate text-sm font-semibold">
                {data?.carreras?.nivel || '---'}
              </p>
            </div>
          </div>

          <InfoCard
            icon={<Clock className="text-muted-foreground" />}
            label="Duración"
            value={`${data?.numero_ciclos || 0} ${
              data?.tipo_ciclo === 'Otro'
                ? 'ciclos'
                : data?.tipo_ciclo
                  ? `${data.tipo_ciclo.toLocaleLowerCase()}s`
                  : ''
            }`}
          />
          <InfoCard
            icon={<Hash className="text-muted-foreground" />}
            label="Créditos"
            value={
              asignaturasData
                ? asignaturasData.reduce((sum, a) => sum + (a.creditos || 0), 0)
                : '---'
            }
            onClick={() => setShowCreditosDialog(true)}
            className="hover:border-primary/40 hover:bg-muted/50 cursor-pointer"
            title="Ver desglose de créditos"
          />
          <InfoCard
            icon={<CalendarDays className="text-muted-foreground" />}
            label="Creación"
            value={data?.creado_en.split('T')[0]}
          />
        </div>

        {/* 4. Navegación de Tabs */}
        <div className="scrollbar-hide touch-pan-x overflow-x-auto overscroll-x-contain border-b">
          <nav className="flex min-w-max gap-8">
            {planTabs.map((tab) => (
              <Tab key={tab.to} to={tab.to} params={{ planId }}>
                {tab.label}
              </Tab>
            ))}
          </nav>
        </div>

        <main className="animate-in fade-in pt-2 duration-500">
          <Outlet />
        </main>
      </div>

      {/* Dialog: Ficha técnica de créditos */}
      <Dialog open={showCreditosDialog} onOpenChange={setShowCreditosDialog}>
        <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          {/* Header fijo */}
          <div className="border-b px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-4 w-4" />
                Desglose de Créditos del Plan
              </DialogTitle>
            </DialogHeader>

            {/* Fórmula + total destacado */}
            <div className="mt-4 flex items-center justify-between gap-6 rounded-xl border bg-muted/30 px-5 py-4">
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                  Acuerdo 17/11/17 · Art. 11
                </p>
                <code className="text-foreground font-mono text-sm">
                  créditos = trunc((HD + HI) / 16, 2)
                </code>
                <p className="text-muted-foreground text-xs">
                  1 crédito = 16 h · truncado a centésimas{' '}
                  <strong className="text-foreground">sin redondear</strong>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-primary text-3xl font-bold tabular-nums leading-none">
                  {asignaturasData
                    ? asignaturasData
                        .reduce((sum, a) => sum + (a.creditos ?? 0), 0)
                        .toFixed(2)
                    : '—'}
                </p>
                <p className="text-muted-foreground mt-1 text-xs font-medium">
                  créditos totales
                </p>
              </div>
            </div>
          </div>

          {/* Lista scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {asignaturasData && asignaturasData.length > 0 ? (
              <div className="space-y-5">
                {Object.entries(
                  asignaturasData.reduce<
                    Partial<Record<string, typeof asignaturasData>>
                  >((acc, a) => {
                    const key =
                      a.numero_ciclo != null
                        ? String(a.numero_ciclo)
                        : '__sin_ciclo__'
                    const existing = acc[key]
                    if (existing) existing.push(a)
                    else acc[key] = [a]
                    return acc
                  }, {}),
                )
                  .filter(
                    (entry): entry is [string, typeof asignaturasData] =>
                      entry[1] != null,
                  )
                  .sort(([a], [b]) => {
                    if (a === '__sin_ciclo__') return 1
                    if (b === '__sin_ciclo__') return -1
                    return Number(a) - Number(b)
                  })
                  .map(([ciclo, asignaturas]) => {
                    const totalCicloCr = asignaturas.reduce(
                      (s, a) => s + (a.creditos ?? 0),
                      0,
                    )
                    return (
                      <div key={ciclo}>
                        {/* Cabecera del ciclo */}
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                            {ciclo === '__sin_ciclo__'
                              ? 'Sin ciclo asignado'
                              : `Ciclo ${ciclo}`}
                          </p>
                          <p className="text-muted-foreground text-xs tabular-nums">
                            {totalCicloCr.toFixed(2)} cr
                          </p>
                        </div>

                        {/* Tarjetas de asignaturas */}
                        <div className="space-y-1.5">
                          {asignaturas.map((a) => {
                            const hd = a.horas_academicas ?? 0
                            const hi = a.horas_independientes ?? 0
                            const cr = calcularCreditos(
                              a.horas_academicas,
                              a.horas_independientes,
                            )
                            return (
                              <div
                                key={a.id}
                                className="hover:bg-muted/40 flex items-center gap-4 rounded-lg border bg-card px-4 py-3 transition-colors"
                              >
                                {/* Nombre */}
                                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                                  {a.nombre}
                                </p>

                                {/* Horas */}
                                <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
                                  <span className="bg-muted rounded px-1.5 py-0.5">
                                    HD&nbsp;{hd}
                                  </span>
                                  <span className="opacity-40">+</span>
                                  <span className="bg-muted rounded px-1.5 py-0.5">
                                    HI&nbsp;{hi}
                                  </span>
                                  <span className="text-muted-foreground/60 ml-1">
                                    = {hd + hi} h
                                  </span>
                                </div>

                                {/* Créditos */}
                                <div className="shrink-0 w-14 text-right">
                                  <span className="text-primary text-sm font-bold tabular-nums">
                                    {cr.toFixed(2)}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    {' '}
                                    cr
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center gap-3 py-14 text-center text-sm">
                <BookOpen className="h-8 w-8 opacity-30" />
                <span>Sin asignaturas registradas.</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const InfoCard = forwardRef<
  HTMLDivElement,
  {
    icon: React.ReactNode
    label: string
    value: string | number | undefined
  } & React.HTMLAttributes<HTMLDivElement>
>(function InfoCard({ icon, label, value, className, ...props }, ref) {
  return (
    <div
      ref={ref}
      {...props}
      className={`border-border/60 bg-muted/30 flex h-18 w-full items-center gap-4 rounded-xl border p-4 shadow-sm transition-all ${className ?? ''}`}
    >
      <div className="bg-background flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground mb-0.5 truncate text-[10px] font-bold tracking-wider uppercase">
          {label}
        </p>
        <p className="text-foreground truncate text-sm font-semibold">
          {value || '---'}
        </p>
      </div>
    </div>
  )
})

function Tab({
  to,
  params,
  children,
}: {
  to: string
  params?: any
  search?: any
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      params={params}
      className="text-muted-foreground hover:text-foreground hover:border-primary/40 focus-visible:ring-primary/30 border-b-2 border-transparent pb-3 text-sm font-medium transition-[color,transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-px focus-visible:ring-2 focus-visible:outline-none"
      activeProps={{ className: 'border-primary text-primary font-semibold' }}
      activeOptions={{
        exact: true,
      }}
    >
      {children}
    </Link>
  )
}

function DatosGeneralesSkeleton() {
  return (
    <div className="bg-card rounded-xl border">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-16" />
      </div>

      {/* Content */}
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-10/12" />
        <Skeleton className="h-4 w-9/12" />
      </div>
    </div>
  )
}
