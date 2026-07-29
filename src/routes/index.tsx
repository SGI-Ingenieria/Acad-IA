import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo } from 'react'

import type { ContextoMesaTrabajo } from '@/data/api/inicio.api'

import { Button } from '@/components/ui/button'
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
import { formatMesAnioEs } from '@/lib/plan-curricular'
import { defaultPlanesSearch } from '@/types/search'

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
  const { session, roleKeys, roleAssignments, isAdmin, isLoading } =
    usePermissions()
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
      <main className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-6">
        <div className="border-destructive/30 flex w-full items-start gap-4 border-y py-8">
          <AlertCircle className="text-destructive mt-1 size-6" />
          <div>
            <h1 className="text-xl font-semibold">
              No pudimos preparar tu mesa de trabajo
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Tu acceso sigue intacto. Vuelve a intentar cargar la información.
            </p>
            <Button
              className="mt-5"
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

  const data = mesa.data
  if (!data) return <InicioSkeleton />

  const esEvaluador = contexto.rolClave === 'EVALUADOR_EXTERNO'

  return (
    <main className="min-h-screen" data-guia="inicio-mesa-trabajo">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-8 sm:px-8 lg:py-12">
        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-primary text-sm font-semibold">
              {esEvaluador ? 'Bandeja de revisión' : 'Mesa de trabajo'}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              Hola, {userName}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
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

        {data.avisos.length > 0 && (
          <section aria-label="Avisos institucionales" className="space-y-3">
            {data.avisos.map((aviso) => (
              <article
                key={aviso.id}
                className="border-primary/25 bg-primary/5 flex flex-col gap-4 border-y px-1 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex gap-3">
                  <Sparkles className="text-primary mt-0.5 size-5 shrink-0" />
                  <div>
                    <h2 className="font-semibold">{aviso.titulo}</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
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
          <section
            aria-label="Hitos de trabajo"
            className="grid gap-x-8 gap-y-5 border-y py-6 sm:grid-cols-2 xl:grid-cols-4"
          >
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
          <section data-guia="salud-operativa">
            <EncabezadoSeccion
              titulo="Salud operativa"
              descripcion="Configuraciones que pueden impedir o degradar el trabajo académico."
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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

        <section data-guia="requiere-atencion">
          <EncabezadoSeccion
            titulo="Requiere tu atención"
            descripcion="Decisiones y revisiones que están esperando tu participación."
          />
          {data.requiereAtencion.length === 0 ? (
            <div className="mt-5 flex items-center gap-4 border-y py-7">
              <CheckCircle2 className="size-7 text-emerald-500" />
              <div>
                <p className="font-semibold">No tienes revisiones pendientes</p>
                <p className="text-muted-foreground text-sm">
                  Cuando se te asigne una decisión, aparecerá aquí.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-3 divide-y">
              {data.requiereAtencion.map((accion) => (
                <Link
                  key={accion.id}
                  to="/planes/$planId"
                  params={{ planId: accion.planId }}
                  className="organic-interactive group flex items-center justify-between gap-4 px-2 py-5"
                >
                  <div>
                    <p className="font-semibold">{accion.titulo}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
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
            <section>
              <EncabezadoSeccion
                titulo="Facultades"
                descripcion="Una lectura institucional por etapa y asuntos todavía abiertos."
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.facultades.map((facultad) => (
                  <article
                    key={facultad.id}
                    className="border-border border-l-2 py-3 pl-4"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="text-primary size-4" />
                      <h3 className="font-semibold">{facultad.nombre}</h3>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {facultad.planes} planes ·{' '}
                      {facultad.comentariosPendientes} comentarios pendientes
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

        <section data-guia="continuar-trabajo">
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
            <div className="mt-5 border-y py-10 text-center">
              <GraduationCap className="text-muted-foreground/40 mx-auto size-10" />
              <p className="mt-3 font-semibold">
                Aún no hay planes disponibles en este ámbito
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {esEvaluador
                  ? 'Una invitación activa hará aparecer aquí el plan correspondiente.'
                  : 'Crea el primer plan cuando la estructura académica esté lista.'}
              </p>
              {!esEvaluador && (
                <Button asChild className="mt-5">
                  <Link to="/planes/nuevo" search={defaultPlanesSearch}>
                    Crear plan de estudios
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-3 divide-y">
              {data.planesRecientes.map((plan) => (
                <Link
                  key={plan.id}
                  // Abrir un plan siempre lleva a lo mismo: sus datos
                  // generales. Saltar al mapa según la fase hacía que el
                  // mismo gesto aterrizara en pantallas distintas.
                  to="/planes/$planId"
                  params={{ planId: plan.id }}
                  className="organic-interactive group grid gap-3 px-2 py-5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">
                      {plan.nombre_display}
                    </h3>
                    <p className="text-muted-foreground mt-1 truncate text-sm">
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
                  <div className="flex items-center gap-3 md:justify-end">
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
    <div className="flex items-center gap-4">
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
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold">{titulo}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{descripcion}</p>
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
    <div className="flex gap-4 border-y py-5">
      {bien ? (
        <ShieldCheck className="mt-0.5 size-6 text-emerald-500" />
      ) : (
        <Settings2 className="text-warning mt-0.5 size-6" />
      )}
      <div>
        <p className="font-semibold">
          {bien ? 'Sin incidencias' : `${valor} · ${titulo}`}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">{detalle}</p>
      </div>
    </div>
  )
}

function InicioSkeleton() {
  return (
    <main className="mx-auto max-w-7xl space-y-10 px-6 py-12">
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-5 w-[32rem] max-w-full" />
      </div>
      <div className="grid gap-8 border-y py-7 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-72 w-full" />
    </main>
  )
}
