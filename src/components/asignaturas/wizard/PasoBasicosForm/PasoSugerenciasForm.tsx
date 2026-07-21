import { useStore } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { RefreshCw, X } from 'lucide-react'
import { useState } from 'react'

import { withForm } from '@/components/form'
import { AIRequestComposer } from '@/components/ia/AIRequestComposer'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { generate_subject_suggestions, usePlan } from '@/data'
import { AIProgressLoader } from '@/features/asignaturas/nueva/AIProgressLoader'
import {
  nuevaAsignaturaFormOpts,
  primerError,
  sugerenciasSeleccionadasSchema,
} from '@/features/asignaturas/nueva/schema'
import { getPlanDisplayName } from '@/lib/plan-display'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

const PasoSugerenciasForm = withForm({
  ...nuevaAsignaturaFormOpts,
  render: function Render({ form }) {
    const [showConservacionTooltip, setShowConservacionTooltip] =
      useState(false)

    const planEstudioId = useStore(form.store, (s) => s.values.plan_estudio_id)
    const sugerenciasCount = useStore(
      form.store,
      (s) => s.values.sugerencias.length,
    )
    const cantidadDeSugerencias = useStore(
      form.store,
      (s) => s.values.iaMultiple.cantidadDeSugerencias,
    )
    const iaConfig = useStore(form.store, (s) => s.values.iaConfig)
    const unresolvedUploads = useStore(
      form.store,
      (s) => s.values.archivosAdjuntosDedupePending,
    )

    const { data: plan } = usePlan(planEstudioId)

    // Estado de carga de la llamada de sugerencias: TanStack Query, no
    // un boolean copiado dentro de los valores del form.
    const generarSugerencias = useMutation({
      mutationFn: generate_subject_suggestions,
    })

    const onGenerarSugerencias = () => {
      if (generarSugerencias.isPending) return
      if (unresolvedUploads > 0) {
        notify.info(
          'Espera a que terminen o retira las referencias que no pudieron subirse.',
        )
        return
      }

      const values = form.state.values
      const hadNoSugerenciasBefore = values.sugerencias.length === 0
      const sugerenciasConservadas = values.sugerencias.filter(
        (s) => s.selected,
      )

      const cantidad = values.iaMultiple.cantidadDeSugerencias
      if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 15) {
        notify.error('La cantidad de sugerencias debe ser entre 1 y 15.')
        return
      }

      form.setFieldValue('sugerencias', sugerenciasConservadas)

      const enfoqueTrim = values.iaMultiple.enfoque.trim()

      generarSugerencias.mutate(
        {
          plan_estudio_id: values.plan_estudio_id,
          enfoque: enfoqueTrim ? enfoqueTrim : undefined,
          cantidad_de_sugerencias: cantidad,
          sugerencias_conservadas: sugerenciasConservadas.map((s) => ({
            nombre: s.nombre,
            descripcion: s.descripcion,
          })),
          references: {
            fileIds: values.iaConfig.archivosReferencia,
            collectionIds: values.iaConfig.coleccionesReferencia,
          },
          webSearchEnabled: values.iaConfig.webSearchEnabled,
          reasoning_effort: values.iaConfig.reasoningEffort,
        },
        {
          onSuccess: (nuevasSugerencias) => {
            if (hadNoSugerenciasBefore && nuevasSugerencias.length > 0) {
              setShowConservacionTooltip(true)
            }
            form.setFieldValue('sugerencias', [
              ...nuevasSugerencias,
              ...sugerenciasConservadas,
            ])
          },
          onError: (err) => {
            notify.error(
              err instanceof Error
                ? err.message
                : 'Error generando sugerencias.',
            )
          },
        },
      )
    }

    const isLoading = generarSugerencias.isPending

    return (
      <>
        <div className="mb-4 grid gap-3">
          <form.AppField name="iaMultiple.enfoque">
            {(field) => (
              <AIRequestComposer
                value={field.state.value}
                onChange={field.handleChange}
                reasoningEffort={iaConfig.reasoningEffort}
                onReasoningEffortChange={(reasoningEffort) =>
                  form.setFieldValue(
                    'iaConfig.reasoningEffort',
                    reasoningEffort,
                  )
                }
                selectedFileIds={iaConfig.archivosReferencia}
                onSelectedFileIdsChange={(archivosReferencia) => {
                  form.setFieldValue(
                    'iaConfig.archivosReferencia',
                    archivosReferencia,
                  )
                  form.setFieldValue('iaConfig.archivosAdjuntos', [])
                }}
                selectedCollectionIds={iaConfig.coleccionesReferencia}
                onSelectedCollectionIdsChange={(coleccionesReferencia) =>
                  form.setFieldValue(
                    'iaConfig.coleccionesReferencia',
                    coleccionesReferencia,
                  )
                }
                webSearchEnabled={iaConfig.webSearchEnabled}
                onWebSearchEnabledChange={(webSearchEnabled) =>
                  form.setFieldValue(
                    'iaConfig.webSearchEnabled',
                    webSearchEnabled,
                  )
                }
                onUnresolvedUploadsChange={(pendingCount) =>
                  form.setFieldValue(
                    'archivosAdjuntosDedupePending',
                    pendingCount,
                  )
                }
                placeholder="Describe las asignaturas que necesitas: área de conocimiento, enfoque, nivel, normativa, resultados esperados y cualquier restricción…"
              />
            )}
          </form.AppField>

          <div className="flex w-full flex-col items-end justify-between gap-3 sm:flex-row">
            <div className="w-full sm:w-44">
              <Label className="text-muted-foreground mb-1 block text-xs">
                Cantidad de sugerencias
              </Label>
              <form.AppField name="iaMultiple.cantidadDeSugerencias">
                {(field) => (
                  <Input
                    placeholder="Ej. 5"
                    value={field.state.value}
                    type="number"
                    min={1}
                    max={15}
                    step={1}
                    inputMode="numeric"
                    onBlur={field.handleBlur}
                    onKeyDown={(e) => {
                      if (['.', ',', '-', 'e', 'E', '+'].includes(e.key)) {
                        e.preventDefault()
                      }
                    }}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '') return
                      const asNumber = Number(raw)
                      if (!Number.isFinite(asNumber)) return
                      const n = Math.floor(Math.abs(asNumber))
                      const capped = Math.min(n >= 1 ? n : 1, 15)
                      field.handleChange(capped)
                    }}
                  />
                )}
              </form.AppField>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-9 gap-1.5"
              onClick={onGenerarSugerencias}
              disabled={isLoading || unresolvedUploads > 0}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {sugerenciasCount > 0
                ? 'Generar más sugerencias'
                : 'Generar sugerencias'}
            </Button>
          </div>
        </div>

        <form.AppField
          name="sugerencias"
          validators={{
            onChange: ({ value }) =>
              primerError(sugerenciasSeleccionadasSchema, value),
          }}
        >
          {(field) => {
            const sugerencias = field.state.value
            const seleccionadas = sugerencias.filter((s) => s.selected)
            const invalid =
              field.state.meta.isTouched && !field.state.meta.isValid

            const toggleAsignatura = (id: string, checked: boolean) => {
              field.handleChange(
                sugerencias.map((s) =>
                  s.id === id ? { ...s, selected: checked } : s,
                ),
              )
            }

            return (
              <>
                <AIProgressLoader
                  isLoading={isLoading}
                  cantidadDeSugerencias={cantidadDeSugerencias}
                />

                {/* --- HEADER LISTA --- */}
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-foreground text-base font-semibold">
                      Asignaturas sugeridas
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      Basadas en el plan{' '}
                      {plan ? getPlanDisplayName(plan) : '...'}
                    </p>
                  </div>
                  <Tooltip open={showConservacionTooltip}>
                    <TooltipTrigger asChild>
                      <div className="bg-muted text-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold">
                        <span aria-hidden>📌</span>
                        {seleccionadas.length} seleccionadas
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      sideOffset={8}
                      className="max-w-xs"
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex-1 text-sm">
                          Al generar más sugerencias, se conservarán las
                          asignaturas seleccionadas.
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => setShowConservacionTooltip(false)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {invalid ? (
                  <p className="text-destructive mb-2 text-sm" role="alert">
                    {typeof field.state.meta.errors[0] === 'string'
                      ? field.state.meta.errors[0]
                      : 'Selecciona al menos una sugerencia.'}
                  </p>
                ) : null}

                {/* --- LISTA DE ASIGNATURAS --- */}
                <div className="max-h-100 space-y-1 overflow-y-auto pr-1">
                  {sugerencias.map((asignatura) => {
                    const isSelected = asignatura.selected

                    return (
                      <Label
                        key={asignatura.id}
                        aria-checked={isSelected}
                        className={cn(
                          'border-border hover:border-primary/30 hover:bg-accent/50 m-0.5 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-aria-checked:border-blue-600 has-aria-checked:bg-blue-50 dark:has-aria-checked:border-blue-900 dark:has-aria-checked:bg-blue-950',
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleAsignatura(asignatura.id, !!checked)
                          }
                          className={cn(
                            'peer border-primary ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:ring-ring mt-0.5 h-5 w-5 shrink-0 border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                          )}
                        />

                        {/* Contenido de la tarjeta */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-foreground text-sm font-medium">
                              {asignatura.nombre}
                            </span>

                            {/* Badges de Tipo */}
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
                                asignatura.tipo === 'OBLIGATORIA'
                                  ? 'border-blue-200 bg-transparent text-blue-700 dark:border-blue-800 dark:text-blue-300'
                                  : 'border-yellow-200 bg-transparent text-yellow-700 dark:border-yellow-800 dark:text-yellow-300',
                              )}
                            >
                              {asignatura.tipo}
                            </span>

                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {asignatura.creditos} cred. ·{' '}
                              {asignatura.horasAcademicas}h acad. ·{' '}
                              {asignatura.horasIndependientes}h indep.
                            </span>
                          </div>

                          <p className="text-muted-foreground mt-1 text-sm">
                            {asignatura.descripcion}
                          </p>
                        </div>
                      </Label>
                    )
                  })}
                </div>
              </>
            )
          }}
        </form.AppField>
      </>
    )
  },
})

export default PasoSugerenciasForm
