import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, Circle, Clock3, ShieldCheck, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'

import { TransicionEstadoDialog } from './TransicionEstadoDialog'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEstadosPlan } from '@/data/hooks/useMeta'
import { usePlan, usePlanRegistroOficial } from '@/data/hooks/usePlans'
import {
  useTransiciones,
  useTransicionesPermitidas,
} from '@/data/hooks/useWorkflow'
import { cn } from '@/lib/utils'

const ESTADOS_FUERA_DE_PIPELINE = new Set(['GENERANDO', 'FALLIDO'])

/**
 * Panel de sólo lectura del recorrido del plan. El cambio de etapa vive en
 * `TransicionEstadoDialog`, y los expertos y sedes en su propio panel del menú
 * contextual: aquí quedaba una columna lateral que competía con la línea de
 * etapas y una tarjeta que no tiene nada que ver con el flujo.
 */
export function PlanFlowPanel({ planId }: { planId: string }) {
  const { data: plan, isLoading: planLoading } = usePlan(planId)
  const { data: estados } = useEstadosPlan()
  const { data: permitidas } = useTransicionesPermitidas(planId)

  const [transicionAbierta, setTransicionAbierta] = useState(false)

  const estadoActual = plan?.estados_plan ?? null
  const estadoActualId = plan?.estado_actual_id ?? null
  const esPlanCurricular = plan?.estructuras_plan?.tipo === 'CURRICULAR'
  const estaAprobado = estadoActual?.clave === 'APROBADO'
  const { data: registroAprobado } = usePlanRegistroOficial(
    estaAprobado && esPlanCurricular ? planId : undefined,
  )
  const { data: todasTransiciones } = useTransiciones()

  const pipeline = useMemo(() => {
    if (!estados) return []
    const tipoPlan = plan?.estructuras_plan?.tipo ?? null
    const estadosReachable = new Set<string>()

    if (tipoPlan && todasTransiciones) {
      const relevant = todasTransiciones.filter(
        (t) => t.tipo_estructura === null || t.tipo_estructura === tipoPlan,
      )
      const adj = new Map<string, Set<string>>()
      for (const t of relevant) {
        const desde = t.desde?.id
        const hacia = t.hacia?.id
        if (!desde || !hacia) continue
        if (!adj.has(desde)) adj.set(desde, new Set())
        adj.get(desde)!.add(hacia)
      }

      const borradorId = estados.find((e) => e.clave === 'BORRADOR')?.id
      if (borradorId) {
        const queue = [borradorId]
        estadosReachable.add(borradorId)
        while (queue.length) {
          const curr = queue.shift()!
          for (const next of adj.get(curr) ?? []) {
            if (!estadosReachable.has(next)) {
              estadosReachable.add(next)
              queue.push(next)
            }
          }
        }
      }
    }

    if (estadoActualId) {
      estadosReachable.add(estadoActualId)
    }

    return estados
      .filter(
        (e) =>
          e.orden >= 1 &&
          e.clave !== 'RECHAZADO' &&
          !ESTADOS_FUERA_DE_PIPELINE.has(e.clave) &&
          estadosReachable.has(e.id),
      )
      .sort((a, b) => a.orden - b.orden)
  }, [estados, todasTransiciones, plan, estadoActualId])

  const estaRechazado = estadoActual?.clave === 'RECHAZADO'
  const ordenActual = estadoActual?.orden ?? -999
  const puedeTransicionar = (permitidas?.length ?? 0) > 0
  const etapaActualIndex = pipeline.findIndex(
    (estado) => estado.id === estadoActualId,
  )
  const progreso =
    etapaActualIndex >= 0 && pipeline.length > 0
      ? ((etapaActualIndex + 1) / pipeline.length) * 100
      : 0
  const etiquetaActual = estaRechazado
    ? 'Plan rechazado'
    : !esPlanCurricular && estaAprobado
      ? 'Aprobado por Vicerrectoría'
      : (estadoActual?.etiqueta ?? 'Flujo pendiente')

  if (planLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-border space-y-control px-seccion py-seccion shrink-0 border-b">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-4/5" />
          <Skeleton className="h-2 w-full" />
        </div>
        <div className="space-y-seccion px-seccion py-seccion min-h-0 flex-1 overflow-hidden">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="gap-control flex items-center">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="border-border px-seccion py-seccion shrink-0 border-b">
        <div className="gap-control flex items-start">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg',
              estaRechazado
                ? 'bg-destructive/10 text-destructive'
                : estaAprobado
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-primary/10 text-primary',
            )}
          >
            {estaRechazado ? (
              <XCircle className="size-5" />
            ) : estaAprobado ? (
              <ShieldCheck className="size-5" />
            ) : (
              <Clock3 className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="gap-control flex items-start justify-between">
              <h3
                className={cn(
                  'text-lg leading-snug font-semibold text-balance',
                  estaRechazado
                    ? 'text-destructive'
                    : estaAprobado
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-foreground',
                )}
              >
                {etiquetaActual}
              </h3>
              {!estaRechazado && etapaActualIndex >= 0 ? (
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  Etapa {etapaActualIndex + 1} de {pipeline.length}
                </span>
              ) : null}
            </div>
            {!estaRechazado && etapaActualIndex >= 0 ? (
              <div
                className="bg-muted mt-control h-1.5 overflow-hidden rounded-full"
                role="progressbar"
                aria-label="Progreso del flujo de aprobación"
                aria-valuemin={0}
                aria-valuemax={pipeline.length}
                aria-valuenow={etapaActualIndex + 1}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-300',
                    estaAprobado ? 'bg-emerald-500' : 'bg-primary',
                  )}
                  style={{ width: `${progreso}%` }}
                />
              </div>
            ) : (
              <p className="text-destructive/80 mt-relacionado text-xs font-medium">
                Proceso interrumpido
              </p>
            )}
          </div>
        </div>

        {estaAprobado && esPlanCurricular && registroAprobado ? (
          <dl className="border-border mt-seccion gap-x-seccion gap-y-control pt-grupo grid grid-cols-2 border-t">
            <div>
              <dt className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Clave SEP/RVOE
              </dt>
              <dd className="text-foreground mt-micro text-sm font-medium">
                {registroAprobado.clave_sep}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Dictamen
              </dt>
              <dd className="text-foreground mt-micro text-sm font-medium">
                {registroAprobado.numero_acuerdo}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Autoridad
              </dt>
              <dd className="text-foreground mt-micro text-sm font-medium">
                {registroAprobado.autoridad}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Aprobación
              </dt>
              <dd className="text-foreground mt-micro text-sm font-medium">
                {format(
                  parseISO(registroAprobado.fecha_aprobacion),
                  "d 'de' MMMM, yyyy",
                  { locale: es },
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Vigencia
              </dt>
              <dd className="text-foreground mt-micro text-sm font-medium">
                {format(
                  parseISO(registroAprobado.vigencia_inicio),
                  'd MMM yyyy',
                  { locale: es },
                )}
                {registroAprobado.vigencia_fin
                  ? ` – ${format(
                      parseISO(registroAprobado.vigencia_fin),
                      'd MMM yyyy',
                      { locale: es },
                    )}`
                  : ''}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className="px-seccion py-seccion min-h-0 flex-1 overflow-y-auto">
        {pipeline.length > 0 ? (
          <ol>
            {pipeline.map((estado, index) => {
              const completado = !estaRechazado && estado.orden < ordenActual
              const actual = estado.id === estadoActualId
              const esAprobadoFinal = actual && estaAprobado
              const esUltimo = index === pipeline.length - 1
              return (
                <li
                  key={estado.id}
                  className="gap-control pb-grupo flex last:pb-0"
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                        (completado || esAprobadoFinal) &&
                          'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                        actual &&
                          !esAprobadoFinal &&
                          'border-primary bg-primary/10 text-primary ring-primary/20 ring-2',
                        !completado &&
                          !actual &&
                          'border-border bg-muted/70 text-muted-foreground',
                      )}
                    >
                      {completado || esAprobadoFinal ? (
                        <Check className="size-3.5" strokeWidth={2.5} />
                      ) : actual ? (
                        <Clock3 className="size-3.5" />
                      ) : (
                        <Circle className="size-3" />
                      )}
                    </span>
                    {!esUltimo ? (
                      <span
                        className={cn(
                          'mt-micro w-px flex-1',
                          completado || esAprobadoFinal
                            ? 'bg-emerald-500/35'
                            : 'bg-border',
                        )}
                      />
                    ) : null}
                  </div>
                  <div className="pt-micro min-w-0 flex-1">
                    <div className="gap-control flex items-center justify-between">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          actual && !esAprobadoFinal
                            ? 'text-primary'
                            : esAprobadoFinal
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : completado
                                ? 'text-foreground'
                                : 'text-muted-foreground',
                        )}
                      >
                        {!esPlanCurricular && estado.clave === 'APROBADO'
                          ? 'Aprobado por Vicerrectoría'
                          : estado.etiqueta}
                      </p>
                      {actual && !esAprobadoFinal ? (
                        <span className="bg-primary/10 text-primary px-relacionado py-micro rounded-full text-[10px] font-semibold uppercase">
                          Actual
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="text-muted-foreground text-sm">
            Sin etapas configuradas
          </p>
        )}
      </section>

      {puedeTransicionar ? (
        <footer className="border-border bg-background px-seccion py-grupo shrink-0 border-t">
          <Button className="w-full" onClick={() => setTransicionAbierta(true)}>
            Cambiar etapa
          </Button>
        </footer>
      ) : null}

      <TransicionEstadoDialog
        planId={planId}
        open={transicionAbierta}
        onOpenChange={setTransicionAbierta}
      />
    </div>
  )
}
