import { createFileRoute, Outlet, Link, notFound } from '@tanstack/react-router'
import {
  ChevronLeft,
  GraduationCap,
  Clock,
  Hash,
  CalendarDays,
} from 'lucide-react'
import { useState, useEffect, forwardRef, Activity } from 'react'

import type { Database } from '@/types/supabase'

import { Badge } from '@/components/ui/badge'
import { NotFoundPage } from '@/components/ui/NotFoundPage'
// Nivel is derived from `carreras` and must not be editable here.
import { Skeleton } from '@/components/ui/skeleton'
import { plans_get } from '@/data/api/plans.api'
import {
  usePlan,
  usePlanAsignaturas,
  useUpdatePlanFields,
} from '@/data/hooks/usePlans'
import { qk } from '@/data/query/keys'
import { cn } from '@/lib/utils'
import { defaultPlanesSearch } from '@/types/search'

type NivelPlanEstudio = Database['public']['Enums']['nivel_plan_estudio']

const planTabs = [
  { to: '/planes/$planId/', label: 'Datos Generales' },
  { to: '/planes/$planId/mapa', label: 'Mapa Curricular' },
  { to: '/planes/$planId/asignaturas', label: 'Asignaturas' },
  { to: '/planes/$planId/flujo', label: 'Flujo y Estados' },
  { to: '/planes/$planId/iaplan', label: 'IA del Plan de Estudios' },
  { to: '/planes/$planId/documento', label: 'Documento SEP' },
  { to: '/planes/$planId/historial', label: 'Historial de Cambios' },
] as const

export const Route = createFileRoute('/planes/$planId/_detalle')({
  loader: async ({ context: { queryClient }, params: { planId } }) => {
    try {
      await queryClient.ensureQueryData({
        queryKey: qk.plan(planId),
        queryFn: () => plans_get(planId),
      })
    } catch (e: any) {
      // PGRST116: The result contains 0 rows
      if (e?.code === 'PGRST116') {
        throw notFound()
      }
      throw e
    }
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
  preload: true,
})

function RouteComponent() {
  const { planId } = Route.useParams()
  const { data, isLoading } = usePlan(planId)
  const { mutate } = useUpdatePlanFields()
  const { data: asignaturasData } = usePlanAsignaturas(planId)

  // Estados locales para manejar la edición "en vivo" antes de persistir
  const [nombrePlan, setNombrePlan] = useState('')
  const [nivelPlan, setNivelPlan] = useState<NivelPlanEstudio | undefined>(
    undefined,
  )

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
  return (
    <div className="bg-background min-h-screen">
      {/* 1. Header Superior */}
      <div className="bg-background/80 sticky top-0 z-20 border-b shadow-sm backdrop-blur-sm">
        <div className="px-6 py-2">
          <Link
            to="/planes"
            search={defaultPlanesSearch}
            className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-xs transition-colors"
          >
            <ChevronLeft size={14} /> Volver a planes
          </Link>
        </div>
      </div>

      <div className="mx-auto space-y-8 p-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8">
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
    </div>
  )
}

const InfoCard = forwardRef<
  HTMLDivElement,
  {
    icon: React.ReactNode
    label: string
    value: string | number | undefined
    isEditable?: boolean
  } & React.HTMLAttributes<HTMLDivElement>
>(function InfoCard(
  { icon, label, value, isEditable, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      {...props}
      className={`border-border/60 bg-muted/30 flex h-18 w-full items-center gap-4 rounded-xl border p-4 shadow-sm transition-all ${
        isEditable
          ? 'hover:border-primary/50 hover:bg-accent focus-visible:ring-primary/40 cursor-pointer focus:outline-none focus-visible:ring-2'
          : ''
      } ${className ?? ''}`}
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
