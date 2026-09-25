import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  CircleAlert,
  GraduationCap,
  ListChecks,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { ContextoMesaTrabajo } from '@/data/api/inicio.api'
import type {
  WorkspaceAction,
  WorkspaceAsignatura,
  WorkspaceContext,
  WorkspacePlan,
} from '@/features/workspace/types'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useMesaTrabajo } from '@/data/hooks/useInicio'
import { usePermissions } from '@/data/hooks/usePermissions'
import { useCatalogosPlanes } from '@/data/hooks/usePlans'
import {
  buildWorkspaceDashboard,
  groupActionsByPlan,
  groupSubjectsByPlan,
} from '@/features/workspace/dashboard'
import { resolveWorkspace } from '@/features/workspace/resolver'
import { formatMesAnioEs } from '@/lib/plan-curricular'
import { rutaContinuacionCurricular } from '@/lib/plan-navigation'
import { cn } from '@/lib/utils'
import { defaultAsignaturasSearch, defaultPlanesSearch } from '@/types/search'

type InicioSearch = {
  contexto?: string
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administración',
  VICERRECTOR_ACADEMICO: 'Vicerrectoría académica',
  DIRECTOR_FACULTAD: 'Dirección de facultad',
  SECRETARIO_ACADEMICO: 'Secretaría académica',
  PLANEACION_CURRICULAR: 'Planeación curricular',
  JEFE_POSGRADO: 'Jefatura de posgrado',
  JEFE_CARRERA: 'Jefatura de carrera',
  PROFESOR: 'Profesor',
  EVALUADOR_EXTERNO: 'Evaluación externa',
}

const FASE_LABELS = {
  FUNDAMENTOS: 'Definir fundamentos',
  BLOQUES: 'Organizar bloques de conocimiento',
  MAPA: 'Continuar el mapa curricular',
} as const

const parseSearch = (search: Record<string, unknown>): InicioSearch => ({
  contexto:
    typeof search.contexto === 'string' && search.contexto
      ? search.contexto
      : undefined,
})

export const Route = createFileRoute('/')({
  validateSearch: parseSearch,
  component: InicioPage,
})

function contextoId(contexto: ContextoMesaTrabajo) {
  return [
    contexto.rolClave,
    contexto.facultadId ?? '',
    contexto.carreraId ?? '',
  ].join(':')
}

