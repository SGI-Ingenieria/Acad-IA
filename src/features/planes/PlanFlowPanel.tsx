import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CheckCircle2,
  Circle,
  Clock,
  FileCheck2,
  Loader2,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type { PlanRegistroOficialInput } from '@/data/api/plans.api'
import type { EstadoPlanRow } from '@/data/types/domain'

import { OfficialDocumentUpload } from '@/components/planes/OfficialDocumentUpload'
import { PlanExpertosCard } from '@/components/planes/PlanExpertosCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useEstadosPlan } from '@/data/hooks/useMeta'
import { usePermissions } from '@/data/hooks/usePermissions'
import {
  usePlan,
  usePlanRegistroOficial,
  useTransitionPlanEstado,
} from '@/data/hooks/usePlans'
import {
  useTransiciones,
  useTransicionesPermitidas,
} from '@/data/hooks/useWorkflow'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

const ESTADOS_FUERA_DE_PIPELINE = new Set(['GENERANDO', 'FALLIDO'])

type RegistroOficialForm = PlanRegistroOficialInput

function todayDateInput() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function PlanFlowPanel({ planId }: { planId: string }) {
  const { has } = usePermissions()

  const { data: plan, isLoading: planLoading } = usePlan(planId)
  const { data: estados } = useEstadosPlan()
  const { data: permitidas } = useTransicionesPermitidas(planId)

  const transition = useTransitionPlanEstado()

  const [destino, setDestino] = useState<string>('')
  const [comentarioTransicion, setComentarioTransicion] = useState('')
  const [registroOficial, setRegistroOficial] = useState<RegistroOficialForm>(
    () => ({
      claveSep: '',
      numeroAcuerdo: '',
      autoridad: 'SEP',
      fechaAprobacion: todayDateInput(),
      vigenciaInicio: '',
      vigenciaFin: '',
      documentoArchivoId: null,
      documentoBucket: 'documentos-oficiales',
      documentoPath: null,
      documentoNombre: null,
      documentoMime: null,
      documentoSize: null,
      documentoUrl: null,
      observaciones: '',
    }),
  )

  const estadoActual = plan?.estados_plan ?? null
  const estadoActualId = plan?.estado_actual_id ?? null
  const esPlanCurricular = plan?.estructuras_plan?.tipo === 'CURRICULAR'
  const estaAprobado = estadoActual?.clave === 'APROBADO'
  const { data: registroAprobado } = usePlanRegistroOficial(
    estaAprobado && esPlanCurricular ? planId : undefined,
  )
  const { data: todasTransiciones } = useTransiciones()

  const estadosById = useMemo(() => {
    const m = new Map<string, EstadoPlanRow>()
    for (const e of estados ?? []) m.set(e.id, e)
    return m
  }, [estados])

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

  const destinoEstado = destino ? estadosById.get(destino) : undefined
  const destinoEsAprobado =
    destinoEstado?.clave === 'APROBADO' && esPlanCurricular
  const requiereComentario =
    destinoEstado?.clave === 'BORRADOR' || destinoEstado?.clave === 'RECHAZADO'

  const registroOficialValido =
    registroOficial.claveSep.trim().length > 0 &&
    registroOficial.numeroAcuerdo.trim().length > 0 &&
    (registroOficial.autoridad?.trim().length ?? 0) > 0 &&
    registroOficial.fechaAprobacion.trim().length > 0 &&
    registroOficial.vigenciaInicio.trim().length > 0 &&
    Boolean(registroOficial.documentoArchivoId) &&
    Boolean(registroOficial.documentoPath?.trim()) &&
    (!registroOficial.vigenciaFin ||
      registroOficial.vigenciaFin >= registroOficial.vigenciaInicio)

  const updateRegistroOficial = (patch: Partial<RegistroOficialForm>): void => {
    setRegistroOficial((current) => ({ ...current, ...patch }))
  }

  const puedeTransicionar = (permitidas?.length ?? 0) > 0

  const handleTransicion = () => {
    if (!destino) return
    if (requiereComentario && comentarioTransicion.trim().length === 0) {
      notify.error(
        'Debes agregar un comentario al devolver o rechazar el plan.',
      )
      return
    }
    if (destinoEsAprobado && !registroOficialValido) {
      notify.error(
        'Completa clave SEP/RVOE, dictamen, vigencia y documento oficial.',
      )
      return
    }
    transition.mutate(
      {
        planId,
        haciaEstadoId: destino,
        comentario: comentarioTransicion.trim() || undefined,
        registroOficial: destinoEsAprobado
          ? {
              ...registroOficial,
              claveSep: registroOficial.claveSep.trim(),
              numeroAcuerdo: registroOficial.numeroAcuerdo.trim(),
              autoridad: registroOficial.autoridad?.trim() || 'SEP',
              vigenciaFin: registroOficial.vigenciaFin || null,
              documentoBucket:
                registroOficial.documentoBucket || 'documentos-oficiales',
              documentoPath: registroOficial.documentoPath?.trim() || null,
              documentoNombre: registroOficial.documentoNombre?.trim() || null,
              documentoMime: registroOficial.documentoMime?.trim() || null,
              documentoSize: registroOficial.documentoSize ?? null,
              documentoUrl: null,
              observaciones: registroOficial.observaciones?.trim() || null,
            }
          : undefined,
      },
      {
        onSuccess: () => {
          notify.success(
            `Plan movido a "${destinoEstado?.etiqueta ?? 'nuevo estado'}".`,
          )
          setDestino('')
          setComentarioTransicion('')
        },
      },
    )
  }

  if (planLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flujo de Aprobación</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona el proceso de revisión y aprobación del plan
          </p>
        </div>
        {estadoActual && (
          <Badge
            variant="secondary"
            style={
              estadoActual.color
                ? {
                    backgroundColor: `${estadoActual.color}22`,
                    color: estadoActual.color,
                  }
                : undefined
            }
          >
            {!esPlanCurricular && estadoActual.clave === 'APROBADO'
              ? 'Aprobado por Vicerrectoría'
              : estadoActual.etiqueta}
          </Badge>
        )}
      </div>

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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">Etapas del flujo</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <ol className="relative">
                {pipeline.map((estado, idx) => {
                  const completado =
                    !estaRechazado && estado.orden < ordenActual
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
            </CardContent>
          </Card>

          <PlanExpertosCard
            planId={planId}
            canManage={has('expertos.gestionar')}
          />
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Transición de Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="bg-muted/20 rounded-lg border p-3 text-center text-sm">
                <p className="text-muted-foreground text-xs">Estado actual</p>
                <p className="text-foreground font-bold">
                  {estadoActual?.etiqueta ?? '—'}
                </p>
              </div>

              {!puedeTransicionar ? (
                <p className="text-muted-foreground text-sm">
                  {estadoActual?.es_final
                    ? 'El plan está en un estado final; no hay más transiciones.'
                    : 'No hay transiciones disponibles para tu rol en esta etapa.'}
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Mover a</p>
                    <Select value={destino} onValueChange={setDestino}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el siguiente estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {(permitidas ?? []).map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.etiqueta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {destinoEsAprobado && (
                    <div className="bg-muted/20 space-y-3 rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="text-primary h-4 w-4" />
                        <p className="text-sm font-semibold">
                          Registro oficial SEP
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="clave-sep">Clave SEP/RVOE</Label>
                          <Input
                            id="clave-sep"
                            value={registroOficial.claveSep}
                            onChange={(event) =>
                              updateRegistroOficial({
                                claveSep: event.target.value,
                              })
                            }
                            placeholder="Ej. 20261234"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="numero-acuerdo">
                            Dictamen o acuerdo
                          </Label>
                          <Input
                            id="numero-acuerdo"
                            value={registroOficial.numeroAcuerdo}
                            onChange={(event) =>
                              updateRegistroOficial({
                                numeroAcuerdo: event.target.value,
                              })
                            }
                            placeholder="Folio del documento"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="autoridad">Autoridad</Label>
                          <Input
                            id="autoridad"
                            value={registroOficial.autoridad ?? ''}
                            onChange={(event) =>
                              updateRegistroOficial({
                                autoridad: event.target.value,
                              })
                            }
                            placeholder="SEP"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                          <div className="space-y-1.5">
                            <Label htmlFor="fecha-aprobacion">Aprobación</Label>
                            <DatePicker
                              id="fecha-aprobacion"
                              value={registroOficial.fechaAprobacion}
                              onChange={(value) =>
                                updateRegistroOficial({
                                  fechaAprobacion: value,
                                })
                              }
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="vigencia-inicio">
                              Inicio vigencia
                            </Label>
                            <DatePicker
                              id="vigencia-inicio"
                              value={registroOficial.vigenciaInicio}
                              onChange={(value) =>
                                updateRegistroOficial({
                                  vigenciaInicio: value,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="vigencia-fin">Fin vigencia</Label>
                          <DatePicker
                            id="vigencia-fin"
                            value={registroOficial.vigenciaFin ?? ''}
                            onChange={(value) =>
                              updateRegistroOficial({
                                vigenciaFin: value || null,
                              })
                            }
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Documento oficial</Label>
                          <OfficialDocumentUpload
                            planId={planId}
                            compact
                            value={registroOficial}
                            onChange={updateRegistroOficial}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="registro-observaciones">
                            Observaciones
                          </Label>
                          <Textarea
                            id="registro-observaciones"
                            value={registroOficial.observaciones ?? ''}
                            onChange={(event) =>
                              updateRegistroOficial({
                                observaciones: event.target.value,
                              })
                            }
                            className="min-h-20"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Comentario{' '}
                      {requiereComentario && (
                        <span className="text-destructive">*</span>
                      )}
                    </p>
                    <Textarea
                      value={comentarioTransicion}
                      onChange={(e) => setComentarioTransicion(e.target.value)}
                      placeholder={
                        requiereComentario
                          ? 'Explica el motivo de la devolución o rechazo…'
                          : 'Agrega un comentario (opcional)…'
                      }
                      className="min-h-24"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleTransicion}
                    disabled={
                      !destino ||
                      transition.isPending ||
                      (destinoEsAprobado && !registroOficialValido) ||
                      (requiereComentario &&
                        comentarioTransicion.trim().length === 0)
                    }
                  >
                    {transition.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {destinoEstado
                      ? `Mover a "${destinoEstado.etiqueta}"`
                      : 'Aplicar transición'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
