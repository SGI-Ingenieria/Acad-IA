import {
  createFileRoute,
  Outlet,
  Link,
  stripSearchParams,
  useRouterState,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import {
  ChevronLeft,
  BookOpen,
  Calculator,
  Lock,
  MessageSquare,
  BrainCircuit,
  GitBranch,
  History,
  FileCheck2,
  Wand2,
  ArrowRightLeft,
  Users,
} from 'lucide-react'
import { useCallback, useState, useEffect, useMemo, useRef } from 'react'

import type { PlanHistorySearch } from '@/features/planes/PlanHistoryPanel'
import type { PlanDetalleSearch } from '@/types/search'

import { ContextualActionsMenu } from '@/components/contexto/ContextualActionsMenu'
import { useContextualSheet } from '@/components/contexto/useContextualSheet'
import {
  BotonInvitarExperto,
  PlanExpertosCard,
} from '@/components/planes/PlanExpertosCard'
import { ActiveViewersStack } from '@/components/shared/ActiveViewersStack'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { RouteTabLink, RouteTabs } from '@/components/shared/RouteTabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/motion-tabs'
import { NotFoundPage } from '@/components/ui/NotFoundPage'
import { PanelLateralHeader } from '@/components/ui/panel-lateral'
// Nivel is derived from `carreras` and must not be editable here.
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { isResourceNotFoundError } from '@/data/api/_helpers'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { useSession } from '@/data/hooks/useAuth'
import { usePermissions } from '@/data/hooks/usePermissions'
import {
  usePlan,
  usePlanAsignaturas,
  usePlanLineas,
  usePlanRegistroOficial,
  useUpdatePlanFields,
} from '@/data/hooks/usePlans'
import { useRealtimePresence } from '@/data/hooks/useRealtimePresence'
import { useComentariosPlan } from '@/data/hooks/useWorkflow'
import {
  planAsignaturasOptions,
  planLineasOptions,
  planOptions,
} from '@/data/query/queryOptions'
import { useAgente } from '@/features/agente'
import { CommentsDrawer } from '@/features/comentarios/components/CommentsDrawer'
import { PlanCommentsManager } from '@/features/comentarios/components/PlanCommentsManager'
import {
  countUnread,
  useCommentsRead,
} from '@/features/comentarios/hooks/useCommentsRead'
import { usePlanComments } from '@/features/comentarios/PlanCommentsContext'
import { PlanFlowPanel } from '@/features/planes/PlanFlowPanel'
import { PlanHistoryPanel } from '@/features/planes/PlanHistoryPanel'
import { TransicionEstadoDialog } from '@/features/planes/TransicionEstadoDialog'
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
import { IaPlanChatView } from '@/routes/planes/$planId/_detalle/iaplan'
import {
  defaultPlanDetalleSearch,
  defaultPlanesSearch,
  HISTORIAL_PLAN_GRUPOS,
} from '@/types/search'

// El tercer lugar es una única vista curricular con dos modos. Su etiqueta y
// destino cambian entre «Bloques de conocimiento» y «Mapa Curricular» sin
// añadir otra pestaña a la arquitectura del plan.
const planTabsAntesCurriculo = [
  {
    value: 'general',
    to: '/planes/$planId',
    label: 'Datos Generales',
  },
  {
    value: 'asignaturas',
    to: '/planes/$planId/asignaturas',
    label: 'Tabla de Asignaturas',
  },
] as const

const planTabsDespuesCurriculo = [
  {
    value: 'documento',
    to: '/planes/$planId/documento',
    label: 'Documento SEP',
  },
] as const

type PlanContextualPanel =
  | 'comentarios'
  | 'ia'
  | 'flujo'
  | 'expertos'
  | 'historial'

function PlanNotFoundPage() {
  return (
    <NotFoundPage
      title="Plan de Estudios no encontrado"
      message="El plan de estudios que intentas consultar no existe o no tienes permisos para verlo."
    />
  )
}

// El desglose de créditos (dialog de este layout) agrupa por ciclo o por
// línea; la vista elegida vive en la URL y las rutas hijas la heredan (sus
// updaters de search hacen spread de `prev`, por lo que no la pierden).
const parsePlanDetalleSearch = (
  search: Record<string, unknown>,
): PlanDetalleSearch => ({
  desglose:
    search.desglose === 'linea' ? 'linea' : defaultPlanDetalleSearch.desglose,
  creditos: search.creditos === true || search.creditos === 'true',
})

export const Route = createFileRoute('/planes/$planId/_detalle')({
  validateSearch: parsePlanDetalleSearch,
  search: {
    middlewares: [stripSearchParams(defaultPlanDetalleSearch)],
  },
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
  notFoundComponent: PlanNotFoundPage,
  component: RouteComponent,
})

function RouteComponent() {
  const { planId } = Route.useParams()
  const { data, isLoading, isError, error } = usePlan(planId)
  const { mutate } = useUpdatePlanFields()
  const navigate = useNavigate()
  const router = useRouter()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const capabilities = usePlanCapabilities(data)
  const canEditPlan = capabilities.canEditPlan
  const { alternarDock } = useAgente()
  const { has } = usePermissions()
  const puedeGestionarExpertos = has('expertos.gestionar')
  const [transicionAbierta, setTransicionAbierta] = useState(false)
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
  const requestedContextualPanel = useRouterState({
    select: (state) => state.location.state.reopenContextualPanel,
  })
  const esRutaMapa = pathname.includes(`/planes/${planId}/mapa`)
  const esRutaBloques = pathname.includes(`/planes/${planId}/bloques`)
  const mostrarMapaEnSlot =
    esRutaMapa || (!esRutaBloques && data?.fase_diseno === 'MAPA')
  const tabCurricular = {
    value: 'curriculo',
    to: mostrarMapaEnSlot
      ? ('/planes/$planId/mapa' as const)
      : ('/planes/$planId/bloques' as const),
    label: mostrarMapaEnSlot ? 'Mapa Curricular' : 'Bloques de conocimiento',
    dataGuia: mostrarMapaEnSlot ? 'fase-mapa' : 'fase-bloques',
  }
  const planTabs = [
    ...planTabsAntesCurriculo,
    tabCurricular,
    ...planTabsDespuesCurriculo,
  ]
  const planTabActual = pathname.includes(`/planes/${planId}/asignaturas`)
    ? 'asignaturas'
    : esRutaMapa || esRutaBloques
      ? 'curriculo'
      : pathname.includes(`/planes/${planId}/documento`)
        ? 'documento'
        : 'general'

  const { planViewers } = useRealtimePresence(planId)

  // Un único Sheet conserva la identidad del panel durante la animación de salida.
  const {
    state: contextualSheetState,
    openPanel: openContextualPanel,
    setOpen: setContextualSheetOpen,
  } = useContextualSheet<PlanContextualPanel>('ia')
  const [historySearch, setHistorySearch] = useState<PlanHistorySearch>({
    page: 0,
    grupos: [...HISTORIAL_PLAN_GRUPOS],
    q: '',
    orden: 'reciente',
  })
  const {
    isOpen: commentsOpen,
    open: openComments,
    close: closeComments,
  } = usePlanComments()
  const { data: session } = useSession()
  const { data: comentarios } = useComentariosPlan(planId)
  const { lastSeen } = useCommentsRead(planId)
  const unreadComments = countUnread(
    comentarios ?? [],
    lastSeen,
    session?.user.id ?? null,
  )

  useEffect(() => {
    if (requestedContextualPanel === 'plan-ia') {
      closeComments()
      openContextualPanel('ia')
    }
  }, [closeComments, openContextualPanel, requestedContextualPanel])

  useEffect(() => {
    if (commentsOpen) openContextualPanel('comentarios')
  }, [commentsOpen, openContextualPanel])

  const openCommentsPanel = useCallback(() => {
    openComments()
    openContextualPanel('comentarios')
  }, [openComments, openContextualPanel])

  const openNonCommentPanel = useCallback(
    (panel: Exclude<PlanContextualPanel, 'comentarios'>) => {
      closeComments()
      openContextualPanel(panel)
    },
    [closeComments, openContextualPanel],
  )

  const closeContextualSheet = useCallback(() => {
    setContextualSheetOpen(false)
    closeComments()
  }, [closeComments, setContextualSheetOpen])

  const handleContextualSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      setContextualSheetOpen(nextOpen)
      if (!nextOpen) closeComments()
    },
    [closeComments, setContextualSheetOpen],
  )

  const esPlanCurricularAprobado =
    data?.estructuras_plan?.tipo === 'CURRICULAR' &&
    data.estados_plan?.clave === 'APROBADO'
  const { data: registroAprobado } = usePlanRegistroOficial(
    esPlanCurricularAprobado ? planId : undefined,
  )

  // Estados locales para manejar la edición "en vivo" antes de persistir
  const [nombrePlan, setNombrePlan] = useState('')
  // Vista y apertura del desglose de créditos: viven en la URL (`desglose`,
  // `creditos`) para que las rutas hijas puedan abrir el diálogo con un Link.
  const { desglose: desgloseVista = 'ciclo', creditos: showCreditosDialog } =
    Route.useSearch()
  const setShowCreditosDialog = useCallback(
    (open: boolean) =>
      void router.navigate({
        to: router.state.location.pathname,
        search: (prev) => ({ ...prev, creditos: open }),
        replace: true,
        resetScroll: false,
      }),
    [router],
  )

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

  // Renderizamos el estado esperado directamente. Lanzarlo desde render hacía
  // que React lo reportara como un crash antes de llegar al boundary de ruta.
  if (isError && isResourceNotFoundError(error)) {
    return <PlanNotFoundPage />
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

            <div className="flex max-w-full flex-col items-end gap-2">
              <ActiveViewersStack users={planViewers} />
              {esPlanCurricularAprobado && registroAprobado && (
                <Link
                  to="/planes/$planId/registro-oficial"
                  params={{ planId }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-50/40 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Aprobado por la SEP · Ver registro oficial
                </Link>
              )}
            </div>
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

        {/* 4. Navegación de Tabs */}
        <RouteTabs
          value={planTabActual}
          ariaLabel="Secciones del plan de estudios"
          className="py-3"
        >
          {planTabs.map((tab) => (
            <RouteTabLink
              key={tab.value}
              tabValue={tab.value}
              to={tab.to}
              params={{ planId }}
              data-guia={'dataGuia' in tab ? tab.dataGuia : `fase-${tab.value}`}
            >
              {tab.label}
            </RouteTabLink>
          ))}
        </RouteTabs>

        <main
          className="animate-in fade-in duration-500"
          data-comment-scope="plan-page"
          data-comment-key={planId}
        >
          <Outlet />
        </main>

        <PlanCommentsManager
          isReadOnly={Boolean(data?.estados_plan?.es_final)}
        />

        <ContextualActionsMenu
          hidden={contextualSheetState.open || commentsOpen}
          options={[
            {
              id: 'ia',
              label: 'IA del Plan',
              icon: BrainCircuit,
              hidden: !capabilities.canUseIA,
              grupo: 'Inteligencia artificial',
            },
            {
              id: 'agente',
              label: 'Modo agente',
              icon: Wand2,
              hidden: !capabilities.canUseIA,
              grupo: 'Inteligencia artificial',
            },
            {
              id: 'etapa',
              label: 'Cambiar etapa',
              icon: ArrowRightLeft,
              grupo: 'Flujo del plan',
            },
            {
              id: 'flujo',
              label: 'Flujo y Estados',
              icon: GitBranch,
              grupo: 'Flujo del plan',
            },
            {
              id: 'expertos',
              label: 'Expertos y sedes',
              icon: Users,
              grupo: 'Flujo del plan',
            },
            {
              id: 'comentarios',
              label: 'Comentarios',
              icon: MessageSquare,
              badge: unreadComments > 0 ? unreadComments : undefined,
              hidden: !capabilities.canComment,
              grupo: 'Revisión',
            },
            {
              id: 'historial',
              label: 'Historial de Cambios',
              icon: History,
              grupo: 'Revisión',
            },
          ]}
          onSelect={(id) => {
            // El modo agente no es un panel: cambia el comportamiento de toda
            // la página, así que no abre el Sheet.
            if (id === 'agente') {
              alternarDock()
            } else if (id === 'etapa') {
              // Mover el plan de etapa es una acción, no una lectura: se abre
              // su diálogo directamente en vez de pasar por el panel de flujo.
              setTransicionAbierta(true)
            } else if (id === 'comentarios') {
              openCommentsPanel()
            } else {
              openNonCommentPanel(
                id as Exclude<PlanContextualPanel, 'comentarios'>,
              )
            }
          }}
        />

        <Sheet
          modal={false}
          open={contextualSheetState.open}
          onOpenChange={handleContextualSheetOpenChange}
        >
          <SheetContent
            side="right"
            // Ningún panel usa el cierre flotante del Sheet: cada uno abre con
            // `PanelLateralHeader`, que integra el aspa en la misma fila del
            // título junto a las acciones del panel. El chat de IA hace lo
            // propio dentro de su cabecera.
            showCloseButton={false}
            className={cn(
              'w-full p-0',
              contextualSheetState.panel === 'comentarios'
                ? 'sm:max-w-md'
                : contextualSheetState.panel === 'ia'
                  ? 'sm:max-w-5xl'
                  : contextualSheetState.panel === 'flujo'
                    ? 'sm:max-w-md'
                    : 'sm:max-w-3xl',
            )}
          >
            {/* El chat trae su propio encabezado visible, pero Radix sigue
                exigiendo un título accesible para el diálogo. */}
            {contextualSheetState.panel === 'ia' && (
              <SheetHeader className="sr-only">
                <SheetTitle>IA del Plan de Estudios</SheetTitle>
                <SheetDescription>
                  Chat de inteligencia artificial del plan de estudios.
                </SheetDescription>
              </SheetHeader>
            )}

            {contextualSheetState.panel === 'comentarios' && (
              <>
                <PanelLateralHeader
                  icono={MessageSquare}
                  titulo="Comentarios"
                  descripcion="Comentarios del plan agrupados por fase, con búsqueda y filtros."
                  onCerrar={closeContextualSheet}
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <CommentsDrawer
                    planId={planId}
                    estadoActualId={data?.estado_actual_id ?? undefined}
                    isReadOnly={Boolean(data?.estados_plan?.es_final)}
                    onClose={closeContextualSheet}
                  />
                </div>
              </>
            )}

            {contextualSheetState.panel === 'ia' && (
              <div className="h-full">
                <IaPlanChatView
                  planId={planId}
                  compact
                  onCerrar={closeContextualSheet}
                />
              </div>
            )}

            {contextualSheetState.panel === 'flujo' && (
              <>
                <PanelLateralHeader
                  icono={GitBranch}
                  titulo="Flujo y etapas"
                  descripcion="Recorrido del plan por las etapas de aprobación."
                  onCerrar={closeContextualSheet}
                />
                <div className="min-h-0 flex-1">
                  <PlanFlowPanel planId={planId} />
                </div>
              </>
            )}

            {contextualSheetState.panel === 'expertos' && (
              <>
                <PanelLateralHeader
                  icono={Users}
                  titulo="Expertos y sedes"
                  descripcion="Expertos y sedes hermanas invitados a revisar este plan."
                  acciones={
                    puedeGestionarExpertos && (
                      <BotonInvitarExperto planId={planId} />
                    )
                  }
                  onCerrar={closeContextualSheet}
                />
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <PlanExpertosCard
                    planId={planId}
                    canManage={puedeGestionarExpertos}
                  />
                </div>
              </>
            )}

            {contextualSheetState.panel === 'historial' && (
              <>
                <PanelLateralHeader
                  icono={History}
                  titulo="Historial de cambios"
                  descripcion="Cambios del plan y de sus asignaturas, día por día."
                  onCerrar={closeContextualSheet}
                />
                <div className="min-h-0 flex-1 px-6 py-5">
                  <PlanHistoryPanel
                    fillHeight
                    conTitulo={false}
                    planId={planId}
                    page={historySearch.page}
                    grupos={historySearch.grupos}
                    q={historySearch.q}
                    orden={historySearch.orden}
                    onChange={(next) =>
                      setHistorySearch((prev) => ({ ...prev, ...next }))
                    }
                  />
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        <TransicionEstadoDialog
          planId={planId}
          open={transicionAbierta}
          onOpenChange={setTransicionAbierta}
        />
      </div>

      {/* Dialog: Ficha técnica de créditos */}
      <Dialog
        open={Boolean(showCreditosDialog)}
        onOpenChange={setShowCreditosDialog}
      >
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
            <div className="mt-4 flex items-center justify-end gap-4">
              <Tabs
                value={desgloseVista}
                onValueChange={(value) =>
                  router.navigate({
                    to: router.state.location.pathname,
                    search: (prev) => ({
                      ...prev,
                      desglose: value === 'linea' ? 'linea' : 'ciclo',
                    }),
                    resetScroll: false,
                  })
                }
              >
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
