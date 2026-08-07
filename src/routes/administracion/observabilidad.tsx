import { createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  ExternalLink,
  GitBranch,
  KeyRound,
  Play,
  RefreshCw,
  ServerCrash,
  TimerReset,
  Trash2,
  Webhook,
  Wifi,
} from 'lucide-react'
import { useMemo } from 'react'

import type {
  EdgeFunctionProbe,
  HealthStatus,
  TestRunRecord,
  WebhookEventRecord,
} from '@/data/api/observability.api'

import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageContainer } from '@/components/ui/layout'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { requireAdmin } from '@/data/auth/routeGuards'
import {
  useClearRecentObservability,
  useObservabilitySnapshot,
  useOpenAIBackgroundTest,
  useOpenAIForegroundTest,
} from '@/data/hooks/useObservability'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/administracion/observabilidad')({
  beforeLoad: ({ context }) => requireAdmin(context.queryClient),
  component: RouteComponent,
})

function statusLabel(status: HealthStatus | undefined) {
  if (status === 'ok') return 'Operando'
  if (status === 'warning') return 'Revisar'
  if (status === 'error') return 'Foco rojo'
  return 'Cargando'
}

function StatusBadge({
  status,
  label,
}: {
  status?: HealthStatus
  label?: string
}) {
  if (status === 'error') {
    return <Badge variant="destructive">{label ?? statusLabel(status)}</Badge>
  }

  if (status === 'warning') {
    return (
      <Badge
        variant="outline"
        className="border-amber-400/70 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
      >
        {label ?? statusLabel(status)}
      </Badge>
    )
  }

  if (status === 'ok') {
    return (
      <Badge
        variant="outline"
        className="border-emerald-400/70 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
      >
        {label ?? statusLabel(status)}
      </Badge>
    )
  }

  return <Badge variant="secondary">{label ?? statusLabel(status)}</Badge>
}

/**
 * Estado global como icono + tooltip (regla de diseño: las palabras sobran
 * cuando un icono comunica lo mismo). El punto respira con `status-pulse`
 * cuando todo opera.
 */
function StatusDot({ status }: { status?: HealthStatus }) {
  const tone =
    status === 'error'
      ? 'bg-destructive'
      : status === 'warning'
        ? 'bg-amber-500'
        : status === 'ok'
          ? 'bg-emerald-500'
          : 'bg-muted-foreground'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          aria-label={statusLabel(status)}
          className={cn(
            'inline-flex size-3 shrink-0 rounded-full',
            tone,
            status === 'ok' && 'status-pulse',
          )}
        />
      </TooltipTrigger>
      <TooltipContent>{statusLabel(status)}</TooltipContent>
    </Tooltip>
  )
}

function formatLatency(value: number | null | undefined) {
  return typeof value === 'number' ? `${value} ms` : 'Sin dato'
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin dato'

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value))
}

function shortId(value: string | null | undefined) {
  if (!value) return 'Sin dato'
  if (value.length <= 18) return value
  return `${value.slice(0, 10)}…${value.slice(-6)}`
}

function envState(value: boolean) {
  return value ? (
    <StatusBadge status="ok" label="Configurado" />
  ) : (
    <StatusBadge status="error" label="Falta" />
  )
}

function SummaryTile({
  title,
  value,
  status,
  icon: Icon,
}: {
  title: string
  value: string
  status?: HealthStatus
  icon: typeof Activity
}) {
  return (
    <div className="bg-card gap-grupo p-grupo flex items-center justify-between rounded-xl border shadow-sm">
      <div className="min-w-0">
        <p className="text-muted-foreground text-sm">{title}</p>
        <p className="text-foreground mt-micro truncate text-lg font-semibold">
          {value}
        </p>
      </div>
      <div className="bg-muted text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
        <Icon className="h-5 w-5" />
      </div>
      <StatusBadge status={status} />
    </div>
  )
}

