import {
  createFileRoute,
  notFound,
  Outlet,
  Link,
  useLocation,
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
import {
  ArrowLeft,
  GraduationCap,
  Pencil,
  Hash,
  BookOpen,
  CalendarDays,
  Tag,
  MessageSquare,
  Users,
  Send,
  Brain,
  History,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { IAAsignaturaTab } from '@/components/asignaturas/detalle/IAAsignaturaTab'
import { AlertaConflicto } from '@/components/asignaturas/detalle/mapa/AlertaConflicto'
import { ContextualActionsMenu } from '@/components/contexto/ContextualActionsMenu'
import { ActiveViewersStack } from '@/components/shared/ActiveViewersStack'
import { Badge } from '@/components/ui/badge'
import { EditableNumber } from '@/components/ui/editable-number'
import { EditableText } from '@/components/ui/editable-text'
import { lateralConfetti } from '@/components/ui/lateral-confetti'
import { NotFoundPage } from '@/components/ui/NotFoundPage'
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
import {
  usePlan,
  useSubject,
  useUpdateAsignatura,
  usePlanAsignaturas,
} from '@/data'
import { useAcademicScope } from '@/data/auth/academicScope'
import {
  requestAdminOverrideReason,
  useAsignaturaCapabilities,
} from '@/data/auth/planCapabilities'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { useSession } from '@/data/hooks/useAuth'
import { usePermissions } from '@/data/hooks/usePermissions'
import { useRealtimePresence } from '@/data/hooks/useRealtimePresence'
import { useComentariosPlan } from '@/data/hooks/useWorkflow'
import {
  planAsignaturasOptions,
  subjectOptions,
} from '@/data/query/queryOptions'
import { SubjectHistoryPanel } from '@/features/asignaturas/SubjectHistoryPanel'
import { SubjectResponsablesPanel } from '@/features/asignaturas/SubjectResponsablesPanel'
import { SubjectRevisionPanel } from '@/features/asignaturas/SubjectRevisionPanel'
import { PlanCommentsManager } from '@/features/comentarios/components/PlanCommentsManager'
import {
  countUnread,
  useCommentsRead,
} from '@/features/comentarios/hooks/useCommentsRead'
import { usePlanComments } from '@/features/comentarios/PlanCommentsContext'
import { nombreTipoCiclo } from '@/lib/ciclo-utils'
import { getPlanDisplayName } from '@/lib/plan-display'
import { cn } from '@/lib/utils'
import {
  ASIGNATURA_HISTORIAL_GRUPOS,
  defaultAsignaturasSearch,
  defaultCatalogoAsignaturasSearch,
} from '@/types/search'

type SubjectContextualPanel =
  | 'ia'
  | 'responsables'
  | 'revision'
  | 'historial'
  | null

/**
 * Un usuario puede llegar a esta ruta viendo una asignatura a la que solo tiene
 * acceso por responsabilidad directa (profesor responsable / coautor / revisor),
 * sin alcance sobre el plan. `origen` indica que venimos del catálogo raíz
 * `/asignaturas`; `soloAsignatura` es una pista que envía el catálogo cuando el
 * acceso es únicamente por responsabilidad.
 */
type AsignaturaDetalleSearch = {
  origen?: 'catalogo'
  soloAsignatura?: boolean
}

export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId',
)({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, [
      'asignaturas.ver',
      'planes.ver',
    ]),
  validateSearch: (
    search: Record<string, unknown>,
  ): AsignaturaDetalleSearch => ({
    origen: search.origen === 'catalogo' ? 'catalogo' : undefined,
    soloAsignatura:
      search.soloAsignatura === true || search.soloAsignatura === 'true'
        ? true
        : undefined,
  }),
  // No bloqueante: el shell de la asignatura se pinta de inmediato y el "no
  // encontrado" se resuelve en el componente con el error de la query.
  loader: ({ context: { queryClient }, params: { asignaturaId, planId } }) => {
    void queryClient.prefetchQuery(subjectOptions(asignaturaId))
    void queryClient.prefetchQuery(planAsignaturasOptions(planId))
  },
  notFoundComponent: () => (
    <NotFoundPage
      title="Asignatura no encontrada"
      message="La asignatura que intentas consultar no existe o no tienes permisos para verla."
    />
  ),
  component: AsignaturaLayout,
})

