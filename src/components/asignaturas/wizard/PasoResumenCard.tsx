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
import { usePlan, usePlanLineas, useSubjectEstructuras } from '@/data'
import { nuevaAsignaturaFormOpts } from '@/features/asignaturas/nueva/schema'
import { nombreTipoCiclo } from '@/lib/ciclo-utils'
import { formatCarreraNombre } from '@/lib/facultad-utils'
import { getPlanDisplayName } from '@/lib/plan-display'

export const PasoResumenCard = withForm({
  ...nuevaAsignaturaFormOpts,
  render: function Render({ form }) {
    const values = useStore(form.store, (s) => s.values)

    const { data: plan } = usePlan(values.plan_estudio_id)
    const { data: estructuras } = useSubjectEstructuras(
      plan?.estructura_id ?? null,
    )
    const { data: lineasPlan } = usePlanLineas(values.plan_estudio_id)

    const estructuraNombre = (() => {
      const estructuraId = values.datosBasicos.estructuraId
      if (!estructuraId) return '—'
      const hit = estructuras?.find((e) => e.id === estructuraId)
      return hit?.nombre ?? 'Estructura seleccionada'
    })()

    const modoLabel = (() => {
      if (values.tipoOrigen === 'MANUAL') return 'Manual (Vacía)'
      if (values.tipoOrigen === 'IA') return 'Generada con IA'
      if (values.tipoOrigen === 'IA_SIMPLE') return 'Generada con IA (Simple)'
      if (values.tipoOrigen === 'IA_MULTIPLE') return 'Generación múltiple (IA)'
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

    const archivosRef = values.iaConfig.archivosReferencia
    const coleccionesRef = values.iaConfig.coleccionesReferencia
    const adjuntos = values.iaConfig.archivosAdjuntos
    const totalReferencias =
      archivosRef.length + coleccionesRef.length + adjuntos.length

    const materiasSeleccionadas = values.sugerencias.filter((s) => s.selected)

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
                  values.tipoOrigen === 'IA_SIMPLE' ||
                  values.tipoOrigen === 'IA_MULTIPLE') && (
                  <Sparkles className="h-4 w-4" />
                )}
                {(values.tipoOrigen === 'CLONADO_INTERNO' ||
                  values.tipoOrigen === 'CLONADO_TRADICIONAL') && (
                  <Copy className="h-4 w-4" />
                )}
                {modoLabel}
              </span>
            </div>

            {values.tipoOrigen === 'IA_MULTIPLE' ? (
              <>
                <div className="border-border/60 bg-muted/30 grid gap-3 rounded-xl border p-4">
                  <div className="flex flex-col gap-1">
                    <div className="text-foreground text-base font-semibold">
                      Configuración
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Se crearán {materiasSeleccionadas.length} asignatura(s) a
                      partir de tus selecciones.
                    </div>
                  </div>

                  <div className="bg-background/40 border-border/60 rounded-lg border p-3">
                    <div className="text-muted-foreground text-xs">
                      Estructura
                    </div>

                    <div className="text-sm">
                      <span className="text-muted-foreground">Solicitud: </span>
                      <span className="font-medium">
                        {values.iaMultiple.enfoque ||
                          'Sin instrucciones adicionales'}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        Referencias:{' '}
                      </span>
                      <span className="font-medium">
                        {totalReferencias
                          ? `${totalReferencias} seleccionada${totalReferencias === 1 ? '' : 's'}`
                          : 'Sin referencias'}
                      </span>
                    </div>
                    <div className="text-foreground mt-1 text-sm font-medium">
                      {estructuraNombre}
                    </div>
                  </div>
                </div>

                <div className="border-border/60 bg-muted/30 grid gap-3 rounded-xl border p-4">
                  <div className="flex items-end justify-between gap-2">
                    <div className="text-foreground text-base font-semibold">
                      Materias seleccionadas
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {materiasSeleccionadas.length} en total
                    </div>
                  </div>

                  {materiasSeleccionadas.length === 0 ? (
                    <div className="text-muted-foreground text-sm">
                      No hay materias seleccionadas.
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {materiasSeleccionadas.map((m) => {
                        const lineaNombre = m.linea_plan_id
                          ? (lineasPlan?.find((l) => l.id === m.linea_plan_id)
                              ?.nombre ?? 'Línea seleccionada')
                          : '—'

                        const cicloText =
                          typeof m.numero_ciclo === 'number' &&
                          Number.isFinite(m.numero_ciclo)
                            ? String(m.numero_ciclo)
                            : '—'

                        return (
                          <div
                            key={m.id}
                            className="bg-background/40 border-border/60 grid gap-2 rounded-lg border p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-foreground text-sm font-semibold">
                                {m.nombre}
                              </div>
                              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                                <span className="bg-accent/30 text-accent-foreground rounded-full px-2 py-0.5">
                                  Línea: {lineaNombre}
                                </span>
                                <span className="bg-accent/30 text-accent-foreground rounded-full px-2 py-0.5">
                                  {nombreTipoCiclo(plan?.tipo_ciclo)}:{' '}
                                  {cicloText}
                                </span>
                              </div>
                            </div>

                            <div className="text-muted-foreground text-sm whitespace-pre-wrap">
                              {m.descripcion || '—'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
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
                    <span className="text-muted-foreground">Créditos: </span>
                    <span className="font-medium">{creditosText}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Estructura: </span>
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
                      <span className="text-muted-foreground">
                        Referencias:{' '}
                      </span>
                      <span className="font-medium">
                        {totalReferencias
                          ? `${totalReferencias} seleccionada${totalReferencias === 1 ? '' : 's'}`
                          : 'Sin referencias'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  },
})
