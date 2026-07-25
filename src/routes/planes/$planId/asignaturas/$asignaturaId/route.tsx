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
  Sparkles,
  History,
  Check,
  GitBranch,
  Loader2,
  Plus,
  Unlink,
  Wand2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  PayloadProponerPrerrequisito,
  ResultadoProponerPrerrequisito,
} from '@/data'
import type { Tables } from '@/types/supabase'

import { IAAsignaturaTab } from '@/components/asignaturas/detalle/IAAsignaturaTab'
import { AlertaConflicto } from '@/components/asignaturas/detalle/mapa/AlertaConflicto'
import { ContextualActionsMenu } from '@/components/contexto/ContextualActionsMenu'
import { useContextualSheet } from '@/components/contexto/useContextualSheet'
import { ActiveViewersStack } from '@/components/shared/ActiveViewersStack'
import { RouteTabLink, RouteTabs } from '@/components/shared/RouteTabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { EditableNumber } from '@/components/ui/editable-number'
import { EditableText } from '@/components/ui/editable-text'
import { lateralConfetti } from '@/components/ui/lateral-confetti'
import { NotFoundPage } from '@/components/ui/NotFoundPage'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
import { useAccionAgente, useAgente, useColoresLineas } from '@/features/agente'
import { SubjectHistoryPanel } from '@/features/asignaturas/SubjectHistoryPanel'
import { SubjectResponsablesPanel } from '@/features/asignaturas/SubjectResponsablesPanel'
import { SubjectRevisionPanel } from '@/features/asignaturas/SubjectRevisionPanel'
import { CommentsDrawer } from '@/features/comentarios/components/CommentsDrawer'
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
  defaultAsignaturaHistorialSearch,
  defaultAsignaturasSearch,
  defaultCatalogoAsignaturasSearch,
} from '@/types/search'

type SubjectContextualPanel =
  | 'comentarios'
  | 'ia'
  | 'responsables'
  | 'revision'
  | 'historial'

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

type AsignaturaSeriacion = Pick<
  Tables<'asignaturas'>,
  'id' | 'codigo' | 'nombre' | 'numero_ciclo' | 'linea_plan_id'
>

