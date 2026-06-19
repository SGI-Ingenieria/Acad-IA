import {
  createFileRoute,
  notFound,
  Outlet,
  Link,
  useLocation,
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
} from 'lucide-react'
import { Activity, useEffect, useMemo, useRef, useState } from 'react'

import { AlertaConflicto } from '@/components/asignaturas/detalle/mapa/AlertaConflicto'
import { ActiveViewersStack } from '@/components/shared/ActiveViewersStack'
import { Badge } from '@/components/ui/badge'
import { lateralConfetti } from '@/components/ui/lateral-confetti'
import { NotFoundPage } from '@/components/ui/NotFoundPage'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field'
import { Skeleton } from '@/components/ui/skeleton'
import { useSubject, useUpdateAsignatura, usePlanAsignaturas } from '@/data'
import { requireAnyPermission } from '@/data/auth/routeGuards'
import { usePermissions } from '@/data/hooks/usePermissions'
import { useRealtimePresence } from '@/data/hooks/useRealtimePresence'
import {
  planAsignaturasOptions,
  subjectOptions,
} from '@/data/query/queryOptions'
import { nombreTipoCiclo } from '@/lib/ciclo-utils'
import { cn } from '@/lib/utils'
import { defaultAsignaturasSearch } from '@/types/search'

export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId',
)({
  beforeLoad: ({ context }) =>
    requireAnyPermission(context.queryClient, [
      'asignaturas.ver',
      'planes.ver',
    ]),
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
  const [isEditing, setIsEditing] = useState(false)
  const [tempVal, setTempVal] = useState(value)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => setTempVal(value), [value])
  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const handleSave = () => {
    setIsEditing(false)
    if (tempVal.trim() && tempVal !== value) onSave(tempVal.trim())
    else setTempVal(value) // Revertir si está vacío
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={tempVal}
        onChange={(e) => setTempVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') {
            setTempVal(value)
            setIsEditing(false)
          }
        }}
        // Input estilizado para fondo oscuro: borde blanco sutil, texto blanco
        className="border-border bg-background/50 text-foreground focus:ring-primary/40 w-full rounded-md border px-2 py-1 text-3xl font-bold shadow-sm outline-none focus:ring-4"
      />
    )
  }

  return (
    <h1 className="text-foreground text-3xl font-bold">
      <button
        type="button"
        onClick={() => {
          if (canEdit) setIsEditing(true)
        }}
        className={cn(
          'group flex items-center gap-3 rounded-md px-2 py-1 transition-colors',
          canEdit ? 'hover:bg-accent' : 'cursor-default',
        )}
      >
        {value}
        {canEdit && (
          <Pencil className="text-muted-foreground hover:text-foreground h-5 w-5 opacity-0 transition-all group-hover:opacity-100" />
        )}
      </button>
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
  const [isEditing, setIsEditing] = useState(false)
  const [tempVal, setTempVal] = useState(value)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // NUEVO: Estado del highlight
  const [isHighlighted, setIsHighlighted] = useState(false)

  useEffect(() => setTempVal(value), [value])
  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  // NUEVO: Escuchar el evento disparado desde la página
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

  const handleSave = () => {
    setIsEditing(false)
    if (String(tempVal).trim() !== String(value)) {
      onSave(String(tempVal))
    }
  }

  // Clases dinámicas controladas por el estado
  const highlightClasses = isHighlighted
    ? 'ring-primary/40 border-primary/40 ring-2'
    : ''

  if (isEditing) {
    const cancelEdit = () => {
      setTempVal(value)
      setIsEditing(false)
    }

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
        className={`focus:ring-primary/40 flex h-8 items-center gap-2 rounded-md border px-3 shadow-sm transition-all duration-300 ${isHighlighted ? highlightClasses : 'ring-1 focus-within:ring-2'} border-gray-200 bg-gray-50 dark:border-white/20 dark:bg-white/5`}
      >
        <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase dark:text-white/60">
          {label}:
        </span>
        {type === 'number' ? (
          <NumberField
            value={Number(tempVal) || null}
            min={min}
            max={max}
            onValueChange={(nextValue) => setTempVal(nextValue ?? '')}
            className="w-24"
          >
            <NumberFieldGroup className="h-7 bg-transparent shadow-none">
              <NumberFieldDecrement className="w-7" />
              <NumberFieldInput
                ref={inputRef}
                aria-label={label}
                onBlur={handleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelEdit()
                }}
                className="w-10 px-1"
              />
              <NumberFieldIncrement className="w-7" />
            </NumberFieldGroup>
          </NumberField>
        ) : (
          <input
            ref={inputRef}
            type={type}
            value={tempVal}
            onChange={(e) => setTempVal(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelEdit()
            }}
            className="text-foreground w-16 bg-transparent text-sm font-semibold outline-none dark:text-white"
          />
        )}
      </form>
    )
  }

  return (
    <button
      id={id}
      onClick={() => {
        if (canEdit) setIsEditing(true)
      }}
      className={cn(
        `group flex h-8 items-center gap-2 rounded-md border px-3 text-sm transition-all duration-300 ${isHighlighted ? highlightClasses : ''} border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5`,
        canEdit ? 'hover:bg-gray-100 dark:hover:bg-white/10' : 'cursor-default',
      )}
    >
      <span className="text-foreground/70 dark:text-white/70">{icon}</span>
      <span className="text-foreground/60 text-xs font-medium tracking-wider uppercase dark:text-white/60">
        {label}:
      </span>
      <span className="text-foreground font-semibold dark:text-white">
        {value} {suffix}
      </span>
      {canEdit && (
        <Pencil className="text-foreground/50 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 dark:text-white/50" />
      )}
    </button>
  )
}