function EdgeFunctionsTable({ items }: { items: Array<EdgeFunctionProbe> }) {
  const sorted = [...items].sort((a, b) => {
    const weight = { error: 0, warning: 1, ok: 2 }
    return weight[a.status] - weight[b.status] || a.name.localeCompare(b.name)
  })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Función</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Tiempo</TableHead>
          <TableHead>Detalle</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((item) => (
          <TableRow key={item.name}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell>
              <StatusBadge status={item.status} />
            </TableCell>
            <TableCell>{formatLatency(item.latencyMs)}</TableCell>
            <TableCell className="max-w-sm whitespace-normal">
              <span className="text-muted-foreground text-sm">
                {item.errorKind ? `${item.errorKind}: ` : ''}
                {item.message ?? `HTTP ${item.httpStatus ?? 'sin dato'}`}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function WebhookEventsTable({ events }: { events: Array<WebhookEventRecord> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Evento</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Recibido</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell className="font-mono text-xs">
              {shortId(event.event_id)}
            </TableCell>
            <TableCell>
              {event.event_type}
              {event.delivery_count > 1 ? ` ×${event.delivery_count}` : ''}
            </TableCell>
            <TableCell>
              <StatusBadge
                status={
                  event.processing_status === 'failed'
                    ? 'error'
                    : event.processing_status === 'ignored'
                      ? 'warning'
                      : 'ok'
                }
                label={event.processing_status}
              />
            </TableCell>
            <TableCell>{formatDate(event.last_received_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TestRunsTable({ runs }: { runs: Array<TestRunRecord> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Prueba</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Respuesta</TableHead>
          <TableHead>Tiempo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell>{run.tipo}</TableCell>
            <TableCell>
              <StatusBadge
                status={
                  run.estado === 'failed'
                    ? 'error'
                    : run.estado === 'running' || run.estado === 'pending'
                      ? 'warning'
                      : 'ok'
                }
                label={run.estado}
              />
            </TableCell>
            <TableCell className="font-mono text-xs">
              {shortId(run.openai_response_id)}
            </TableCell>
            <TableCell>{formatLatency(run.latency_ms)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RouteComponent() {
  const snapshotQuery = useObservabilitySnapshot()
  const foregroundTest = useOpenAIForegroundTest()
  const backgroundTest = useOpenAIBackgroundTest()
  const clearRecent = useClearRecentObservability()
  const snapshot = snapshotQuery.data

  const summary = useMemo(
    () => [
      {
        title: 'Supabase',
        value: formatLatency(snapshot?.supabase.latencyMs),
        status: snapshot?.supabase.status,
        icon: Wifi,
      },
      {
        title: 'Edge Functions',
        value: `${snapshot?.edgeFunctions.error ?? 0} fallas`,
        status: snapshot?.edgeFunctions.status,
        icon: ServerCrash,
      },
      {
        title: 'OpenAI',
        value: formatLatency(snapshot?.openai.latencyMs),
        status: snapshot?.openai.status,
        icon: Activity,
      },
      {
        title: 'Migraciones',
        value: `${snapshot?.migrations.missing.length ?? 0} pendientes`,
        status: snapshot?.migrations.status,
        icon: GitBranch,
      },
    ],
    [snapshot],
  )

  const handleForegroundTest = async () => {
    try {
      await foregroundTest.mutateAsync()
      notify.success('Prueba inmediata completada.')
    } catch (error) {
      notify.error(error, {
        description: 'No se pudo completar la prueba inmediata.',
      })
    }
  }

  const handleBackgroundTest = async () => {
    try {
      await backgroundTest.mutateAsync()
      notify.success('Prueba en segundo plano iniciada.')
    } catch (error) {
      notify.error(error, {
        description: 'No se pudo iniciar la prueba en segundo plano.',
      })
    }
  }

  const handleClearTestRuns = async () => {
    const confirmed = await showAppConfirm({
      title: 'Borrar pruebas recientes',
      description:
        '¿Borrar todas las pruebas recientes? Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar',
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await clearRecent.mutateAsync('test_runs')
      notify.success('Pruebas recientes eliminadas.')
    } catch (error) {
      notify.error(error, {
        description: 'No se pudieron eliminar las pruebas recientes.',
      })
    }
  }

  const handleClearWebhookEvents = async () => {
    const confirmed = await showAppConfirm({
      title: 'Borrar eventos recientes',
      description:
        '¿Borrar todos los eventos recientes? Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar',
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await clearRecent.mutateAsync('webhook_events')
      notify.success('Eventos recientes eliminados.')
    } catch (error) {
      notify.error(error, {
        description: 'No se pudieron eliminar los eventos recientes.',
      })
    }
  }

  if (snapshotQuery.error) {
    return (
      <main className="bg-background px-grupo py-region min-h-screen">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>No se pudo abrir observabilidad</CardTitle>
              <CardDescription>
                La sección requiere conexión con Supabase y la función de salud.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => snapshotQuery.refetch()}>
                <RefreshCw className="h-4 w-4" />
                Intentar de nuevo
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-background min-h-screen">
      <PageContainer className="gap-seccion flex flex-col">
        <section className="gap-grupo flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-muted-foreground mb-relacionado gap-relacionado flex items-center text-sm font-medium">
              <Activity className="h-4 w-4" />
              Observabilidad
            </div>
            <h1 className="text-foreground text-3xl font-bold tracking-tight">
              Salud del sistema
            </h1>
            <p className="text-muted-foreground mt-relacionado text-sm">
              Última revisión: {formatDate(snapshot?.checkedAt)}
            </p>
          </div>

          <div className="gap-relacionado flex flex-wrap">
            <Button
              variant="outline"
              onClick={() => snapshotQuery.refetch()}
              disabled={snapshotQuery.isFetching}
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <StatusDot status={snapshot?.status} />
          </div>
        </section>

        <section className="gap-control grid sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
            <SummaryTile key={item.title} {...item} />
          ))}
        </section>

        <Card>
          <CardHeader>
            <div className="gap-control flex items-start justify-between">
              <div>
                <CardTitle className="gap-relacionado flex items-center">
                  <TimerReset className="h-5 w-5" />
                  Recuperación de generaciones de IA
                </CardTitle>
                <CardDescription>
                  {snapshot?.aiGenerations.message ??
                    'Consultando la cola de recuperación...'}
                </CardDescription>
              </div>
              <StatusBadge status={snapshot?.aiGenerations.status} />
            </div>
          </CardHeader>
          <CardContent className="gap-control grid sm:grid-cols-3">
            <div className="p-control rounded-lg border">
              <p className="text-muted-foreground text-xs">Pendientes</p>
              <p className="mt-micro text-xl font-semibold">
                {snapshot?.aiGenerations.summary.pendientes ?? 0}
              </p>
            </div>
            <div className="p-control rounded-lg border">
              <p className="text-muted-foreground text-xs">
                Trabajo más antiguo
              </p>
              <p className="mt-micro text-sm font-medium">
                {formatDate(snapshot?.aiGenerations.summary.mas_antiguo_en)}
              </p>
            </div>
            <div className="p-control rounded-lg border">
              <p className="text-muted-foreground text-xs">
                Arrendamientos vencidos
              </p>
              <p className="mt-micro text-xl font-semibold">
                {snapshot?.aiGenerations.summary.arrendamientos_vencidos ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <section className="gap-seccion grid xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="gap-relacionado flex items-center">
                <ServerCrash className="h-5 w-5" />
                Edge Functions
              </CardTitle>
              <CardDescription>
                {snapshot?.edgeFunctions.error ?? 0} con falla,{' '}
                {snapshot?.edgeFunctions.warning ?? 0} por revisar,{' '}
                {snapshot?.edgeFunctions.ok ?? 0} operando.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {snapshot ? (
                <EdgeFunctionsTable items={snapshot.edgeFunctions.items} />
              ) : (
                <div className="text-muted-foreground py-region text-sm">
                  Cargando funciones...
                </div>
              )}
            </CardContent>
          </Card>

          <div className="gap-seccion flex flex-col">
            <Card>
              <CardHeader>
                <CardTitle className="gap-relacionado flex items-center">
                  <Wifi className="h-5 w-5" />
                  Supabase
                </CardTitle>
                <CardDescription>
                  {snapshot?.supabase.message ?? 'Consultando Supabase...'}
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-control grid">
                <div className="gap-grupo p-control flex items-center justify-between rounded-lg border">
                  <span className="text-muted-foreground text-sm">
                    Comunicación
                  </span>
                  <span className="font-medium">
                    {formatLatency(snapshot?.supabase.latencyMs)}
                  </span>
                </div>
                <div className="gap-grupo p-control flex items-center justify-between rounded-lg border">
                  <span className="text-muted-foreground text-sm">
                    Token de acceso
                  </span>
                  <StatusBadge status={snapshot?.authToken.status} />
                </div>
                {snapshot?.serviceEnv.map((item) => (
                  <div
                    key={item.name}
                    className="gap-grupo p-control flex items-center justify-between rounded-lg border"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground min-w-0 truncate text-sm">
                          {item.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{item.name}</TooltipContent>
                    </Tooltip>
                    {envState(item.present)}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="gap-relacionado flex items-center">
                  <GitBranch className="h-5 w-5" />
                  Migraciones
                </CardTitle>
                <CardDescription>
                  {snapshot?.migrations.github.message ??
                    'Comparando migraciones...'}
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-control grid">
                <div className="gap-control grid grid-cols-2">
                  <div className="p-control rounded-lg border">
                    <p className="text-muted-foreground text-xs">Aplicadas</p>
                    <p className="mt-micro text-xl font-semibold">
                      {snapshot?.migrations.applied.length ?? 0}
                    </p>
                  </div>
                  <div className="p-control rounded-lg border">
                    <p className="text-muted-foreground text-xs">Esperadas</p>
                    <p className="mt-micro text-xl font-semibold">
                      {snapshot?.migrations.expected.length ?? 0}
                    </p>
                  </div>
                </div>
                <div className="gap-grupo p-control flex items-center justify-between rounded-lg border">
                  <span className="text-muted-foreground text-sm">
                    GitHub App
                  </span>
                  {envState(Boolean(snapshot?.migrations.github.configured))}
                </div>
                <div className="p-control rounded-lg border">
                  <p className="text-muted-foreground text-xs">
                    Última aplicada
                  </p>
                  <p className="mt-micro font-mono text-sm">
                    {snapshot?.migrations.latestApplied ?? 'Sin dato'}
                  </p>
                </div>
                {(snapshot?.migrations.missing.length ?? 0) > 0 ? (
                  <div className="border-destructive/40 bg-destructive/5 text-destructive p-control rounded-lg border text-sm">
                    Faltan {snapshot?.migrations.missing.length} migraciones.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="gap-seccion grid xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="gap-relacionado flex items-center">
                <KeyRound className="h-5 w-5" />
                OpenAI
              </CardTitle>
              <CardDescription>
                {snapshot?.openai.message ?? 'Validando OpenAI...'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-grupo">
              <div className="gap-control grid sm:grid-cols-2">
                <div className="gap-grupo p-control flex items-center justify-between rounded-lg border">
                  <span className="text-muted-foreground min-w-0 truncate text-sm">
                    OPENAI_API_KEY
                  </span>
                  {envState(Boolean(snapshot?.openai.env.apiKey))}
                </div>
                <div className="gap-grupo p-control flex items-center justify-between rounded-lg border">
                  <span className="text-muted-foreground min-w-0 truncate text-sm">
                    OPENAI_PROJECT_ID
                  </span>
                  {envState(Boolean(snapshot?.openai.env.projectId))}
                </div>
                <div className="gap-grupo p-control flex items-center justify-between rounded-lg border">
                  <span className="text-muted-foreground min-w-0 truncate text-sm">
                    OPENAI_WEBHOOK_SECRET
                  </span>
                  {envState(Boolean(snapshot?.openai.env.webhookSecret))}
                </div>
                <div className="gap-grupo p-control flex items-center justify-between rounded-lg border">
                  <span className="text-muted-foreground min-w-0 truncate text-sm">
                    Llave válida
                  </span>
                  <StatusBadge
                    status={snapshot?.openai.identity.status}
                    label={
                      snapshot?.openai.keyValid
                        ? 'Validada'
                        : statusLabel(snapshot?.openai.identity.status)
                    }
                  />
                </div>
                <div className="gap-grupo p-control flex items-center justify-between rounded-lg border">
                  <span className="text-muted-foreground min-w-0 truncate text-sm">
                    Proyecto / organización
                  </span>
                  <StatusBadge
                    status={snapshot?.openai.models.status}
                    label={
                      snapshot?.openai.projectContextValid
                        ? 'Aceptado'
                        : statusLabel(snapshot?.openai.models.status)
                    }
                  />
                </div>
                <div className="gap-grupo p-control flex items-center justify-between rounded-lg border">
                  <span className="text-muted-foreground min-w-0 truncate text-sm">
                    API OpenAI
                  </span>
                  <StatusBadge
                    status={snapshot?.openai.models.status}
                    label={
                      snapshot?.openai.connectivityValid
                        ? formatLatency(snapshot.openai.models.latencyMs)
                        : statusLabel(snapshot?.openai.models.status)
                    }
                  />
                </div>
              </div>

              <div className="gap-relacionado flex flex-wrap">
                <Button
                  onClick={handleForegroundTest}
                  disabled={foregroundTest.isPending}
                >
                  <Play className="h-4 w-4" />
                  Prueba rápida
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBackgroundTest}
                  disabled={backgroundTest.isPending}
                >
                  <TimerReset className="h-4 w-4" />
                  Segundo plano
                </Button>
                {snapshot?.openai.webhookUrl ? (
                  <Button asChild variant="secondary">
                    <a
                      href={snapshot.openai.webhookUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Webhooks
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="gap-relacionado flex items-start justify-between">
                <div className="space-y-relacionado">
                  <CardTitle className="gap-relacionado flex items-center">
                    <Webhook className="h-5 w-5" />
                    Webhooks
                  </CardTitle>
                  <CardDescription>
                    {snapshot?.webhooks.message ?? 'Esperando eventos...'}
                  </CardDescription>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Limpiar eventos recientes"
                      onClick={handleClearWebhookEvents}
                      disabled={
                        clearRecent.isPending ||
                        !snapshot?.webhooks.events.length
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Limpiar eventos recientes</TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent className="space-y-grupo">
              {snapshot?.webhooks.events.length ? (
                <WebhookEventsTable events={snapshot.webhooks.events} />
              ) : (
                <div className="text-muted-foreground p-grupo rounded-lg border text-sm">
                  Sin eventos recientes.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <div className="gap-relacionado flex items-start justify-between">
              <div className="space-y-relacionado">
                <CardTitle>Pruebas recientes</CardTitle>
                <CardDescription>
                  Ejecuciones inmediatas, en segundo plano y eventos asociados.
                </CardDescription>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Limpiar pruebas recientes"
                    onClick={handleClearTestRuns}
                    disabled={
                      clearRecent.isPending ||
                      !snapshot?.webhooks.testRuns.length
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Limpiar pruebas recientes</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            {snapshot?.webhooks.testRuns.length ? (
              <TestRunsTable runs={snapshot.webhooks.testRuns} />
            ) : (
              <div className="text-muted-foreground p-grupo rounded-lg border text-sm">
                Sin pruebas recientes.
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </main>
  )
}
