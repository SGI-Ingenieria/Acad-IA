import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, Circle, Clock, Loader2, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'

import { TransicionEstadoDialog } from './TransicionEstadoDialog'

import { Button } from '@/components/ui/button'
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

  if (planLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {estaAprobado && esPlanCurricular && registroAprobado && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/40 p-5 dark:bg-emerald-950/20">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                Plan aprobado por {registroAprobado.autoridad}
              </p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-500/60">
                El proceso de aprobación ha concluido exitosamente.
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Clave SEP/RVOE
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {registroAprobado.clave_sep}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Dictamen / Acuerdo
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {registroAprobado.numero_acuerdo}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Autoridad
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {registroAprobado.autoridad}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Fecha de aprobación
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {format(
                  parseISO(registroAprobado.fecha_aprobacion),
                  "d 'de' MMMM, yyyy",
                  { locale: es },
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Vigencia inicio
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {format(
                  parseISO(registroAprobado.vigencia_inicio),
                  "d 'de' MMMM, yyyy",
                  { locale: es },
                )}
              </dd>
            </div>
            {registroAprobado.vigencia_fin && (
              <div>
                <dt className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Vigencia fin
                </dt>
                <dd className="mt-0.5 text-sm font-semibold">
                  {format(
                    parseISO(registroAprobado.vigencia_fin),
                    "d 'de' MMMM, yyyy",
                    { locale: es },
                  )}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {estaAprobado && !esPlanCurricular && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/40 p-5 dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                Plan aprobado por Vicerrectoría
              </p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-500/60">
                El proceso de autorización no curricular ha concluido
                exitosamente.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="border-border border-b pb-6">
        <div>
          <ol className="relative">
            {pipeline.map((estado, idx) => {
              const completado = !estaRechazado && estado.orden < ordenActual
              const actual = estado.id === estadoActualId
              const esAprobadoFinal = actual && estaAprobado
              const esUltimo = idx === pipeline.length - 1
              return (
                <li key={estado.id} className="flex gap-4 pb-5 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors',
                        (completado || esAprobadoFinal) &&
                          'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-400',
                        actual &&
                          !esAprobadoFinal &&
                          'border-primary/40 bg-primary/10 text-primary ring-primary/30 ring-offset-background ring-2 ring-offset-2',
                        !completado &&
                          !actual &&
                          'border-border bg-muted text-muted-foreground',
                      )}
                    >
                      {completado || esAprobadoFinal ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : actual ? (
                        <Clock className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </span>
                    {!esUltimo && (
                      <span
                        className={cn(
                          'mt-1 w-0.5 flex-1 rounded-full transition-colors',
                          completado || esAprobadoFinal
                            ? 'bg-emerald-500/30 dark:bg-emerald-400/30'
                            : 'bg-border',
                        )}
                      />
                    )}
                  </div>
                  <div className={cn('pt-1', !actual && 'opacity-80')}>
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        actual && !esAprobadoFinal && 'text-primary',
                        esAprobadoFinal &&
                          'text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      {!esPlanCurricular && estado.clave === 'APROBADO'
                        ? 'Aprobado por Vicerrectoría'
                        : estado.etiqueta}
                    </p>
                    {actual && !esAprobadoFinal && (
                      <p className="text-muted-foreground text-xs">
                        Etapa actual
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>

          {estaRechazado && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3 text-sm">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="font-medium text-red-700">
                Este plan fue rechazado.
              </span>
            </div>
          )}
        </div>

        {puedeTransicionar && (
          <Button className="mt-5" onClick={() => setTransicionAbierta(true)}>
            Cambiar etapa
          </Button>
        )}
      </section>

      <TransicionEstadoDialog
        planId={planId}
        open={transicionAbierta}
        onOpenChange={setTransicionAbierta}
      />
    </div>
  )
}