function AsignaturaLayout() {
  const location = useLocation()
  const { asignaturaId, planId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { has } = usePermissions()
  const canEditAsignatura = has('asignaturas.editar')

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

    updateAsignatura.mutate({ asignaturaId, patch })
  }

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    if ((location.state as any)?.showConfetti) {
      lateralConfetti()
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  if (
    pathname ===
    `/planes/${planId}/asignaturas/${asignaturaId}/iaasignatura/chat`
  ) {
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
          <Link
            to="/planes/$planId/asignaturas"
            params={{ planId }}
            search={defaultAsignaturasSearch}
            className="text-muted-foreground hover:text-foreground mb-4 flex w-fit items-center gap-2 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al plan
          </Link>

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

              <div
                title="Créditos (calculado automáticamente)"
                className="flex h-8 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 text-sm dark:border-white/10 dark:bg-white/5"
              >
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
                <Activity
                  mode={
                    asignaturaApi.planes_estudio?.carreras?.nivel === 'Otro'
                      ? 'hidden'
                      : 'visible'
                  }
                >
                  {`${asignaturaApi.planes_estudio?.carreras?.nivel} en `}
                </Activity>{' '}
                {asignaturaApi.planes_estudio?.nombre ?? ''}
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
              { label: 'Responsables', to: 'responsables' },
              { label: 'Revisión', to: 'revision' },
              { label: 'IA de la Asignatura', to: 'iaasignatura' },
              { label: 'Documento SEP', to: 'documento' },
              { label: 'Historial de Cambios', to: 'historial' },
            ].map((tab) => {
              const isActive =
                tab.to === ''
                  ? pathname === `/planes/${planId}/asignaturas/${asignaturaId}`
                  : pathname.includes(tab.to)

              return (
                <Link
                  key={tab.label}
                  to={
                    (tab.to === ''
                      ? '/planes/$planId/asignaturas/$asignaturaId'
                      : `/planes/$planId/asignaturas/$asignaturaId/${tab.to}`) as any
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

      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <Outlet />
      </div>
    </div>
  )
}
