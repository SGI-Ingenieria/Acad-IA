import { format } from 'date-fns'
import { FileCheck2, Loader2 } from 'lucide-react'
import { useState } from 'react'

import type { PlanRegistroOficialInput } from '@/data/api/plans.api'

import { OfficialDocumentUpload } from '@/components/planes/OfficialDocumentUpload'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { usePlan, useTransitionPlanEstado } from '@/data/hooks/usePlans'
import { useTransicionesPermitidas } from '@/data/hooks/useWorkflow'
import { notify } from '@/lib/toast'

/**
 * Mover el plan de etapa es *el* acto del panel de flujo, pero vivía como una
 * columna permanente junto a la línea de etapas: siempre presente, casi nunca
 * accionable —la mayoría de los usuarios no tiene transiciones permitidas— y
 * con el formulario de registro oficial SEP creciendo dentro de una barra
 * lateral estrecha.
 *
 * Aquí es un diálogo: la línea de etapas queda como lectura y el cambio de
 * etapa se pide explícitamente, desde el propio panel o desde el menú
 * contextual, sin pasar por el panel.
 */
export function TransicionEstadoDialog({
  planId,
  open,
  onOpenChange,
}: {
  planId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: plan } = usePlan(planId)
  const { data: estados } = useEstadosPlan()
  const { data: permitidas } = useTransicionesPermitidas(planId)
  const transition = useTransitionPlanEstado()

  const [destino, setDestino] = useState<string>('')
  const [comentario, setComentario] = useState('')
  const [registroOficial, setRegistroOficial] =
    useState<PlanRegistroOficialInput>(() => registroOficialVacio())

  const estadoActual = plan?.estados_plan ?? null
  const esPlanCurricular = plan?.estructuras_plan?.tipo === 'CURRICULAR'
  const destinoEstado = estados?.find((estado) => estado.id === destino)
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

  const updateRegistroOficial = (
    patch: Partial<PlanRegistroOficialInput>,
  ): void => {
    setRegistroOficial((current) => ({ ...current, ...patch }))
  }

  const puedeTransicionar = (permitidas?.length ?? 0) > 0

  const handleTransicion = () => {
    if (!destino) return
    if (requiereComentario && comentario.trim().length === 0) {
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
        comentario: comentario.trim() || undefined,
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
          setComentario('')
          setRegistroOficial(registroOficialVacio())
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* El registro oficial SEP son ocho campos: sin este ensanchamiento el
          diálogo se vuelve una columna de scroll interminable. */}
      <DialogContent
        className={destinoEsAprobado ? 'sm:max-w-2xl' : undefined}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Cambiar etapa del plan</DialogTitle>
          <DialogDescription>
            Etapa actual:{' '}
            <span className="text-foreground font-medium">
              {estadoActual?.etiqueta ?? '—'}
            </span>
          </DialogDescription>
        </DialogHeader>

        {!puedeTransicionar ? (
          <p className="text-muted-foreground text-sm">
            {estadoActual?.es_final
              ? 'El plan está en una etapa final: no hay más transiciones.'
              : 'No hay transiciones disponibles para tu rol en esta etapa.'}
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-1">
            <div className="space-y-2">
              <p className="text-sm font-medium">Mover a</p>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona la siguiente etapa" />
                </SelectTrigger>
                <SelectContent>
                  {(permitidas ?? []).map((estado) => (
                    <SelectItem key={estado.id} value={estado.id}>
                      {estado.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {destinoEsAprobado && (
              <div className="border-border space-y-3 border-y py-4">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="text-primary h-4 w-4" />
                  <p className="text-sm font-semibold">Registro oficial SEP</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="clave-sep">Clave SEP/RVOE</Label>
                    <Input
                      id="clave-sep"
                      value={registroOficial.claveSep}
                      onChange={(event) =>
                        updateRegistroOficial({ claveSep: event.target.value })
                      }
                      placeholder="Ej. 20261234"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="numero-acuerdo">Dictamen o acuerdo</Label>
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
                        updateRegistroOficial({ autoridad: event.target.value })
                      }
                      placeholder="SEP"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fecha-aprobacion">Aprobación</Label>
                    <DatePicker
                      id="fecha-aprobacion"
                      value={registroOficial.fechaAprobacion}
                      onChange={(value) =>
                        updateRegistroOficial({ fechaAprobacion: value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="vigencia-inicio">Inicio vigencia</Label>
                    <DatePicker
                      id="vigencia-inicio"
                      value={registroOficial.vigenciaInicio}
                      onChange={(value) =>
                        updateRegistroOficial({ vigenciaInicio: value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="vigencia-fin">Fin vigencia</Label>
                    <DatePicker
                      id="vigencia-fin"
                      value={registroOficial.vigenciaFin ?? ''}
                      onChange={(value) =>
                        updateRegistroOficial({ vigenciaFin: value || null })
                      }
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Documento oficial</Label>
                    <OfficialDocumentUpload
                      planId={planId}
                      compact
                      value={registroOficial}
                      onChange={updateRegistroOficial}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
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
              <Label htmlFor="comentario-transicion">
                Comentario{' '}
                {requiereComentario && (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Textarea
                id="comentario-transicion"
                value={comentario}
                onChange={(event) => setComentario(event.target.value)}
                placeholder={
                  requiereComentario
                    ? 'Explica el motivo de la devolución o rechazo…'
                    : 'Agrega un comentario (opcional)…'
                }
                className="min-h-24"
              />
            </div>
          </div>
        )}

        {puedeTransicionar && (
          <DialogFooter>
            <Button
              onClick={handleTransicion}
              disabled={
                !destino ||
                transition.isPending ||
                (destinoEsAprobado && !registroOficialValido) ||
                (requiereComentario && comentario.trim().length === 0)
              }
            >
              {transition.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {destinoEstado
                ? `Mover a "${destinoEstado.etiqueta}"`
                : 'Aplicar transición'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function registroOficialVacio(): PlanRegistroOficialInput {
  return {
    claveSep: '',
    numeroAcuerdo: '',
    autoridad: 'SEP',
    fechaAprobacion: format(new Date(), 'yyyy-MM-dd'),
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
  }
}
