import { useStore } from '@tanstack/react-form'
import { Copy, Pencil, Sparkles } from 'lucide-react'

import { withForm } from '@/components/form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { usePlan, usePlanLineas, useSubjectEstructuraDelPlan } from '@/data'
import { nuevaAsignaturaFormOpts } from '@/features/asignaturas/nueva/schema'
import { formatCarreraNombre } from '@/lib/facultad-utils'
import { getPlanDisplayName } from '@/lib/plan-display'

export const PasoResumenCard = withForm({
  ...nuevaAsignaturaFormOpts,
  render: function Render({ form }) {
    const values = useStore(form.store, (s) => s.values)

    const { data: plan } = usePlan(values.plan_estudio_id)
    const { data: lineas = [] } = usePlanLineas(values.plan_estudio_id)
    // La plantilla de asignatura no se elige: es la única que el plan tiene
    // asignada (relación 1:1 con la plantilla del plan).
    const { estructura } = useSubjectEstructuraDelPlan(plan?.estructura_id)
    const estructuraNombre = estructura?.nombre ?? '—'

    const modoLabel = (() => {
      if (values.tipoOrigen === 'MANUAL') return 'Manual (Vacía)'
      if (values.tipoOrigen === 'IA') return 'Generada con IA'
      if (values.tipoOrigen === 'IA_SIMPLE') return 'Generada con IA (Simple)'
      if (values.tipoOrigen === 'CLONADO_INTERNO') return 'Clonada (Sistema)'
      if (values.tipoOrigen === 'CLONADO_TRADICIONAL') {
        return 'Clonada (Archivo)'
      }
      return '—'
    })()

    const creditosText =
      typeof values.datosBasicos.creditos === 'number' &&
      Number.isFinite(values.datosBasicos.creditos)
        ? values.datosBasicos.creditos.toFixed(2)
        : '—'
    const lineaNombre =
      lineas.find((linea) => linea.id === values.datosBasicos.lineaPlanId)
        ?.nombre ?? 'Sin asignar'

    const archivosRef = values.iaConfig.archivosReferencia
    const coleccionesRef = values.iaConfig.coleccionesReferencia
    const adjuntos = values.iaConfig.archivosAdjuntos
    const totalReferencias =
      archivosRef.length + coleccionesRef.length + adjuntos.length

    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumen de creación</CardTitle>
          <CardDescription>
            Verifica los datos antes de crear la asignatura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm">
            <div className="grid gap-2">
              <div>
                <span className="text-muted-foreground">
                  Plan de estudios:{' '}
                </span>
                <span className="font-medium">
                  {plan ? getPlanDisplayName(plan) : 'Plan seleccionado'}
                </span>
              </div>
              {plan?.carreras?.nombre ? (
                <div>
                  <span className="text-muted-foreground">Carrera: </span>
                  <span className="font-medium">
                    {formatCarreraNombre(plan.carreras)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="bg-muted rounded-md p-3">
              <span className="text-muted-foreground">Tipo de origen: </span>
              <span className="inline-flex items-center gap-2 font-medium">
                {values.tipoOrigen === 'MANUAL' && (
                  <Pencil className="h-4 w-4" />
                )}
                {(values.tipoOrigen === 'IA' ||
                  values.tipoOrigen === 'IA_SIMPLE') && (
                  <Sparkles className="h-4 w-4" />
                )}
                {(values.tipoOrigen === 'CLONADO_INTERNO' ||
                  values.tipoOrigen === 'CLONADO_TRADICIONAL') && (
                  <Copy className="h-4 w-4" />
                )}
                {modoLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <span className="text-muted-foreground">Nombre: </span>
                <span className="font-medium">
                  {values.datosBasicos.nombre || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Código: </span>
                <span className="font-medium">
                  {values.datosBasicos.codigo || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo: </span>
                <span className="font-medium">
                  {values.datosBasicos.tipo || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {plan?.tipo_ciclo || 'Ciclo'}:{' '}
                </span>
                <span className="font-medium">
                  {values.datosBasicos.numeroCiclo ?? 'Sin asignar'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Línea curricular:{' '}
                </span>
                <span className="font-medium">{lineaNombre}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Créditos: </span>
                <span className="font-medium">{creditosText}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Plantilla: </span>
                <span className="font-medium">{estructuraNombre}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Horas académicas:{' '}
                </span>
                <span className="font-medium">
                  {values.datosBasicos.horasAcademicas ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Horas independientes:{' '}
                </span>
                <span className="font-medium">
                  {values.datosBasicos.horasIndependientes ?? '—'}
                </span>
              </div>
            </div>

            <div className="bg-muted/50 rounded-md p-3">
              <div className="font-medium">Solicitud a la IA</div>
              <div className="mt-2 grid gap-2">
                <div>
                  <span className="text-muted-foreground">Solicitud: </span>
                  <span className="font-medium">
                    {values.iaConfig.descripcionEnfoqueAcademico || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Referencias: </span>
                  <span className="font-medium">
                    {totalReferencias
                      ? `${totalReferencias} seleccionada${totalReferencias === 1 ? '' : 's'}`
                      : 'Sin referencias'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  },
})
