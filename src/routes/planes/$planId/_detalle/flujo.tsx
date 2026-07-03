import { createFileRoute } from '@tanstack/react-router'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CheckCircle2,
  Circle,
  Clock,
  FileCheck2,
  Loader2,
  MessageSquare,
  Send,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type { PlanRegistroOficialInput } from '@/data/api/plans.api'
import type { ComentarioPlan, EstadoPlanRow } from '@/data/types/domain'

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
import { usePlanCapabilities } from '@/data/auth/planCapabilities'
import { useEstadosPlan } from '@/data/hooks/useMeta'
import { usePermissions } from '@/data/hooks/usePermissions'
import { usePlan, useTransitionPlanEstado } from '@/data/hooks/usePlans'
import {
  useComentariosPlan,
  useCrearComentarioPlan,
  useTransicionesPermitidas,
} from '@/data/hooks/useWorkflow'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/planes/$planId/_detalle/flujo')({
  component: RouteComponent,
})

// Estados que NO forman parte del pipeline lineal visible (generación IA y el
// off-ramp de rechazo, que solo se muestra cuando el plan está rechazado).
const ESTADOS_FUERA_DE_PIPELINE = new Set(['GENERANDO', 'FALLIDO'])

const categoriaLabel: Record<string, string> = {
  INTERNO: 'Interno',
  EXPERTO: 'Experto',
  SEDE: 'Sede',
}

type RegistroOficialForm = PlanRegistroOficialInput

function todayDateInput() {
  return format(new Date(), 'yyyy-MM-dd')
}

function RouteComponent() {
  const { planId } = Route.useParams()
  const { has } = usePermissions()

  const { data: plan, isLoading: planLoading } = usePlan(planId)
  const { data: estados } = useEstadosPlan()
  const { data: permitidas } = useTransicionesPermitidas(planId)
  const { data: comentarios } = useComentariosPlan(planId)

  const transition = useTransitionPlanEstado()
  const crearComentario = useCrearComentarioPlan()

  const [destino, setDestino] = useState<string>('')
  const [comentarioTransicion, setComentarioTransicion] = useState('')
  const [comentarioFase, setComentarioFase] = useState('')
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
  const capabilities = usePlanCapabilities(plan)

  const estadosById = useMemo(() => {
    const m = new Map<string, EstadoPlanRow>()
    for (const e of estados ?? []) m.set(e.id, e)
    return m
  }, [estados])

  // Pipeline lineal: estados con orden >= 1, sin RECHAZADO (off-ramp) ni IA.
  const pipeline = useMemo(() => {
    return (estados ?? [])
      .filter(
        (e) =>
          e.orden >= 1 &&
          e.clave !== 'RECHAZADO' &&
          !ESTADOS_FUERA_DE_PIPELINE.has(e.clave),
      )
      .sort((a, b) => a.orden - b.orden)
  }, [estados])

  const estaRechazado = estadoActual?.clave === 'RECHAZADO'
  const ordenActual = estadoActual?.orden ?? -999

  const destinoEstado = destino ? estadosById.get(destino) : undefined
  const destinoEsAprobado = destinoEstado?.clave === 'APROBADO'
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
  const puedeComentar = capabilities.canComment
  // Un evaluador externo (solo comentarios.externos.crear) deja su dictamen como
  // EXPERTO; el resto comenta como INTERNO.
  const categoriaComentario =
    !has('comentarios.crear') && has('comentarios.externos.crear')
      ? 'EXPERTO'
      : 'INTERNO'

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

  const handleComentarioFase = () => {
    if (comentarioFase.trim().length === 0) return
    crearComentario.mutate(
      {
        planId,
        cuerpo: comentarioFase,
        estadoId: estadoActualId,
        categoria: categoriaComentario,
      },
      { onSuccess: () => setComentarioFase('') },
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
            {estadoActual.etiqueta}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Timeline + comentarios */}
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
                  const esUltimo = idx === pipeline.length - 1
                  return (
                    <li key={estado.id} className="flex gap-4 pb-5 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors',
                            completado &&
                              'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-400',
                            actual &&
                              'border-primary/40 bg-primary/10 text-primary ring-primary/30 ring-offset-background ring-2 ring-offset-2',
                            !completado &&
                              !actual &&
                              'border-border bg-muted text-muted-foreground',
                          )}
                        >
                          {completado ? (
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
                              completado
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
                            actual && 'text-primary',
                          )}
                        >
                          {estado.etiqueta}
                        </p>
                        {actual && (
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

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-4 w-4" /> Comentarios por fase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ComentariosLista
                comentarios={comentarios ?? []}
                estadosById={estadosById}
              />

              {puedeComentar && (
                <div className="space-y-2 border-t pt-4">
                  <Textarea
                    value={comentarioFase}
                    onChange={(e) => setComentarioFase(e.target.value)}
                    placeholder="Agrega una observación a la fase actual…"
                    className="min-h-20"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleComentarioFase}
                      disabled={
                        crearComentario.isPending ||
                        comentarioFase.trim().length === 0
                      }
                    >
                      {crearComentario.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Comentar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <PlanExpertosCard
            planId={planId}
            canManage={has('expertos.gestionar')}
          />
        </div>

        {/* Panel de transición */}
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

function ComentariosLista({
  comentarios,
  estadosById,
}: {
  comentarios: Array<ComentarioPlan>
  estadosById: Map<string, EstadoPlanRow>
}) {
  if (comentarios.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        Aún no hay comentarios en este plan.
      </p>
    )
  }
  return (
    <ul className="space-y-3">
      {comentarios.map((c) => {
        const fase = c.estado_id ? estadosById.get(c.estado_id) : null
        return (
          <li key={c.id} className="rounded-lg border p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                {c.autor?.nombre_completo ?? 'Usuario'}
              </span>
              {c.categoria !== 'INTERNO' && (
                <Badge variant="outline" className="text-[10px]">
                  {categoriaLabel[c.categoria] ?? c.categoria}
                </Badge>
              )}
              {fase && (
                <Badge variant="secondary" className="text-[10px]">
                  {fase.etiqueta}
                </Badge>
              )}
              <span className="text-muted-foreground ml-auto text-xs">
                {formatDistanceToNow(parseISO(c.creado_en), {
                  addSuffix: true,
                  locale: es,
                })}
              </span>
            </div>
            <p className="text-foreground text-sm whitespace-pre-wrap">
              {c.cuerpo}
            </p>
            <p className="text-muted-foreground/70 mt-1 text-[11px]">
              {format(parseISO(c.creado_en), "d 'de' MMMM, HH:mm", {
                locale: es,
              })}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
