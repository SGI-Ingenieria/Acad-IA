import { Copy, Pencil, Sparkles } from 'lucide-react'

import type { NewSubjectWizardState } from '@/features/asignaturas/nueva/types'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { usePlan, usePlanLineas, useSubjectEstructuras } from '@/data'
import { formatFileSize } from '@/features/planes/utils/format-file-size'
import { nombreTipoCiclo } from '@/lib/ciclo-utils'

export function PasoResumenCard({ wizard }: { wizard: NewSubjectWizardState }) {
  const { data: plan } = usePlan(wizard.plan_estudio_id)
  const { data: estructuras } = useSubjectEstructuras()
  const { data: lineasPlan } = usePlanLineas(wizard.plan_estudio_id)

  const estructuraNombre = (() => {
    const estructuraId = wizard.datosBasicos.estructuraId
    if (!estructuraId) return '—'
    const hit = estructuras?.find((e) => e.id === estructuraId)
    return hit?.nombre ?? estructuraId
  })()

  const modoLabel = (() => {
    if (wizard.tipoOrigen === 'MANUAL') return 'Manual (Vacía)'
    if (wizard.tipoOrigen === 'IA') return 'Generada con IA'
    if (wizard.tipoOrigen === 'IA_SIMPLE') return 'Generada con IA (Simple)'
    if (wizard.tipoOrigen === 'IA_MULTIPLE') return 'Generación múltiple (IA)'
    if (wizard.tipoOrigen === 'CLONADO_INTERNO') return 'Clonada (Sistema)'
    if (wizard.tipoOrigen === 'CLONADO_TRADICIONAL') return 'Clonada (Archivo)'
    return '—'
  })()

  const creditosText =
    typeof wizard.datosBasicos.creditos === 'number' &&
    Number.isFinite(wizard.datosBasicos.creditos)
      ? wizard.datosBasicos.creditos.toFixed(2)
      : '—'

  const archivosRef = wizard.iaConfig?.archivosReferencia ?? []
  const repositoriosRef = wizard.iaConfig?.repositoriosReferencia ?? []
  const adjuntos = wizard.iaConfig?.archivosAdjuntos ?? []

  const materiasSeleccionadas = wizard.sugerencias.filter((s) => s.selected)

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
              <span className="text-muted-foreground">Plan de estudios: </span>
              <span className="font-medium">
                {plan?.nombre || wizard.plan_estudio_id || '—'}
              </span>
            </div>
            {plan?.carreras?.nombre ? (
              <div>
                <span className="text-muted-foreground">Carrera: </span>
                <span className="font-medium">{plan.carreras.nombre}</span>
              </div>
            ) : null}
          </div>

          <div className="bg-muted rounded-md p-3">
            <span className="text-muted-foreground">Tipo de origen: </span>
            <span className="inline-flex items-center gap-2 font-medium">
              {wizard.tipoOrigen === 'MANUAL' && <Pencil className="h-4 w-4" />}
              {(wizard.tipoOrigen === 'IA' ||
                wizard.tipoOrigen === 'IA_SIMPLE' ||
                wizard.tipoOrigen === 'IA_MULTIPLE') && (
                <Sparkles className="h-4 w-4" />
              )}
              {(wizard.tipoOrigen === 'CLONADO_INTERNO' ||
                wizard.tipoOrigen === 'CLONADO_TRADICIONAL') && (
                <Copy className="h-4 w-4" />
              )}
              {modoLabel}
            </span>
          </div>

          {wizard.tipoOrigen === 'IA_MULTIPLE' ? (
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
                            ?.nombre ?? m.linea_plan_id)
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
                                {nombreTipoCiclo(plan?.tipo_ciclo)}: {cicloText}
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
                    {wizard.datosBasicos.nombre || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Código: </span>
                  <span className="font-medium">
                    {wizard.datosBasicos.codigo || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo: </span>
                  <span className="font-medium">
                    {wizard.datosBasicos.tipo || '—'}
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
                    {wizard.datosBasicos.horasAcademicas ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Horas independientes:{' '}
                  </span>
                  <span className="font-medium">
                    {wizard.datosBasicos.horasIndependientes ?? '—'}
                  </span>
                </div>
              </div>

              <div className="bg-muted/50 rounded-md p-3">
                <div className="font-medium">Configuración IA</div>
                <div className="mt-2 grid gap-2">
                  <div>
                    <span className="text-muted-foreground">
                      Enfoque académico:{' '}
                    </span>
                    <span className="font-medium">
                      {wizard.iaConfig?.descripcionEnfoqueAcademico || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Instrucciones adicionales:{' '}
                    </span>
                    <span className="font-medium">
                      {wizard.iaConfig?.instruccionesAdicionalesIA || '—'}
                    </span>
                  </div>

                  <div className="mt-2">
                    <div className="font-medium">Archivos de referencia</div>
                    {archivosRef.length ? (
                      <ul className="text-muted-foreground list-disc pl-5 text-xs">
                        {archivosRef.map((id) => (
                          <li key={id}>{id}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-muted-foreground text-xs">—</div>
                    )}
                  </div>

                  <div>
                    <div className="font-medium">
                      Repositorios de referencia
                    </div>
                    {repositoriosRef.length ? (
                      <ul className="text-muted-foreground list-disc pl-5 text-xs">
                        {repositoriosRef.map((id) => (
                          <li key={id}>{id}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-muted-foreground text-xs">—</div>
                    )}
                  </div>

                  <div>
                    <div className="font-medium">Archivos adjuntos</div>
                    {adjuntos.length ? (
                      <ul className="text-muted-foreground list-disc pl-5 text-xs">
                        {adjuntos.map((f) => (
                          <li key={f.id}>
                            <span className="text-foreground">
                              {f.file.name}
                            </span>{' '}
                            <span>· {formatFileSize(f.file.size)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-muted-foreground text-xs">—</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
