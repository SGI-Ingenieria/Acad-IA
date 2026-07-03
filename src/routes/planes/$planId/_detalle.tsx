import {
  createFileRoute,
  Outlet,
  Link,
  notFound,
  useRouterState,
  useNavigate,
} from '@tanstack/react-router'
import {
  ChevronLeft,
  GraduationCap,
  Clock,
  Hash,
  CalendarDays,
  BookOpen,
  Calculator,
  Lock,
} from 'lucide-react'
import { useState, useEffect, useMemo, useRef, forwardRef } from 'react'

import { EstadoBadge } from '@/components/planes/EstadoBadge'
import { ActiveViewersStack } from '@/components/shared/ActiveViewersStack'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/motion-tabs'
import { NotFoundPage } from '@/components/ui/NotFoundPage'
// Nivel is derived from `carreras` and must not be editable here.
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import {
  usePlan,
  usePlanAsignaturas,
  usePlanLineas,
  useUpdatePlanFields,
} from '@/data/hooks/usePlans'
import { useRealtimePresence } from '@/data/hooks/useRealtimePresence'
import {
  planAsignaturasOptions,
  planLineasOptions,
  planOptions,
} from '@/data/query/queryOptions'
import {
  getOrganicMotion,
  gsap,
  organicEase,
  organicDuration,
  useGSAP,
} from '@/lib/animations'
import { formatCiclo, nombreTipoCiclo, sinCicloLabel } from '@/lib/ciclo-utils'
import { calcularCreditos } from '@/lib/creditos-utils'
import { formatCarreraNombre, formatFacultadNombre } from '@/lib/facultad-utils'
import { getPlanDisplayName } from '@/lib/plan-display'
import { cn } from '@/lib/utils'
import { defaultPlanesSearch } from '@/types/search'

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
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, ['planes.ver']),
  // Solo precalentamos la caché sin bloquear: el shell del detalle (barra de
  // volver, cabecera, tarjetas y tabs) se pinta de inmediato y cada zona
  // muestra su placeholder mientras los datos llegan. El "no encontrado" se
  // resuelve en el componente a partir del error de la query.
  loader: ({ context: { queryClient }, params: { planId } }) => {
    void queryClient.prefetchQuery(planOptions(planId))
    void queryClient.prefetchQuery(planAsignaturasOptions(planId))
    void queryClient.prefetchQuery(planLineasOptions(planId))
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
  const { data, isLoading, isError, error } = usePlan(planId)
  const { mutate } = useUpdatePlanFields()
  const navigate = useNavigate()
  const capabilities = usePlanCapabilities(data)
  const canEditPlan = capabilities.canEditPlan
  const { data: asignaturasData } = usePlanAsignaturas(planId)
  const { data: lineasData } = usePlanLineas(planId)
  const isPureChatRoute = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) => match.routeId === '/planes/$planId/_detalle/iaplan_/chat',
      ),
  })
  const isIARoute = useRouterState({
    select: (state) =>
      state.matches.some((match) => String(match.routeId).includes('/iaplan')),
  })

  const { planViewers } = useRealtimePresence(planId)

  // Estados locales para manejar la edición "en vivo" antes de persistir
  const [nombrePlan, setNombrePlan] = useState('')
  const [showCreditosDialog, setShowCreditosDialog] = useState(false)
  const [desgloseVista, setDesgloseVista] = useState<'ciclo' | 'linea'>('ciclo')

  // Scopes para las animaciones de GSAP (entrada del detalle y del desglose).
  const pageRef = useRef<HTMLDivElement | null>(null)
  const desgloseRef = useRef<HTMLDivElement | null>(null)

  const tipoCiclo = data?.tipo_ciclo

  // Agrupa las asignaturas para el desglose de créditos, ya sea por ciclo
  // o por línea curricular según la vista seleccionada.
  const gruposDesglose = useMemo(() => {
    if (!asignaturasData) return []

    if (desgloseVista === 'linea') {
      const lineasOrden = new Map((lineasData ?? []).map((l) => [l.id, l]))
      const grupos = new Map<
        string,
        { titulo: string; orden: number; asignaturas: typeof asignaturasData }
      >()

      for (const a of asignaturasData) {
        const key = a.linea_plan_id ?? '__sin_linea__'
        const existing = grupos.get(key)
        if (existing) {
          existing.asignaturas.push(a)
        } else {
          const linea = a.linea_plan_id
            ? lineasOrden.get(a.linea_plan_id)
            : undefined
          grupos.set(key, {
            titulo: linea?.nombre ?? 'Sin línea curricular',
            orden: linea?.orden ?? Number.POSITIVE_INFINITY,
            asignaturas: [a],
          })
        }
      }

      return Array.from(grupos.values()).sort((a, b) => a.orden - b.orden)
    }

    // Vista por ciclo
    const grupos = new Map<
      string,
      { titulo: string; orden: number; asignaturas: typeof asignaturasData }
    >()

    for (const a of asignaturasData) {
      const key =
        a.numero_ciclo != null ? String(a.numero_ciclo) : '__sin_ciclo__'
      const existing = grupos.get(key)
      if (existing) {
        existing.asignaturas.push(a)
      } else {
        grupos.set(key, {
          titulo:
            a.numero_ciclo != null
              ? formatCiclo(tipoCiclo, a.numero_ciclo)
              : sinCicloLabel(tipoCiclo),
          orden: a.numero_ciclo ?? Number.POSITIVE_INFINITY,
          asignaturas: [a],
        })
      }
    }

    return Array.from(grupos.values()).sort((a, b) => a.orden - b.orden)
  }, [asignaturasData, lineasData, desgloseVista, tipoCiclo])

  // Entrada escalonada del detalle: cabecera, tarjetas de info y tabs.
  // Se dispara cuando los datos terminan de cargar (el shell ya estaba pintado).
  useGSAP(
    () => {
      if (!getOrganicMotion() || isLoading) return

      const tl = gsap.timeline({
        defaults: { ease: organicEase, duration: organicDuration.base },
      })

      tl.fromTo(
        '[data-plan-header]',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0 },
      )
        .fromTo(
          '[data-plan-card]',
          { opacity: 0, y: 16, scale: 0.97 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            stagger: 0.07,
            ease: 'back.out(1.2)',
            overwrite: 'auto',
          },
          '-=0.2',
        )
        .fromTo(
          '[data-plan-tabs]',
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: organicDuration.quick },
          '-=0.15',
        )
    },
    { scope: pageRef, dependencies: [isLoading] },
  )

  // Entrada escalonada de los grupos del desglose de créditos al abrir el
  // diálogo o al cambiar la agrupación (por ciclo / por línea).
  useGSAP(
    () => {
      if (!getOrganicMotion() || !showCreditosDialog) return

      const grupos = desgloseRef.current?.querySelectorAll(
        '[data-credito-grupo]',
      )
      if (!grupos?.length) return

      gsap.fromTo(
        grupos,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: organicDuration.base,
          stagger: 0.06,
          ease: organicEase,
          overwrite: 'auto',
        },
      )
    },
    {
      scope: desgloseRef,
      dependencies: [showCreditosDialog, desgloseVista, gruposDesglose.length],
    },
  )

  useEffect(() => {
    if (data) {
      setNombrePlan(getPlanDisplayName(data))
    }
  }, [data])

  useEffect(() => {
    if (data && isIARoute && !capabilities.showIATabs) {
      void navigate({
        to: '/planes/$planId',
        params: { planId },
        replace: true,
      })
    }
  }, [data, isIARoute, capabilities.showIATabs, navigate, planId])

  const MAX_CHARACTERS = 200
  const currentPlanDisplayName = getPlanDisplayName(data)
  const canEditPlanName =
    canEditPlan && data?.estructuras_plan?.tipo !== 'CURRICULAR'

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

  // Si la query confirma que el plan no existe (0 filas), mostramos el 404
  // scopeado a este layout sin haber bloqueado la navegación.
  if (isError && (error as { code?: string } | null)?.code === 'PGRST116') {
    throw notFound()
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

      <div
        ref={pageRef}
        className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 md:px-6 lg:px-8 lg:py-8"
      >
        {/* 2. Header del Plan */}
        {isLoading ? (
          /* ===== SKELETON (solo la cabecera: título + estado) ===== */
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
            <div className="w-full space-y-2 md:max-w-xl">
              <Skeleton className="h-9 w-full max-w-md" />
              <Skeleton className="h-5 w-2/3" />
            </div>
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        ) : (
          <div
            data-plan-header
            className="flex flex-col items-start justify-between gap-4 md:flex-row"
          >
            <div>
              <h1 className="text-foreground flex flex-wrap items-baseline gap-2 text-3xl leading-tight font-bold tracking-tight">
                <span
                  role="textbox"
                  tabIndex={canEditPlanName ? 0 : undefined}
                  contentEditable={canEditPlanName}
                  suppressContentEditableWarning
                  spellCheck={false}
                  aria-label="Nombre del plan"
                  onKeyDown={canEditPlanName ? handleKeyDown : undefined}
                  onPaste={canEditPlanName ? handlePaste : undefined}
                  onBlur={async (e) => {
                    if (!canEditPlanName) return
                    const target = e.currentTarget
                    const nuevoNombre = target.textContent.trim()
                    setNombrePlan(nuevoNombre)
                    if (nuevoNombre !== currentPlanDisplayName) {
                      const adminOverrideReason =
                        capabilities.requiresAdminOverrideForEdit
                          ? await requestAdminOverrideReason(
                              'cambiar el nombre del plan fuera de su etapa normal',
                            )
                          : null
                      if (
                        capabilities.requiresAdminOverrideForEdit &&
                        !adminOverrideReason
                      ) {
                        target.textContent = currentPlanDisplayName
                        setNombrePlan(currentPlanDisplayName)
                        return
                      }
                      mutate({
                        planId,
                        patch: {
                          nombre: nuevoNombre,
                          nombre_propuesto: nuevoNombre,
                        },
                        adminOverrideReason,
                      })
                    }
                  }}
                  className={cn(
                    'block w-full border-b border-transparent wrap-break-word whitespace-pre-wrap no-underline transition-colors outline-none select-text sm:inline-block sm:w-auto',
                    canEditPlanName
                      ? 'hover:border-input focus:border-primary cursor-text'
                      : 'cursor-default',
                  )}
                >
                  {nombrePlan}
                </span>
              </h1>
              <p className="text-muted-foreground mt-1 flex items-center gap-2 text-lg font-medium">
                <FacultadIconPill facultad={data?.carreras?.facultades} />
                <span>
                  {data?.carreras?.facultades
                    ? formatFacultadNombre(data.carreras.facultades)
                    : null}{' '}
                  {data?.carreras?.nombre_corto ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted underline-offset-2">
                          {data.carreras.nombre_corto}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatCarreraNombre(data.carreras)}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </span>
              </p>
            </div>

            {(() => {
              const estadoColorHex = (data?.estados_plan as any)?.color as
                | string
                | undefined

              return (
                <div className="flex max-w-full flex-col items-end gap-2">
                  <EstadoBadge
                    etiqueta={data?.estados_plan?.etiqueta ?? 'Sin estado'}
                    colorHex={estadoColorHex}
                    claseColor="border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"
                  />
                  <ActiveViewersStack users={planViewers} />
                </div>
              )
            })()}
          </div>
        )}

        {capabilities.isFrozenForEditing && (
          <div className="border-border bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
            <Lock className="h-4 w-4 shrink-0" />
            <span>
              {capabilities.readOnlyReason ??
                'Este plan esta en modo solo lectura.'}
            </span>
          </div>
        )}

        {/* 3. Cards de Información */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div
            data-plan-card
            className="border-border/60 bg-muted/30 flex h-18 w-full items-center gap-4 rounded-xl border p-4 shadow-sm transition-all"
          >
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
            data-plan-card
            icon={<Clock className="text-muted-foreground" />}
            label="Duración"
            value={`${data?.numero_ciclos || 0} ${
              data?.tipo_ciclo === 'Otro'
                ? `ciclo${data.numero_ciclos !== 1 ? 's' : ''}`
                : data?.tipo_ciclo
                  ? `${data.tipo_ciclo.toLocaleLowerCase()}${data.numero_ciclos !== 1 ? 's' : ''}`
                  : ''
            }`}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoCard
                data-plan-card
                icon={<Hash className="text-muted-foreground" />}
                label="Créditos"
                value={
                  asignaturasData
                    ? asignaturasData
                        .reduce((sum, a) => sum + (a.creditos ?? 0), 0)
                        .toFixed(2)
                    : '---'
                }
                onClick={() => setShowCreditosDialog(true)}
                className="hover:border-primary/40 hover:bg-muted/50 cursor-pointer"
              />
            </TooltipTrigger>
            <TooltipContent>Ver desglose de créditos</TooltipContent>
          </Tooltip>
          <InfoCard
            data-plan-card
            icon={<CalendarDays className="text-muted-foreground" />}
            label="Creación"
            value={data?.creado_en.split('T')[0]}
          />
        </div>

        {/* 4. Navegación de Tabs */}
        <div className="scrollbar-hide touch-pan-x overflow-x-auto overscroll-x-contain border-b">
          <nav data-plan-tabs className="flex min-w-max gap-8">
            {planTabs
              .filter(
                (tab) =>
                  capabilities.showIATabs || !String(tab.to).includes('iaplan'),
              )
              .map((tab) => (
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
            <div className="bg-muted/30 mt-4 flex items-center justify-between gap-6 rounded-xl border px-5 py-4">
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                  Acuerdo 17/11/17 · Art. 11
                </p>
                <span className="text-foreground flex items-center gap-1 text-sm">
                  <span className="italic">créditos</span>
                  <span className="px-0.5">=</span>
                  <span className="font-mono text-2xl leading-none">⌊</span>
                  <span className="inline-flex flex-col items-center font-mono leading-none">
                    <span className="border-foreground/70 border-b px-1 pb-px text-xs">
                      <span className="italic">HD</span>
                      {' + '}
                      <span className="italic">HI</span>
                    </span>
                    <span className="px-1 pt-px text-xs">16</span>
                  </span>
                  <span className="font-mono text-2xl leading-none">⌋</span>
                </span>
                <p className="text-muted-foreground text-xs">
                  1 crédito = 16 h · truncado a centésimas{' '}
                  <strong className="text-foreground">sin redondear</strong>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-primary text-3xl leading-none font-bold tabular-nums">
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

            {/* Toggle de agrupación */}
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-muted-foreground text-xs font-medium">
                Agrupar por
              </p>
              <Tabs value={desgloseVista} onValueChange={setDesgloseVista}>
                <TabsList className="h-9">
                  <TabsTrigger value="ciclo">
                    {nombreTipoCiclo(tipoCiclo)}
                  </TabsTrigger>
                  <TabsTrigger value="linea">Línea curricular</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Lista scrollable */}
          <div ref={desgloseRef} className="flex-1 overflow-y-auto px-6 py-4">
            {asignaturasData && asignaturasData.length > 0 ? (
              <div className="space-y-5">
                {gruposDesglose.map((grupo) => {
                  const totalCicloCr = grupo.asignaturas.reduce(
                    (s, a) => s + (a.creditos ?? 0),
                    0,
                  )
                  return (
                    <div key={grupo.titulo} data-credito-grupo>
                      {/* Cabecera del grupo */}
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                          {grupo.titulo}
                        </p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {totalCicloCr.toFixed(2)} cr
                        </p>
                      </div>

                      {/* Tarjetas de asignaturas */}
                      <div className="space-y-1.5">
                        {grupo.asignaturas.map((a) => {
                          const hd = a.horas_academicas ?? 0
                          const hi = a.horas_independientes ?? 0
                          const cr = calcularCreditos(
                            a.horas_academicas,
                            a.horas_independientes,
                          )
                          return (
                            <div
                              key={a.id}
                              className="hover:bg-muted/40 bg-card flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors"
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
                              <div className="w-14 shrink-0 text-right">
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
>(({ icon, label, value, className, ...props }, ref) => {
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