function InicioPage() {
  const navigate = useNavigate({ from: '/' })
  const search = Route.useSearch()
  const {
    session,
    roleKeys,
    roleAssignments,
    permissions,
    isAdmin,
    isLoading,
  } = usePermissions()
  const { data: catalogos } = useCatalogosPlanes()

  const contextos = useMemo(() => {
    const items: Array<ContextoMesaTrabajo> = []

    if (isAdmin) items.push({ rolClave: 'ADMIN' })
    for (const role of roleAssignments) {
      items.push({
        rolClave: role.clave,
        facultadId: role.facultad_id,
        carreraId: role.carrera_id,
      })
    }
    for (const rolClave of roleKeys) {
      if (!items.some((item) => item.rolClave === rolClave)) {
        items.push({ rolClave })
      }
    }

    const unique = new Map(items.map((item) => [contextoId(item), item]))
    return Array.from(unique.values())
  }, [isAdmin, roleAssignments, roleKeys])

  const contexto =
    contextos.find((item) => contextoId(item) === search.contexto) ??
    contextos.at(0) ??
    null

  useEffect(() => {
    if (!search.contexto && contexto) {
      void navigate({
        search: { contexto: contextoId(contexto) },
        replace: true,
      })
    }
  }, [contexto, navigate, search.contexto])

  const mesa = useMesaTrabajo(contexto)
  const userName =
    String(session?.user.user_metadata.nombre_completo ?? '').trim() ||
    session?.user.email?.split('@')[0] ||
    'Usuario'

  const contextoLabel = (item: ContextoMesaTrabajo) => {
    const facultad = catalogos?.facultades.find(
      (value) => value.id === item.facultadId,
    )
    const carrera = catalogos?.carreras.find(
      (value) => value.id === item.carreraId,
    )
    return [
      ROLE_LABELS[item.rolClave] ?? item.rolClave,
      carrera?.nombre ?? facultad?.nombre,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  if (isLoading || !contexto) {
    return <InicioSkeleton />
  }

  if (mesa.isError) {
    return (
      <main className="px-seccion mx-auto flex min-h-[70vh] max-w-5xl items-center">
        <div className="border-destructive/30 gap-grupo py-region flex w-full items-start border-y">
          <AlertCircle className="text-destructive mt-micro size-6" />
          <div>
            <h1 className="text-xl font-semibold">
              No pudimos preparar tu mesa de trabajo
            </h1>
            <p className="text-muted-foreground mt-micro text-sm">
              Tu acceso sigue intacto. Vuelve a intentar cargar la información.
            </p>
            <Button
              className="mt-seccion"
              variant="outline"
              onClick={() => void mesa.refetch()}
            >
              Reintentar
            </Button>
          </div>
        </div>
      </main>
    )
  }

  const workspaceData = mesa.data
  if (!workspaceData) return <InicioSkeleton />
  const data = workspaceData.base

  const workspace = resolveWorkspace({
    usuarioId: session?.user.id ?? '',
    rolClave: contexto.rolClave,
    alcance: {
      facultadId: contexto.facultadId ?? undefined,
      carreraId: contexto.carreraId ?? undefined,
    },
    capacidades: workspaceData.capacidades,
    planes: workspaceData.planes,
    asignaturas: workspaceData.asignaturas,
    accionesPendientes: workspaceData.accionesPendientes,
    indicadores: workspaceData.indicadores,
    progreso: workspaceData.progreso,
    roleKeys,
    permissions,
    isAdmin,
  })

  const esEvaluador = contexto.rolClave === 'EVALUADOR_EXTERNO'

  return (
    <main className="min-h-screen" data-guia="inicio-mesa-trabajo">
      <div className="gap-pagina px-seccion py-region sm:px-region lg:py-pagina mx-auto flex max-w-7xl flex-col">
        <header className="gap-seccion flex flex-col justify-between md:flex-row md:items-end">
          <div>
            <p className="text-primary text-sm font-semibold">
              {esEvaluador ? 'Bandeja de revisión' : 'Mesa de trabajo'}
            </p>
            <h1 className="mt-micro text-3xl font-bold tracking-tight sm:text-4xl">
              Hola, {userName}
            </h1>
            <p className="text-muted-foreground mt-relacionado max-w-2xl">
              {esEvaluador
                ? 'Aquí están únicamente las revisiones en las que participas.'
                : 'Continúa el trabajo académico que necesita una decisión tuya.'}
            </p>
          </div>

          {contextos.length > 1 && (
            <Select
              value={contextoId(contexto)}
              onValueChange={(value) =>
                void navigate({ search: { contexto: value } })
              }
            >
              <SelectTrigger
                className="w-full md:w-80"
                aria-label="Cambiar perspectiva de trabajo"
                data-guia="selector-contexto"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contextos.map((item) => (
                  <SelectItem key={contextoId(item)} value={contextoId(item)}>
                    {contextoLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </header>

        <WorkspacePriority workspace={workspace} />

        <section
          aria-label="Resumen del espacio de trabajo"
          className="gap-seccion grid xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]"
        >
          <WorkspaceProgress workspace={workspace} />
          <div className="gap-seccion grid content-start">
            <WorkspacePendingActions workspace={workspace} />
            {workspace.estacion === 'CourseWorkspace' && (
              <WorkspaceSubjects workspace={workspace} />
            )}
            <WorkspaceOverview workspace={workspace} />
          </div>
        </section>

        {data.avisos.length > 0 && (
          <section
            aria-label="Avisos institucionales"
            className="space-y-control"
          >
            {data.avisos.map((aviso) => (
              <article
                key={aviso.id}
                className="border-primary/25 bg-primary/5 gap-grupo px-micro py-seccion flex flex-col border-y sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="gap-control flex">
                  <Sparkles className="text-primary mt-micro size-5 shrink-0" />
                  <div>
                    <h2 className="font-semibold">{aviso.titulo}</h2>
                    <p className="text-muted-foreground mt-micro text-sm">
                      {aviso.cuerpo}
                    </p>
                  </div>
                </div>
                {aviso.accionRuta && aviso.accionEtiqueta && (
                  <Button asChild variant="outline" size="sm">
                    <a href={aviso.accionRuta}>{aviso.accionEtiqueta}</a>
                  </Button>
                )}
              </article>
            ))}
          </section>
        )}

        {!esEvaluador && (
          <section aria-label="Hitos de trabajo" className="hidden">
            <Indicador
              icon={BookOpenText}
              valor={data.resumen.planes}
              etiqueta="Planes en tu ámbito"
            />
            <Indicador
              icon={ClipboardCheck}
              valor={data.resumen.tareasPendientes}
              etiqueta="Revisiones pendientes"
            />
            <Indicador
              icon={MessageSquareText}
              valor={data.resumen.comentariosPendientes}
              etiqueta="Comentarios por resolver"
            />
            <Indicador
              icon={CalendarClock}
              valor={data.resumen.vigenciasProximas}
              etiqueta="Vigencias próximas"
            />
          </section>
        )}

        {data.saludOperativa && (
          <section data-guia="salud-operativa" className="hidden">
            <EncabezadoSeccion
              titulo="Salud operativa"
              descripcion="Configuraciones que pueden impedir o degradar el trabajo académico."
            />
            <div className="mt-seccion gap-grupo grid sm:grid-cols-2">
              <EstadoOperativo
                valor={data.saludOperativa.estructurasSinVigencia}
                titulo="Estructuras sin vigencia"
                detalle="No pueden recomendarse de forma inequívoca por fecha."
              />
              <EstadoOperativo
                valor={data.saludOperativa.estructurasSinPlantilla}
                titulo="Estructuras sin documento"
                detalle="El plan podrá editarse, pero no generar su documento final."
              />
            </div>
          </section>
        )}

        <section data-guia="requiere-atencion" className="hidden">
          <EncabezadoSeccion
            titulo="Requiere tu atención"
            descripcion="Decisiones y revisiones que están esperando tu participación."
          />
          {data.requiereAtencion.length === 0 ? (
            <div className="mt-seccion gap-grupo py-region flex items-center border-y">
              <CheckCircle2 className="size-7 text-emerald-500" />
              <div>
                <p className="font-semibold">No tienes revisiones pendientes</p>
                <p className="text-muted-foreground text-sm">
                  Cuando se te asigne una decisión, aparecerá aquí.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-control divide-y">
              {data.requiereAtencion.map((accion) => (
                <Link
                  key={accion.id}
                  to="/planes/$planId"
                  params={{ planId: accion.planId }}
                  className="organic-interactive group gap-grupo px-relacionado py-seccion flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">{accion.titulo}</p>
                    <p className="text-muted-foreground mt-micro text-sm">
                      {accion.detalle ?? 'Revisión pendiente'}
                      {accion.fechaLimite &&
                        ` · Límite ${new Date(accion.fechaLimite).toLocaleDateString('es-MX')}`}
                    </p>
                  </div>
                  <ArrowRight className="text-muted-foreground group-hover:text-primary size-5" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {data.facultades.length > 1 &&
          ['ADMIN', 'VICERRECTOR_ACADEMICO'].includes(contexto.rolClave) && (
            <section className="hidden">
              <EncabezadoSeccion
                titulo="Facultades"
                descripcion="Una lectura institucional por etapa y asuntos todavía abiertos."
              />
              <div className="mt-grupo gap-grupo grid md:grid-cols-2 xl:grid-cols-3">
                {data.facultades.map((facultad) => (
                  <article
                    key={facultad.id}
                    className="border-border py-control pl-grupo border-l-2"
                  >
                    <div className="gap-relacionado flex items-center">
                      <Building2 className="text-primary size-4" />
                      <h3 className="font-semibold">{facultad.nombre}</h3>
                    </div>
                    <p className="text-muted-foreground mt-relacionado text-sm">
                      {facultad.planes} planes ·{' '}
                      {facultad.comentariosPendientes} comentarios pendientes
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

        <section data-guia="continuar-trabajo" className="hidden">
          <EncabezadoSeccion
            titulo={
              esEvaluador ? 'Revisiones accesibles' : 'Continúa trabajando'
            }
            descripcion={
              esEvaluador
                ? 'Planes abiertos para tu participación.'
                : 'Los planes con actividad más reciente en tu ámbito.'
            }
            accion={
              !esEvaluador ? (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/planes" search={defaultPlanesSearch}>
                    Ver todos <ArrowRight />
                  </Link>
                </Button>
              ) : null
            }
          />

          {data.planesRecientes.length === 0 ? (
            <div className="mt-seccion py-pagina border-y text-center">
              <GraduationCap className="text-muted-foreground/40 mx-auto size-10" />
              <p className="mt-control font-semibold">
                Aún no hay planes disponibles en este ámbito
              </p>
              <p className="text-muted-foreground mt-micro text-sm">
                {esEvaluador
                  ? 'Una invitación activa hará aparecer aquí el plan correspondiente.'
                  : 'Crea el primer plan cuando la estructura académica esté lista.'}
              </p>
              {!esEvaluador && (
                <Button asChild className="mt-seccion">
                  <Link to="/planes/nuevo" search={defaultPlanesSearch}>
                    Crear plan de estudios
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-control divide-y">
              {data.planesRecientes.map((plan) => (
                <Link
                  key={plan.id}
                  to={rutaContinuacionCurricular(plan.fase_diseno)}
                  params={{ planId: plan.id }}
                  className="organic-interactive group gap-control px-relacionado py-seccion grid md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">
                      {plan.nombre_display}
                    </h3>
                    <p className="text-muted-foreground mt-micro truncate text-sm">
                      {plan.facultad_nombre} · {plan.carrera_nombre}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">
                      {plan.estado_etiqueta ?? 'Sin etapa'}
                    </p>
                    <p className="text-muted-foreground">
                      {FASE_LABELS[plan.fase_diseno]}
                    </p>
                  </div>
                  <div className="gap-control flex items-center md:justify-end">
                    {plan.fecha_inicio_imparticion && (
                      <span className="text-muted-foreground text-xs">
                        {formatMesAnioEs(plan.fecha_inicio_imparticion)}
                      </span>
                    )}
                    <ArrowRight className="text-muted-foreground group-hover:text-primary size-5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Indicador({
  icon: Icon,
  valor,
  etiqueta,
}: {
  icon: typeof BookOpenText
  valor: number
  etiqueta: string
}) {
  return (
    <div className="gap-grupo flex items-center">
      <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-bold tabular-nums">{valor}</p>
        <p className="text-muted-foreground text-sm">{etiqueta}</p>
      </div>
    </div>
  )
}

function WorkspaceProgress({ workspace }: { workspace: WorkspaceContext }) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const dashboard = buildWorkspaceDashboard(workspace)
  const selectedGroup = dashboard.grupos.find(
    (group) => group.id === selectedGroupId,
  )
  const esProfesor = workspace.estacion === 'CourseWorkspace'

  return (
    <section
      aria-label="Avance del trabajo"
      className="border-primary/25 bg-primary/5 gap-seccion p-seccion flex flex-col border-y"
    >
      <div className="gap-control flex items-end justify-between">
        <div>
          <p className="text-primary text-sm font-semibold">
            Avance de tu trabajo
          </p>
          <p className="mt-micro text-4xl font-bold tabular-nums">
            {dashboard.porcentaje}%
          </p>
        </div>
        <p className="text-muted-foreground text-right text-sm tabular-nums">
          {dashboard.completadas} completos
          <br />
          {dashboard.pendientes} pendientes
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Avance del trabajo accionable"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={dashboard.porcentaje}
        className="bg-muted h-3 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full"
          style={{ width: `${dashboard.porcentaje}%` }}
        />
      </div>
      {dashboard.grupos.length > 0 && (
        <div className="gap-control grid">
          <p className="text-muted-foreground text-xs font-medium">
            {esProfesor ? 'Avance por plan' : 'Avance por carrera'}
          </p>
          {dashboard.grupos.slice(0, 4).map((group) => (
            <Button
              key={group.id}
              type="button"
              variant="ghost"
              className="organic-interactive h-auto w-full justify-start p-0 text-left whitespace-normal"
              onClick={() => setSelectedGroupId(group.id)}
            >
              <span className="min-w-0 flex-1">
                <span className="gap-control flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{group.etiqueta}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {group.porcentaje}%
                  </span>
                </span>
                <span className="bg-muted mt-micro block h-1.5 overflow-hidden rounded-full">
                  <span
                    className="bg-primary block h-full rounded-full"
                    style={{ width: `${group.porcentaje}%` }}
                  />
                </span>
              </span>
            </Button>
          ))}
        </div>
      )}
      <WorkspaceSelectionDialog
        open={selectedGroup !== undefined}
        onOpenChange={(open) => !open && setSelectedGroupId(null)}
        titulo={selectedGroup?.etiqueta ?? 'Avance'}
        descripcion="Selecciona el elemento que deseas continuar."
      >
        <div className="divide-y">
          {esProfesor
            ? workspace.asignaturas
                .filter((asignatura) => asignatura.planId === selectedGroup?.id)
                .map((asignatura) => (
                  <WorkspaceSubjectOption
                    key={asignatura.id}
                    asignatura={asignatura}
                  />
                ))
            : workspace.planes
                .filter((plan) => plan.carreraId === selectedGroup?.id)
                .map((plan) => (
                  <Link
                    key={plan.id}
                    to="/planes/$planId/asignaturas"
                    params={{ planId: plan.id }}
                    search={defaultAsignaturasSearch}
                    className="organic-interactive gap-grupo py-control flex items-center justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {plan.nombre}
                      </span>
                      <span className="text-muted-foreground mt-micro block text-sm">
                        {plan.asignaturasCompletas} de {plan.asignaturasTotal}{' '}
                        asignaturas completas
                      </span>
                    </span>
                    <ArrowRight className="text-muted-foreground size-5 shrink-0" />
                  </Link>
                ))}
        </div>
      </WorkspaceSelectionDialog>
    </section>
  )
}

function WorkspacePriority({ workspace }: { workspace: WorkspaceContext }) {
  const action = workspace.accionesPendientes.at(0)
  return (
    <section
      aria-label="Tu prioridad ahora"
      className="border-primary/30 bg-primary/5 gap-seccion p-region flex flex-col border-y sm:flex-row sm:items-center sm:justify-between"
      data-guia="prioridad-workspace"
    >
      <div className="gap-grupo flex items-start">
        {action ? (
          <CircleAlert className="text-warning mt-micro size-6 shrink-0" />
        ) : (
          <ListChecks className="text-primary mt-micro size-6 shrink-0" />
        )}
        <div>
          <p className="text-primary text-sm font-semibold">
            Tu prioridad ahora
          </p>
          <h2 className="mt-micro text-xl font-bold">{workspace.titulo}</h2>
          {action && (
            <p className="text-muted-foreground mt-micro max-w-2xl text-sm">
              {action.detalle}
            </p>
          )}
        </div>
      </div>
      {workspace.accionPrincipal && (
        <WorkspaceActionButton
          action={workspace.accionPrincipal}
          workspace={workspace}
        />
      )}
    </section>
  )
}

function WorkspaceActionButton({
  action,
  workspace,
}: {
  action: NonNullable<WorkspaceContext['accionPrincipal']>
  workspace: WorkspaceContext
}) {
  const responsibilityMatch = action.ruta.match(
    /^\/planes\/([^/]+)\/asignaturas\/([^/]+)\/responsables$/,
  )
  if (responsibilityMatch) {
    return (
      <Button asChild className="shrink-0">
        <Link
          to="/planes/$planId/asignaturas/$asignaturaId/responsables"
          params={{
            planId: responsibilityMatch[1],
            asignaturaId: responsibilityMatch[2],
          }}
        >
          {action.etiqueta}
          <ArrowRight />
        </Link>
      </Button>
    )
  }

  const subjectRouteMatch = action.ruta.match(
    /^\/planes\/([^/]+)\/asignaturas\/([^/]+)(?:\/(contenido|evaluacion))?$/,
  )
  if (subjectRouteMatch?.[3] === 'contenido') {
    return (
      <Button asChild className="shrink-0">
        <Link
          to="/planes/$planId/asignaturas/$asignaturaId/contenido"
          params={{
            planId: subjectRouteMatch[1],
            asignaturaId: subjectRouteMatch[2],
          }}
        >
          {action.etiqueta}
          <ArrowRight />
        </Link>
      </Button>
    )
  }
  if (subjectRouteMatch?.[3] === 'evaluacion') {
    return (
      <Button asChild className="shrink-0">
        <Link
          to="/planes/$planId/asignaturas/$asignaturaId/evaluacion"
          params={{
            planId: subjectRouteMatch[1],
            asignaturaId: subjectRouteMatch[2],
          }}
        >
          {action.etiqueta}
          <ArrowRight />
        </Link>
      </Button>
    )
  }
  if (subjectRouteMatch) {
    return (
      <Button asChild className="shrink-0">
        <Link
          to="/planes/$planId/asignaturas/$asignaturaId"
          params={{
            planId: subjectRouteMatch[1],
            asignaturaId: subjectRouteMatch[2],
          }}
        >
          {action.etiqueta}
          <ArrowRight />
        </Link>
      </Button>
    )
  }

  const assignment = workspace.asignaturas.find((item) =>
    action.ruta.includes(`/asignaturas/${item.id}`),
  )
  if (assignment) {
    return (
      <Button asChild className="shrink-0">
        <Link
          to="/planes/$planId/asignaturas/$asignaturaId"
          params={{ planId: assignment.planId, asignaturaId: assignment.id }}
        >
          {action.etiqueta}
          <ArrowRight />
        </Link>
      </Button>
    )
  }

  const planId = action.ruta.match(/^\/planes\/([^/]+)/)?.[1]
  if (planId && planId !== 'nuevo') {
    return (
      <Button asChild className="shrink-0">
        <Link to="/planes/$planId" params={{ planId }}>
          {action.etiqueta}
          <ArrowRight />
        </Link>
      </Button>
    )
  }

  if (action.ruta === '/planes/nuevo') {
    return (
      <Button asChild className="shrink-0">
        <Link to="/planes/nuevo" search={defaultPlanesSearch}>
          {action.etiqueta}
          <ArrowRight />
        </Link>
      </Button>
    )
  }

  return null
}

function WorkspacePendingActions({
  workspace,
}: {
  workspace: WorkspaceContext
}) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const groups = groupPendingActions(workspace.accionesPendientes)
  const selectedGroup = groups.find((group) => group.id === selectedGroupId)
  const selectedPlanGroups = groupActionsByPlan(
    selectedGroup?.actions ?? [],
    workspace.planes,
  )
  if (workspace.accionesPendientes.length < 2) return null

  return (
    <section aria-label="Pendientes prioritarios">
      <EncabezadoSeccion
        titulo="Pendientes prioritarios"
        descripcion="Agrupados por el cambio que requieren."
      />
      <div className="mt-seccion gap-grupo grid sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <Button
            key={group.id}
            type="button"
            variant="outline"
            className="organic-interactive border-border hover:border-primary/45 p-seccion h-auto min-h-32 justify-start text-left whitespace-normal"
            onClick={() => setSelectedGroupId(group.id)}
          >
            <CircleAlert
              className={cn(
                'mt-micro size-5 shrink-0',
                group.severidad === 'CRITICA'
                  ? 'text-destructive'
                  : 'text-warning',
              )}
            />
            <span className="ml-control min-w-0">
              <span className="block text-3xl font-bold tabular-nums">
                {group.actions.length}
              </span>
              <span className="mt-micro block font-semibold">
                {group.titulo}
              </span>
              <span className="text-muted-foreground mt-relacionado block text-xs">
                Seleccionar elementos
              </span>
            </span>
          </Button>
        ))}
      </div>

      <WorkspaceSelectionDialog
        open={selectedGroup !== undefined}
        onOpenChange={(open) => !open && setSelectedGroupId(null)}
        titulo={selectedGroup?.titulo ?? 'Pendientes'}
        descripcion="Los pendientes están separados por plan."
      >
        {selectedGroup &&
          selectedPlanGroups.map((planGroup) => (
            <section key={planGroup.id} className="py-control">
              <div className="gap-relacionado mb-relacionado pb-relacionado flex items-center justify-between border-b">
                <div className="min-w-0">
                  {planGroup.planId && planGroup.planId !== 'nuevo' ? (
                    <Link
                      to="/planes/$planId"
                      params={{ planId: planGroup.planId }}
                      className="hover:text-primary font-semibold"
                    >
                      {planGroup.planNombre}
                    </Link>
                  ) : (
                    <h3 className="font-semibold">{planGroup.planNombre}</h3>
                  )}
                  {planGroup.carreraNombre && (
                    <p className="text-muted-foreground mt-micro truncate text-xs">
                      {planGroup.carreraNombre}
                    </p>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {planGroup.acciones.length} pendientes
                </span>
              </div>
              <div className="divide-y">
                {planGroup.acciones.map((action) => (
                  <div
                    key={action.id}
                    className="gap-grupo py-control flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{action.titulo}</p>
                      <p className="text-muted-foreground mt-micro truncate text-sm">
                        {action.detalle}
                      </p>
                    </div>
                    <WorkspaceActionButton
                      workspace={workspace}
                      action={{ etiqueta: 'Abrir', ruta: action.ruta }}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
      </WorkspaceSelectionDialog>
    </section>
  )
}

function WorkspaceSelectionDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descripcion: string
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[min(38rem,calc(100dvh-2rem))] grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <DialogBody className="overflow-y-auto">{children}</DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function groupPendingActions(actions: Array<WorkspaceAction>) {
  const groups = new Map<
    string,
    {
      id: string
      titulo: string
      severidad: WorkspaceAction['severidad']
      actions: Array<WorkspaceAction>
    }
  >()
  const severityRank = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 }

  for (const action of actions) {
    const titulo = action.detalle.trim() || action.tipo
    const id = `${action.tipo}:${titulo}`
    const group = groups.get(id)
    if (group) {
      group.actions.push(action)
      if (severityRank[action.severidad] < severityRank[group.severidad]) {
        group.severidad = action.severidad
      }
    } else {
      groups.set(id, {
        id,
        titulo,
        severidad: action.severidad,
        actions: [action],
      })
    }
  }

  return Array.from(groups.values()).sort(
    (left, right) =>
      severityRank[left.severidad] - severityRank[right.severidad] ||
      right.actions.length - left.actions.length,
  )
}

function groupWorkspacePlans(plans: Array<WorkspacePlan>) {
  const groups = new Map<string, Array<WorkspacePlan>>()

  for (const plan of plans) {
    const title = plan.estadoEtiqueta ?? 'Sin etapa definida'
    const group = groups.get(title)
    if (group) group.push(plan)
    else groups.set(title, [plan])
  }

  return Array.from(groups, ([titulo, items]) => ({
    id: titulo,
    titulo,
    planes: items,
    progresoPromedio: Math.round(
      items.reduce((total, plan) => {
        const progreso = plan.asignaturasTotal
          ? (plan.asignaturasCompletas / plan.asignaturasTotal) * 100
          : 0
        return total + progreso
      }, 0) / items.length,
    ),
  }))
}

function WorkspaceOverview({ workspace }: { workspace: WorkspaceContext }) {
  const indicatorsWithFindings = workspace.indicadores.filter(
    (indicator) => indicator.valor > 0,
  )
  const hasOverview =
    indicatorsWithFindings.length > 0 || workspace.planes.length > 0
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const planGroups = groupWorkspacePlans(workspace.planes)
  const selectedGroup = planGroups.find((group) => group.id === selectedGroupId)
  if (!hasOverview) return null

  return (
    <section aria-label="Estado del trabajo" data-guia="resumen-workspace">
      <EncabezadoSeccion
        titulo="Estado del trabajo"
        descripcion="Indicadores y agrupaciones para priorizar el siguiente paso."
      />
      {indicatorsWithFindings.length > 0 && (
        <div className="mt-seccion gap-grupo grid sm:grid-cols-2 xl:grid-cols-4">
          {indicatorsWithFindings.map((indicator) => (
            <div
              key={indicator.id}
              className="border-border gap-grupo py-seccion flex items-start border-y"
            >
              <CircleAlert
                className={cn(
                  'mt-micro size-5',
                  indicator.severidad === 'CRITICA'
                    ? 'text-destructive'
                    : 'text-warning',
                )}
              />
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {indicator.valor}
                </p>
                <p className="font-medium">{indicator.titulo}</p>
                <p className="text-muted-foreground mt-micro text-xs">
                  {indicator.detalle}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {workspace.planes.length > 0 && (
        <div className="mt-seccion gap-grupo grid sm:grid-cols-2 xl:grid-cols-3">
          {planGroups.map((group) => (
            <Button
              key={group.id}
              type="button"
              variant="outline"
              className="organic-interactive border-border hover:border-primary/45 p-seccion h-auto min-h-32 justify-start text-left whitespace-normal"
              onClick={() => setSelectedGroupId(group.id)}
            >
              <BookOpenText className="text-primary mt-micro size-5 shrink-0" />
              <span className="ml-control min-w-0">
                <span className="block text-3xl font-bold tabular-nums">
                  {group.planes.length}
                </span>
                <span className="mt-micro block font-semibold">
                  {group.titulo}
                </span>
                <span className="text-muted-foreground mt-relacionado block text-xs">
                  {group.progresoPromedio}% de asignaturas completas
                </span>
              </span>
            </Button>
          ))}
        </div>
      )}
      <WorkspaceSelectionDialog
        open={selectedGroup !== undefined}
        onOpenChange={(open) => !open && setSelectedGroupId(null)}
        titulo={selectedGroup?.titulo ?? 'Planes'}
        descripcion="Selecciona el plan que deseas consultar."
      >
        {selectedGroup && (
          <div className="divide-y">
            {selectedGroup.planes.map((plan) => {
              const progreso = plan.asignaturasTotal
                ? Math.round(
                    (plan.asignaturasCompletas / plan.asignaturasTotal) * 100,
                  )
                : 0
              return (
                <Link
                  key={plan.id}
                  to="/planes/$planId/asignaturas"
                  params={{ planId: plan.id }}
                  search={defaultAsignaturasSearch}
                  className="organic-interactive gap-grupo py-control flex items-center justify-between"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {plan.nombre}
                    </span>
                    <span className="text-muted-foreground mt-micro block truncate text-sm">
                      {plan.facultadNombre} · {plan.carreraNombre} · {progreso}%
                    </span>
                  </span>
                  <ArrowRight className="text-muted-foreground size-5 shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </WorkspaceSelectionDialog>
    </section>
  )
}

function WorkspaceSubjects({ workspace }: { workspace: WorkspaceContext }) {
  const [selectorOpen, setSelectorOpen] = useState(false)
  const planGroups = groupSubjectsByPlan(workspace.asignaturas)
  if (workspace.asignaturas.length === 0) {
    return (
      <section className="border-border gap-grupo py-region flex items-center border-y">
        <GraduationCap className="text-muted-foreground size-6" />
        <div>
          <h2 className="font-semibold">No tienes asignaturas asignadas</h2>
          <p className="text-muted-foreground mt-micro text-sm">
            Cuando te asignen una asignatura aparecerá aquí con sus pendientes.
          </p>
        </div>
      </section>
    )
  }

  const progresoPromedio = Math.round(
    workspace.asignaturas.reduce(
      (total, asignatura) => total + asignatura.progreso,
      0,
    ) / workspace.asignaturas.length,
  )

  return (
    <section aria-label="Mis asignaturas" data-guia="asignaturas-workspace">
      <EncabezadoSeccion
        titulo="Mis asignaturas"
        descripcion="Selecciona una asignatura para continuar su desarrollo."
      />
      <div className="mt-seccion max-w-sm">
        <Button
          type="button"
          variant="outline"
          className="organic-interactive border-border hover:border-primary/45 p-seccion h-auto min-h-32 w-full justify-start text-left whitespace-normal"
          onClick={() => setSelectorOpen(true)}
        >
          <GraduationCap className="text-primary mt-micro size-5 shrink-0" />
          <span className="ml-control min-w-0">
            <span className="block text-3xl font-bold tabular-nums">
              {workspace.asignaturas.length}
            </span>
            <span className="mt-micro block font-semibold">
              Asignaturas a mi cargo
            </span>
            <span className="text-muted-foreground mt-relacionado block text-xs">
              {progresoPromedio}% de avance promedio
            </span>
          </span>
        </Button>
      </div>
      <WorkspaceSelectionDialog
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        titulo="Asignaturas a mi cargo"
        descripcion="Selecciona una asignatura para abrir su espacio de trabajo."
      >
        {planGroups.map((group) => (
          <section key={group.id} className="py-control">
            <div className="gap-relacionado mb-relacionado pb-relacionado flex items-center justify-between border-b">
              <div className="min-w-0">
                <Link
                  to="/planes/$planId"
                  params={{ planId: group.planId }}
                  className="hover:text-primary font-semibold"
                >
                  {group.planNombre}
                </Link>
                <p className="text-muted-foreground mt-micro truncate text-xs">
                  {group.carreraNombre}
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {group.asignaturas.length} asignaturas
              </span>
            </div>
            <div className="divide-y">
              {group.asignaturas.map((asignatura) => (
                <WorkspaceSubjectOption
                  key={asignatura.id}
                  asignatura={asignatura}
                />
              ))}
            </div>
          </section>
        ))}
      </WorkspaceSelectionDialog>
    </section>
  )
}

function WorkspaceSubjectOption({
  asignatura,
}: {
  asignatura: WorkspaceAsignatura
}) {
  return (
    <Link
      to="/planes/$planId/asignaturas/$asignaturaId"
      params={{ planId: asignatura.planId, asignaturaId: asignatura.id }}
      className="organic-interactive gap-grupo py-control flex items-center justify-between"
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold">
          {asignatura.nombre}
        </span>
        <span className="text-muted-foreground mt-micro block truncate text-sm">
          {asignatura.planNombre} · {asignatura.carreraNombre} ·{' '}
          {asignatura.progreso}%
        </span>
      </span>
      <ArrowRight className="text-muted-foreground size-5 shrink-0" />
    </Link>
  )
}

function EncabezadoSeccion({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string
  descripcion: string
  accion?: React.ReactNode
}) {
  return (
    <div className="gap-grupo flex items-end justify-between">
      <div>
        <h2 className="text-xl font-bold">{titulo}</h2>
        <p className="text-muted-foreground mt-micro text-sm">{descripcion}</p>
      </div>
      {accion}
    </div>
  )
}

function EstadoOperativo({
  valor,
  titulo,
  detalle,
}: {
  valor: number
  titulo: string
  detalle: string
}) {
  const bien = valor === 0
  return (
    <div className="gap-grupo py-seccion flex border-y">
      {bien ? (
        <ShieldCheck className="mt-micro size-6 text-emerald-500" />
      ) : (
        <Settings2 className="text-warning mt-micro size-6" />
      )}
      <div>
        <p className="font-semibold">
          {bien ? 'Sin incidencias' : `${valor} · ${titulo}`}
        </p>
        <p className="text-muted-foreground mt-micro text-sm">{detalle}</p>
      </div>
    </div>
  )
}

function InicioSkeleton() {
  return (
    <main className="space-y-pagina px-seccion py-pagina mx-auto max-w-7xl">
      <div className="space-y-control">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-5 w-[32rem] max-w-full" />
      </div>
      <div className="gap-region py-region grid border-y sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-72 w-full" />
    </main>
  )
}