// --- 1. COMPONENTE PARA EDITAR EL TÍTULO SOBRE FONDO AZUL ---
function InlineEditTitle({
  value,
  canEdit,
  onSave,
}: {
  value: string
  canEdit: boolean
  onSave: (val: string) => void
}) {
  return (
    <h1 className="text-foreground text-3xl font-bold">
      <span
        className={cn(
          'group inline-flex max-w-full items-center gap-3 rounded-md px-2 py-1 transition-colors',
          canEdit ? 'hover:bg-accent/40' : '',
        )}
      >
        <EditableText
          value={value}
          onSave={onSave}
          editable={canEdit}
          ariaLabel="Nombre de la asignatura"
          className="max-w-4xl"
        />
        {canEdit && (
          <Pencil className="text-muted-foreground h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </span>
    </h1>
  )
}

// --- 2. COMPONENTE PARA EDITAR LOS BADGES SOBRE FONDO AZUL ---
function InlineEditBadge({
  id,
  icon,
  label,
  value,
  suffix = '',
  type = 'text',
  min,
  max,
  canEdit,
  onSave,
}: {
  id?: string
  icon: React.ReactNode
  label: string
  value: string | number
  suffix?: string
  type?: 'text' | 'number'
  min?: number
  max?: number
  canEdit: boolean
  onSave: (val: string) => void
}) {
  const [isHighlighted, setIsHighlighted] = useState(false)

  useEffect(() => {
    if (!id) return
    const handleHighlight = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail.id === id) {
        setIsHighlighted(true)
        setTimeout(() => setIsHighlighted(false), 1500)
      }
    }
    window.addEventListener('trigger-highlight', handleHighlight)
    return () =>
      window.removeEventListener('trigger-highlight', handleHighlight)
  }, [id])

  const highlightClasses = isHighlighted
    ? 'ring-primary/40 border-primary/40 ring-2'
    : ''

  return (
    <div
      id={id}
      className={cn(
        'flex h-8 items-center gap-2 rounded-md border px-3 text-sm transition-all duration-300',
        highlightClasses,
        'border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5',
        canEdit ? 'hover:bg-gray-100 dark:hover:bg-white/10' : '',
      )}
    >
      <span className="text-foreground/70 dark:text-white/70">{icon}</span>
      <span className="text-foreground/60 text-xs font-medium tracking-wider uppercase dark:text-white/60">
        {label}:
      </span>
      {type === 'number' ? (
        <EditableNumber
          value={Number(value) || null}
          min={min}
          max={max}
          editable={canEdit}
          suffix={suffix}
          ariaLabel={label}
          className="mx-1"
          onSave={(n) => onSave(String(n ?? 0))}
        />
      ) : (
        <EditableText
          value={String(value)}
          onSave={onSave}
          editable={canEdit}
          ariaLabel={label}
          className="text-foreground font-semibold dark:text-white"
        />
      )}
    </div>
  )
}

function AsignaturaLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { asignaturaId, planId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { origen, soloAsignatura } = Route.useSearch()
  const { data: plan } = usePlan(planId)
  const capabilities = useAsignaturaCapabilities(plan, asignaturaId)
  const canEditAsignatura = capabilities.canEditAsignaturas
  const academicScope = useAcademicScope()

  // Panel contextual
  const permissions = usePermissions()
  const { isOpen: commentsOpen, open: openComments } = usePlanComments()
  const [activePanel, setActivePanel] = useState<SubjectContextualPanel>(null)
  const [historyGrupos, setHistoryGrupos] = useState([
    ...ASIGNATURA_HISTORIAL_GRUPOS,
  ])
  const { data: session } = useSession()
  const { data: comentarios } = useComentariosPlan(planId, asignaturaId)
  const { lastSeen } = useCommentsRead(planId, asignaturaId)
  const unreadComments = countUnread(
    comentarios ?? [],
    lastSeen,
    session?.user.id ?? null,
  )

  const canManageResponsables =
    capabilities.canEditAsignaturas &&
    (permissions.hasBootstrapAccess() ||
      permissions.has('asignaturas.responsables.gestionar'))

  const canReview =
    capabilities.canEditAsignaturas &&
    (permissions.has('asignaturas.editar') ||
      permissions.has('asignaturas.aprobar'))

  const {
    data: asignaturaApi,
    isLoading: asignaturaLoading,
    isError: asignaturaError,
    error: asignaturaErrorObj,
  } = useSubject(asignaturaId)

  const { subjectViewers } = useRealtimePresence(
    planId,
    asignaturaId,
    asignaturaApi
      ? { nombre: asignaturaApi.nombre, clave: asignaturaApi.codigo ?? '' }
      : undefined,
  )

  const { data: todasLasAsignaturas } = usePlanAsignaturas(planId)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    resolve: (value: boolean) => void
    mensaje: string
  } | null>(null)
  const validarConInterrupcion = async (
    nuevoCiclo: number,
  ): Promise<boolean> => {
    if (!todasLasAsignaturas || !asignaturaApi) return true

    const materiasConflicto = todasLasAsignaturas.filter((a) => {
      const esPrerrequisitoConflictivo =
        asignaturaApi.prerrequisito_asignatura_id === a.id &&
        (a.numero_ciclo ?? 0) >= nuevoCiclo

      const esDependienteConflictiva =
        a.prerrequisito_asignatura_id === asignaturaApi.id &&
        (a.numero_ciclo ?? 0) <= nuevoCiclo

      return esPrerrequisitoConflictivo || esDependienteConflictiva
    })

    if (materiasConflicto.length === 0) return true

    const listaNombres = materiasConflicto.map((m) => m.nombre)

    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        resolve,
        mensaje: JSON.stringify({
          main: `Mover "${asignaturaApi.nombre}" al ciclo ${nuevoCiclo} genera conflictos con:`,
          materias: listaNombres,
        }),
      })
    })
  }

  const updateAsignatura = useUpdateAsignatura()

  // Reemplaza tu useState y useEffect de headerData con esto:
  const headerData = useMemo(
    () => ({
      codigo: asignaturaApi?.codigo ?? '',
      nombre: asignaturaApi?.nombre ?? '',
      creditos: asignaturaApi?.creditos ?? 0,
      ciclo: asignaturaApi?.numero_ciclo ?? 0,
    }),
    [asignaturaApi],
  )

  // ¿El usuario tiene acceso al plan por alcance (global / facultad / carrera), o
  // solo ve esta asignatura por responsabilidad directa? Si es lo segundo, no
  // mostramos navegación hacia el plan y el "volver" apunta al catálogo.
  const hasPlanScopeAccess = useMemo(() => {
    if (academicScope.isGlobal) return true
    const carrera = asignaturaApi?.planes_estudio?.carreras
    const carreraId = carrera?.id
    const facultadId = carrera?.facultad_id ?? carrera?.facultades?.id
    return Boolean(
      (carreraId && academicScope.carreraIds.includes(carreraId)) ||
      (facultadId && academicScope.facultadIds.includes(facultadId)),
    )
  }, [academicScope, asignaturaApi])

  const backToCatalogo =
    origen === 'catalogo' || soloAsignatura === true || !hasPlanScopeAccess

  const handleUpdateHeader = async (key: string, value: string | number) => {
    // 1. Validación de ciclo
    if (key === 'ciclo') {
      const nuevoCiclo = Number(value)
      const acepto = await validarConInterrupcion(nuevoCiclo)

      // Si no aceptó, no hacemos nada más
      if (!acepto) {
        setConfirmState(null)
        return
      }
      setConfirmState(null)
    }

    // 2. Ejecutar mutación
    const patch = key === 'ciclo' ? { numero_ciclo: value } : { [key]: value }

    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'editar una asignatura fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    updateAsignatura.mutate({ asignaturaId, patch, adminOverrideReason })
  }

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isPureChatRoute = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          match.routeId ===
          '/planes/$planId/asignaturas/$asignaturaId/iaasignatura_/chat',
      ),
  })
  const isIARoute = useRouterState({
    select: (state) =>
      state.matches.some((match) =>
        String(match.routeId).includes('iaasignatura'),
      ),
  })

  useEffect(() => {
    if ((location.state as any)?.showConfetti) {
      lateralConfetti()
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  useEffect(() => {
    if (plan && isIARoute && !capabilities.showIATabs) {
      void navigate({
        to: '/planes/$planId/asignaturas/$asignaturaId',
        params: { planId, asignaturaId },
        replace: true,
      })
    }
  }, [plan, isIARoute, capabilities.showIATabs, navigate, planId, asignaturaId])

  if (isPureChatRoute) {
    return <Outlet />
  }

  // Si la query confirma que la asignatura no existe, 404 scopeado al layout.
  if (
    asignaturaError &&
    (asignaturaErrorObj as { code?: string } | null)?.code === 'PGRST116'
  ) {
    throw notFound()
  }

  // Mientras llega la asignatura mostramos el shell con placeholders en la
  // cabecera, en vez de dejar la pantalla en blanco o un loader completo.
  if (asignaturaLoading) {
    return (
      <div className="bg-background min-h-screen">
        <section className="bg-card border-border border-b pt-6 pb-8">
          <div className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8">
            <Skeleton className="mb-4 h-4 w-28" />
            <div className="flex flex-col gap-4">
              <Skeleton className="h-9 w-72 max-w-full" />
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-28" />
              </div>
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </div>
        </section>
        <nav className="bg-card sticky top-0 z-20 border-b">
          <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 py-3 md:px-6 lg:px-8">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-24 shrink-0" />
            ))}
          </div>
        </nav>
      </div>
    )
  }

  if (!asignaturaApi) return null

  return (
    <div className="bg-background min-h-screen">
      {/* HEADER DE LA ASIGNATURA */}
      <section className="bg-card border-border border-b pt-6 pb-8">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8">
          {backToCatalogo ? (
            <Link
              to="/asignaturas"
              search={defaultCatalogoAsignaturasSearch}
              className="text-muted-foreground hover:text-foreground mb-4 flex w-fit items-center gap-2 text-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a asignaturas
            </Link>
          ) : (
            <Link
              to="/planes/$planId/asignaturas"
              params={{ planId }}
              search={defaultAsignaturasSearch}
              className="text-muted-foreground hover:text-foreground mb-4 flex w-fit items-center gap-2 text-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Volver al plan
            </Link>
          )}

          <div className="flex flex-col gap-4">
            {/* Título Editable (Texto blanco controlado dentro del componente) */}
            <div className="-ml-2">
              <InlineEditTitle
                value={headerData.nombre}
                canEdit={canEditAsignatura}
                onSave={(val) => handleUpdateHeader('nombre', val)}
              />
            </div>

            {/* Fila de Metadatos Alineados */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Badge Estático del Tipo (Estilo oscuro sutil) */}
              <Badge
                variant="outline"
                className="border-border bg-muted/30 text-foreground flex h-8 cursor-default items-center gap-1.5 px-3"
              >
                <Tag size={12} className="text-muted-foreground" />
                {asignaturaApi.tipo}
              </Badge>

              {/* Badges Editables (Texto blanco controlado dentro de los componentes) */}

              <InlineEditBadge
                id="badge-clave"
                icon={<Hash size={14} />}
                label="Clave"
                value={headerData.codigo}
                canEdit={canEditAsignatura}
                onSave={(val) => handleUpdateHeader('codigo', val)}
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-8 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 text-sm dark:border-white/10 dark:bg-white/5">
                    <span className="text-foreground/70 dark:text-white/70">
                      <BookOpen size={14} />
                    </span>
                    <span className="text-foreground/70 text-xs font-medium tracking-wider uppercase dark:text-white/60">
                      Créditos
                    </span>
                    <span className="text-foreground font-semibold dark:text-white">
                      {headerData.creditos}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Créditos (calculado automáticamente)
                </TooltipContent>
              </Tooltip>

              <InlineEditBadge
                icon={<CalendarDays size={14} />}
                label={nombreTipoCiclo(
                  asignaturaApi.planes_estudio?.tipo_ciclo,
                )}
                type="number"
                value={headerData.ciclo}
                min={1}
                max={asignaturaApi.planes_estudio?.numero_ciclos ?? undefined}
                suffix="°"
                canEdit={canEditAsignatura}
                onSave={(val) =>
                  handleUpdateHeader('ciclo', parseInt(val) || 0)
                }
              />
              <div className="ml-auto">
                <ActiveViewersStack
                  users={subjectViewers}
                  showSubjectInfo={false}
                />
              </div>
            </div>

            {/* Subtítulo de contexto (Texto blanco sutil) */}
            <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
              <GraduationCap className="text-muted-foreground h-4 w-4 shrink-0" />
              <span>Pertenece al plan:</span>
              <span className="text-foreground font-medium">
                {getPlanDisplayName(asignaturaApi.planes_estudio)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* TABS NAVEGACIÓN (Se mantiene semántico para el cuerpo de la página) 
      <nav className="border-border bg-background/80 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="mx-auto px-4 py-1 md:px-6 lg:px-8">
          <div className="scrollbar-hide flex items-center justify-start gap-8 overflow-x-auto whitespace-nowrap md:justify-start">
          */}
      {confirmState && (
        <AlertaConflicto
          isOpen={confirmState.isOpen}
          onOpenChange={(open) => {
            if (!open) {
              confirmState.resolve(false)
              setConfirmState(null)
            }
          }}
          onConfirm={() => confirmState.resolve(true)}
          titulo="Conflicto de Seriación"
          descripcion={confirmState.mensaje}
        />
      )}

      {/* TABS */}

      <nav className="bg-card sticky top-0 z-20 border-b">
        <div className="mx-auto w-full max-w-7xl px-4 py-2 md:px-6 lg:px-8">
          {/* CAMBIOS CLAVE:
        1. overflow-x-auto: Permite scroll horizontal.
        2. scrollbar-hide: (Opcional) para que no se vea la barra fea.
        3. justify-start md:justify-center: Alineado a la izquierda en móvil para que el scroll funcione, centrado en desktop.
    */}
          <div className="no-scrollbar flex items-center justify-start gap-8 overflow-x-auto whitespace-nowrap md:justify-start">
            {[
              { label: 'Datos Generales', to: '' },
              { label: 'Contenido Temático', to: 'contenido' },
              { label: 'Bibliografía', to: 'bibliografia' },
              { label: 'Documento SEP', to: 'documento' },
            ].map((tab) => {
              const isActive =
                tab.to === ''
                  ? pathname === `/planes/${planId}/asignaturas/${asignaturaId}`
                  : pathname.includes(tab.to)

              return (
                <Link
                  key={tab.label}
                  to={
                    tab.to === ''
                      ? '/planes/$planId/asignaturas/$asignaturaId'
                      : `/planes/$planId/asignaturas/$asignaturaId/${tab.to}`
                  }
                  from="/planes/$planId/asignaturas/$asignaturaId"
                  params={{ planId, asignaturaId }}
                  className={cn(
                    'shrink-0 border-b-2 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary text-primary font-bold'
                      : 'text-muted-foreground hover:border-border hover:text-foreground border-transparent',
                  )}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <div
        className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8"
        data-comment-scope="subject-page"
        data-comment-key={asignaturaId}
      >
        <Outlet />
      </div>

      <PlanCommentsManager
        planId={planId}
        asignaturaId={asignaturaId}
        estadoActualId={plan?.estado_actual_id ?? undefined}
        isReadOnly={Boolean(plan?.estados_plan?.es_final)}
      />

      <ContextualActionsMenu
        hidden={Boolean(activePanel) || commentsOpen}
        options={[
          {
            id: 'comentarios',
            label: 'Comentarios',
            icon: MessageSquare,
            badge: unreadComments > 0 ? unreadComments : undefined,
          },
          {
            id: 'responsables',
            label: 'Responsables',
            icon: Users,
            hidden: !canManageResponsables,
          },
          {
            id: 'revision',
            label:
              asignaturaApi.estado === 'borrador'
                ? 'Enviar a revisión'
                : 'Revisión',
            icon: Send,
            hidden: !canReview,
          },
          {
            id: 'ia',
            label: 'IA de la Asignatura',
            icon: Brain,
            hidden: !capabilities.canUseIA,
          },
          {
            id: 'historial',
            label: 'Historial de Cambios',
            icon: History,
          },
        ]}
        onSelect={(id) => {
          if (id === 'comentarios') {
            openComments()
          } else {
            setActivePanel(id as SubjectContextualPanel)
          }
        }}
      />

      {activePanel === 'ia' && (
        <Sheet modal={false} open onOpenChange={() => setActivePanel(null)}>
          <SheetContent side="right" className="w-full p-0 sm:max-w-5xl">
            <SheetHeader className="sr-only">
              <SheetTitle>IA de la Asignatura</SheetTitle>
              <SheetDescription>
                Asistente de inteligencia artificial para la asignatura.
              </SheetDescription>
            </SheetHeader>
            <div className="h-full">
              <IAAsignaturaTab compact />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {activePanel === 'responsables' && (
        <Sheet modal={false} open onOpenChange={() => setActivePanel(null)}>
          <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
            <SheetHeader className="sr-only">
              <SheetTitle>Responsables</SheetTitle>
              <SheetDescription>
                Gestión de responsables de la asignatura.
              </SheetDescription>
            </SheetHeader>
            <div className="h-full overflow-y-auto p-4">
              <SubjectResponsablesPanel
                planId={planId}
                asignaturaId={asignaturaId}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {activePanel === 'revision' && (
        <Sheet modal={false} open onOpenChange={() => setActivePanel(null)}>
          <SheetContent side="right" className="w-full p-0 sm:max-w-md">
            <SheetHeader className="sr-only">
              <SheetTitle>Revisión</SheetTitle>
              <SheetDescription>
                Estado y acciones de revisión de la asignatura.
              </SheetDescription>
            </SheetHeader>
            <div className="h-full overflow-y-auto p-4">
              <SubjectRevisionPanel
                planId={planId}
                asignaturaId={asignaturaId}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {activePanel === 'historial' && (
        <Sheet modal={false} open onOpenChange={() => setActivePanel(null)}>
          <SheetContent side="right" className="w-full p-0 sm:max-w-3xl">
            <SheetHeader className="sr-only">
              <SheetTitle>Historial de Cambios</SheetTitle>
              <SheetDescription>
                Registro cronológico de cambios de la asignatura.
              </SheetDescription>
            </SheetHeader>
            <div className="h-full overflow-y-auto p-4">
              <SubjectHistoryPanel
                planId={planId}
                asignaturaId={asignaturaId}
                grupos={historyGrupos}
                onGruposChange={setHistoryGrupos}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
