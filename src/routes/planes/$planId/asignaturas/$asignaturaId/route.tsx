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
import { Badge } from '@/components/ui/badge'
import { lateralConfetti } from '@/components/ui/lateral-confetti'
import { NotFoundPage } from '@/components/ui/NotFoundPage'
import { useSubject, useUpdateAsignatura, usePlanAsignaturas } from '@/data'
import {
  planAsignaturasOptions,
  subjectOptions,
} from '@/data/query/queryOptions'
import { cn } from '@/lib/utils'
import { defaultAsignaturasSearch } from '@/types/search'

export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId',
)({
  loader: async ({
    context: { queryClient },
    params: { asignaturaId, planId },
  }) => {
    try {
      await queryClient.ensureQueryData(subjectOptions(asignaturaId))
    } catch (e: any) {
      if (e?.code === 'PGRST116') throw notFound()
      throw e
    }
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
  onSave,
}: {
  value: string
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
        onClick={() => setIsEditing(true)}
        className="hover:bg-accent group flex items-center gap-3 rounded-md px-2 py-1 transition-colors"
      >
        {value}
        <Pencil className="text-muted-foreground hover:text-foreground h-5 w-5 opacity-0 transition-all group-hover:opacity-100" />
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
  onSave,
}: {
  id?: string
  icon: React.ReactNode
  label: string
  value: string | number
  suffix?: string
  type?: 'text' | 'number'
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
    return (
      <div
        className={`focus:ring-primary/40 flex h-8 items-center gap-2 rounded-md border px-3 shadow-sm transition-all duration-300 ${isHighlighted ? highlightClasses : 'ring-1 focus-within:ring-2'} border-gray-200 bg-gray-50 dark:border-white/20 dark:bg-white/5`}
      >
        <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase dark:text-white/60">
          {label}:
        </span>
        <input
          ref={inputRef}
          type={type}
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
          className="text-foreground w-16 bg-transparent text-sm font-semibold outline-none dark:text-white"
        />
      </div>
    )
  }

  return (
    <button
      id={id}
      onClick={() => setIsEditing(true)}
      className={`group flex h-8 items-center gap-2 rounded-md border px-3 text-sm transition-all duration-300 ${isHighlighted ? highlightClasses : ''} border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10`}
    >
      <span className="text-foreground/70 dark:text-white/70">{icon}</span>
      <span className="text-foreground/60 text-xs font-medium tracking-wider uppercase dark:text-white/60">
        {label}:
      </span>
      <span className="text-foreground font-semibold dark:text-white">
        {value} {suffix}
      </span>
      <Pencil className="text-foreground/50 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 dark:text-white/50" />
    </button>
  )
}

function AsignaturaLayout() {
  const location = useLocation()
  const { asignaturaId, planId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })

  const { data: asignaturaApi } = useSubject(asignaturaId)
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
                onSave={(val) => handleUpdateHeader('codigo', val)}
              />

              <InlineEditBadge
                icon={<BookOpen size={14} />}
                label="Créditos"
                type="number"
                value={headerData.creditos}
                onSave={(val) =>
                  handleUpdateHeader('creditos', parseInt(val) || 0)
                }
              />

              <InlineEditBadge
                icon={<CalendarDays size={14} />}
                label="Semestre"
                type="number"
                value={headerData.ciclo}
                suffix="°"
                onSave={(val) =>
                  handleUpdateHeader('ciclo', parseInt(val) || 0)
                }
              />
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