function SeriacionControl({
  asignatura,
  asignaturas,
  canEdit,
  canUseIA,
  planId,
  isPending,
  tipoCiclo,
  onChange,
}: {
  asignatura: AsignaturaSeriacion & {
    prerrequisito_asignatura_id?: string | null
  }
  asignaturas: Array<AsignaturaSeriacion>
  canEdit: boolean
  canUseIA: boolean
  planId: string
  isPending: boolean
  tipoCiclo?: Tables<'planes_estudio'>['tipo_ciclo']
  onChange: (asignaturaId: string | null) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const seriada = asignaturas.find(
    (item) => item.id === asignatura.prerrequisito_asignatura_id,
  )
  const elegibles = useMemo(
    () =>
      asignaturas
        .filter(
          (item) =>
            item.id !== asignatura.id &&
            item.numero_ciclo !== null &&
            asignatura.numero_ciclo !== null &&
            item.numero_ciclo < asignatura.numero_ciclo,
        )
        .sort(
          (left, right) =>
            (right.numero_ciclo ?? 0) - (left.numero_ciclo ?? 0) ||
            left.nombre.localeCompare(right.nombre, 'es'),
        ),
    [asignatura.id, asignatura.numero_ciclo, asignaturas],
  )
  const mismaLinea = asignatura.linea_plan_id
    ? elegibles.filter(
        (item) => item.linea_plan_id === asignatura.linea_plan_id,
      )
    : []
  const otrasLineas = asignatura.linea_plan_id
    ? elegibles.filter(
        (item) => item.linea_plan_id !== asignatura.linea_plan_id,
      )
    : elegibles

  const selectSeriacion = async (id: string | null) => {
    const saved = await onChange(id)
    if (saved) setOpen(false)
  }

  const colores = useColoresLineas(planId)

  /**
   * En modo agente el clic no abre el buscador: la IA elige el antecedente entre
   * las mismas candidatas que vería el usuario, o rechaza con un motivo cuando
   * ninguna lo es de verdad —quitar la seriación (`null`) también es respuesta
   * válida—. El popover se intercepta en fase de captura porque Radix abre desde
   * el propio disparador.
   */
  const agenteSeriacion = useAccionAgente<
    ResultadoProponerPrerrequisito,
    string | null
  >({
    id: `seriacion:${asignatura.id}`,
    accion: 'proponer_prerrequisito',
    etiqueta: `Ajustar la seriación de «${asignatura.nombre}»`,
    ariaLabel: `Proponer la seriación de ${asignatura.nombre} con IA`,
    disabled: !canEdit || !canUseIA,
    colores,
    payload: () =>
      ({
        asignatura_id: asignatura.id,
        asignatura_nombre: asignatura.nombre,
        numero_ciclo: asignatura.numero_ciclo,
        nombre_ciclo: nombreTipoCiclo(tipoCiclo),
        prerrequisito_actual: asignatura.prerrequisito_asignatura_id ?? null,
        candidatas: elegibles.map((item) => ({
          id: item.id,
          nombre: item.nombre,
          clave: item.codigo,
          numero_ciclo: item.numero_ciclo,
          misma_linea:
            item.linea_plan_id !== null &&
            item.linea_plan_id === asignatura.linea_plan_id,
        })),
      }) satisfies PayloadProponerPrerrequisito,
    snapshot: () => asignatura.prerrequisito_asignatura_id ?? null,
    aplicar: async (resultado) => {
      const guardado = await onChange(resultado.asignatura_id)
      if (!guardado) throw new Error('No se pudo guardar la seriación.')
    },
    restaurar: async (previo) => {
      const guardado = await onChange(previo)
      if (!guardado) throw new Error('No se pudo restaurar la seriación.')
    },
  })

  const renderOption = (item: AsignaturaSeriacion) => (
    <CommandItem
      key={item.id}
      value={`${item.codigo ?? ''} ${item.nombre}`}
      onSelect={() => void selectSeriacion(item.id)}
      className="items-start py-2.5"
    >
      <Check
        className={cn(
          'mt-0.5 size-4',
          item.id === asignatura.prerrequisito_asignatura_id
            ? 'opacity-100'
            : 'opacity-0',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.nombre}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {item.codigo || 'Sin clave'} · {nombreTipoCiclo(tipoCiclo)}{' '}
          {item.numero_ciclo}
        </span>
      </span>
    </CommandItem>
  )

  if ((!canEdit && !seriada) || (!seriada && elegibles.length === 0))
    return null

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={seriada ? 'ghost' : 'outline'}
            size="sm"
            disabled={isPending || !canEdit}
            className={cn(
              'h-auto min-h-8 max-w-full justify-start gap-2 px-3 py-1.5',
              seriada && 'text-muted-foreground hover:text-foreground',
              agenteSeriacion.halo.className,
            )}
            style={agenteSeriacion.halo.style}
            {...agenteSeriacion.props}
          >
            {isPending || agenteSeriacion.ejecutando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : seriada ? (
              <GitBranch className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            {seriada ? (
              <span className="truncate">
                <span className="text-muted-foreground">Seriación</span>
                <span className="mx-2" aria-hidden="true">
                  ←
                </span>
                <span className="text-foreground font-medium">
                  {seriada.codigo ? `[${seriada.codigo}] ` : ''}
                  {seriada.nombre}
                </span>
              </span>
            ) : (
              'Añadir seriación'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(28rem,calc(100vw-2rem))] p-0"
        >
          <Command>
            <CommandInput placeholder="Buscar por clave o asignatura…" />
            <CommandList>
              <CommandEmpty>
                No hay asignaturas elegibles para esta seriación.
              </CommandEmpty>
              {mismaLinea.length > 0 && (
                <CommandGroup heading="Misma línea curricular">
                  {mismaLinea.map(renderOption)}
                </CommandGroup>
              )}
              {otrasLineas.length > 0 && (
                <CommandGroup
                  heading={
                    mismaLinea.length > 0
                      ? 'Otras líneas curriculares'
                      : 'Asignaturas de ciclos anteriores'
                  }
                >
                  {otrasLineas.map(renderOption)}
                </CommandGroup>
              )}
              {seriada && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value="quitar seriación"
                      onSelect={() => void selectSeriacion(null)}
                      className="text-destructive data-[selected=true]:text-destructive"
                    >
                      <Unlink className="size-4" />
                      Quitar seriación
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {agenteSeriacion.rechazo && (
        <p className="text-muted-foreground animate-in fade-in max-w-xs text-xs leading-relaxed">
          {agenteSeriacion.rechazo}
        </p>
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
  const { alternarDock } = useAgente()
  const academicScope = useAcademicScope()

  // Panel contextual
  const permissions = usePermissions()
  const {
    isOpen: commentsOpen,
    open: openComments,
    close: closeComments,
  } = usePlanComments()
  const {
    state: contextualSheetState,
    openPanel: openContextualPanel,
    setOpen: setContextualSheetOpen,
  } = useContextualSheet<SubjectContextualPanel>('ia')
  const requestedContextualPanel = useRouterState({
    select: (state) => state.location.state.reopenContextualPanel,
  })
  const [historySearch, setHistorySearch] = useState({
    ...defaultAsignaturaHistorialSearch,
    grupos: [...defaultAsignaturaHistorialSearch.grupos],
  })
  const { data: session } = useSession()
  const { data: comentarios } = useComentariosPlan(planId, asignaturaId)
  const { lastSeen } = useCommentsRead(planId, asignaturaId)
  const unreadComments = countUnread(
    comentarios ?? [],
    lastSeen,
    session?.user.id ?? null,
  )

  useEffect(() => {
    if (requestedContextualPanel === 'subject-ia') {
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
    (panel: Exclude<SubjectContextualPanel, 'comentarios'>) => {
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

  const handleUpdateSeriacion = async (seriacionId: string | null) => {
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'editar la seriación fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return false

    try {
      await updateAsignatura.mutateAsync({
        asignaturaId,
        patch: { prerrequisito_asignatura_id: seriacionId },
        adminOverrideReason,
      })
      return true
    } catch {
      return false
    }
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
              <SeriacionControl
                asignatura={asignaturaApi}
                asignaturas={todasLasAsignaturas ?? []}
                canEdit={canEditAsignatura}
                canUseIA={capabilities.canUseIA}
                planId={planId}
                isPending={updateAsignatura.isPending}
                tipoCiclo={asignaturaApi.planes_estudio?.tipo_ciclo}
                onChange={handleUpdateSeriacion}
              />
              <GraduationCap className="text-muted-foreground h-4 w-4 shrink-0" />
              <span>Pertenece al plan:</span>
              <Link
                to="/planes/$planId/asignaturas"
                search={defaultAsignaturasSearch}
                params={{ planId }}
                className="text-foreground hover:text-primary font-medium underline-offset-4 transition-colors hover:underline"
              >
                {getPlanDisplayName(asignaturaApi.planes_estudio)}
              </Link>
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

      <div className="bg-background/90 sticky top-0 z-20 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8">
          <RouteTabs
            value={
              pathname.includes('/contenido')
                ? 'contenido'
                : pathname.includes('/evaluacion')
                  ? 'evaluacion'
                  : pathname.includes('/bibliografia')
                    ? 'bibliografia'
                    : pathname.includes('/documento')
                      ? 'documento'
                      : 'general'
            }
            ariaLabel="Secciones de la asignatura"
          >
            <RouteTabLink
              tabValue="general"
              to="/planes/$planId/asignaturas/$asignaturaId"
              params={{ planId, asignaturaId }}
            >
              Datos Generales
            </RouteTabLink>
            <RouteTabLink
              tabValue="contenido"
              to="/planes/$planId/asignaturas/$asignaturaId/contenido"
              params={{ planId, asignaturaId }}
            >
              Contenido Temático
            </RouteTabLink>
            <RouteTabLink
              tabValue="evaluacion"
              to="/planes/$planId/asignaturas/$asignaturaId/evaluacion"
              params={{ planId, asignaturaId }}
            >
              Evaluación
            </RouteTabLink>
            <RouteTabLink
              tabValue="bibliografia"
              to="/planes/$planId/asignaturas/$asignaturaId/bibliografia"
              params={{ planId, asignaturaId }}
            >
              Bibliografía
            </RouteTabLink>
            <RouteTabLink
              tabValue="documento"
              to="/planes/$planId/asignaturas/$asignaturaId/documento"
              params={{ planId, asignaturaId }}
            >
              Documento SEP
            </RouteTabLink>
          </RouteTabs>
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8"
        data-comment-scope="subject-page"
        data-comment-key={asignaturaId}
      >
        <Outlet />
      </div>

      <PlanCommentsManager
        asignaturaId={asignaturaId}
        isReadOnly={Boolean(plan?.estados_plan?.es_final)}
      />

      <ContextualActionsMenu
        hidden={contextualSheetState.open || commentsOpen}
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
            icon: Sparkles,
            hidden: !capabilities.canUseIA,
          },
          {
            id: 'agente',
            label: 'Modo agente de inteligencia artificial',
            icon: Wand2,
            hidden: !capabilities.canUseIA,
          },
          {
            id: 'historial',
            label: 'Historial de Cambios',
            icon: History,
          },
        ]}
        onSelect={(id) => {
          // El modo agente no es un panel: cambia el comportamiento de toda la
          // página, así que no abre el Sheet.
          if (id === 'agente') {
            alternarDock()
          } else if (id === 'comentarios') {
            openCommentsPanel()
          } else {
            openNonCommentPanel(
              id as Exclude<SubjectContextualPanel, 'comentarios'>,
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
          showCloseButton={false}
          className={cn(
            'w-full p-0',
            contextualSheetState.panel === 'comentarios'
              ? 'sm:max-w-md'
              : contextualSheetState.panel === 'ia'
                ? 'sm:max-w-5xl'
                : contextualSheetState.panel === 'responsables'
                  ? 'sm:max-w-xl'
                  : contextualSheetState.panel === 'revision'
                    ? 'sm:max-w-md'
                    : 'sm:max-w-3xl',
          )}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>
              {contextualSheetState.panel === 'comentarios'
                ? 'Comentarios'
                : contextualSheetState.panel === 'ia'
                  ? 'IA de la Asignatura'
                  : contextualSheetState.panel === 'responsables'
                    ? 'Responsables'
                    : contextualSheetState.panel === 'revision'
                      ? 'Revisión'
                      : 'Historial de Cambios'}
            </SheetTitle>
            <SheetDescription>
              Contenido contextual de la asignatura.
            </SheetDescription>
          </SheetHeader>

          {contextualSheetState.panel === 'comentarios' && (
            <CommentsDrawer
              planId={planId}
              asignaturaId={asignaturaId}
              estadoActualId={plan?.estado_actual_id ?? undefined}
              isReadOnly={Boolean(plan?.estados_plan?.es_final)}
              onClose={closeContextualSheet}
            />
          )}

          {contextualSheetState.panel === 'ia' && (
            <div className="h-full">
              <IAAsignaturaTab compact />
            </div>
          )}

          {contextualSheetState.panel === 'responsables' && (
            <div className="h-full overflow-y-auto px-6 py-5">
              <SubjectResponsablesPanel
                planId={planId}
                asignaturaId={asignaturaId}
              />
            </div>
          )}

          {contextualSheetState.panel === 'revision' && (
            <div className="h-full overflow-y-auto px-6 py-5">
              <SubjectRevisionPanel
                planId={planId}
                asignaturaId={asignaturaId}
              />
            </div>
          )}

          {contextualSheetState.panel === 'historial' && (
            <div className="h-full overflow-y-auto px-6 py-5">
              <SubjectHistoryPanel
                planId={planId}
                asignaturaId={asignaturaId}
                search={historySearch}
                onChange={(next) =>
                  setHistorySearch((previous) => ({
                    ...previous,
                    ...next,
                  }))
                }
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
