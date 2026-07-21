import { useStore } from '@tanstack/react-form'

import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import type { NuevaAsignaturaFormValues } from '@/features/asignaturas/nueva/types'
import type { AnyFieldMeta } from '@tanstack/react-form'

import { withForm } from '@/components/form'
import { AIRequestComposer } from '@/components/ia/AIRequestComposer'
import { FileDropzone } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { usePlan, usePlanLineas, useSubjectEstructuras } from '@/data'
import {
  archivosClonadoSchema,
  enfoqueAcademicoSchema,
  estructuraSchema,
  nuevaAsignaturaFormOpts,
  primerError,
} from '@/features/asignaturas/nueva/schema'
import { nombreTipoCiclo } from '@/lib/ciclo-utils'

const fieldInvalid = (meta: AnyFieldMeta): boolean =>
  meta.isTouched && !meta.isValid

function FieldErrorText({ meta, id }: { meta: AnyFieldMeta; id: string }) {
  if (!fieldInvalid(meta)) return null
  const message = meta.errors
    .map((e: unknown) =>
      typeof e === 'string' ? e : ((e as { message?: string }).message ?? ''),
    )
    .filter(Boolean)
    .join(', ')
  return (
    <p id={id} className="text-destructive text-sm">
      {message}
    </p>
  )
}

export const PasoDetallesPanel = withForm({
  ...nuevaAsignaturaFormOpts,
  render: function Render({ form }) {
    const tipoOrigen = useStore(form.store, (s) => s.values.tipoOrigen)
    const planEstudioId = useStore(form.store, (s) => s.values.plan_estudio_id)
    const iaConfig = useStore(form.store, (s) => s.values.iaConfig)

    const { data: plan } = usePlan(planEstudioId)
    const { data: estructurasAsignatura } = useSubjectEstructuras(
      plan?.estructura_id ?? null,
    )
    const { data: lineasPlan } = usePlanLineas(planEstudioId)

    if (tipoOrigen === 'MANUAL') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Configuración Manual</CardTitle>
            <CardDescription>
              La asignatura se creará vacía. Podrás editar el contenido
              detallado en la siguiente pantalla.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    }

    if (tipoOrigen === 'IA_SIMPLE') {
      return (
        <form.AppField
          name="iaConfig.descripcionEnfoqueAcademico"
          validators={{ onChange: enfoqueAcademicoSchema }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <AIRequestComposer
                value={[field.state.value, iaConfig.instruccionesAdicionalesIA]
                  .filter(Boolean)
                  .join('\n\n')}
                onChange={(prompt) => {
                  field.handleChange(prompt)
                  form.setFieldValue('iaConfig.instruccionesAdicionalesIA', '')
                }}
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
                placeholder="Describe en una sola solicitud la asignatura que quieres crear: enfoque, alcance, público, resultados de aprendizaje, evaluación, bibliografía y restricciones…"
              />
              <FieldErrorText meta={field.state.meta} id="enfoque-error" />
            </div>
          )}
        </form.AppField>
      )
    }

    if (tipoOrigen === 'IA_MULTIPLE') {
      const maxCiclos = Math.max(1, plan?.numero_ciclos ?? 1)

      const patchSugerencia = (
        id: string,
        patch: Partial<NuevaAsignaturaFormValues['sugerencias'][number]>,
      ) =>
        form.setFieldValue(
          'sugerencias',
          form
            .getFieldValue('sugerencias')
            .map((s) => (s.id === id ? { ...s, ...patch } : s)),
        )

      return (
        <div className="flex flex-col gap-4">
          <div className="border-border/60 bg-muted/30 rounded-xl border p-4">
            <form.AppField
              name="estructuraId"
              validators={{
                onChange: ({ value }) => primerError(estructuraSchema, value),
              }}
            >
              {(field) => (
                <div className="grid gap-1">
                  <Label className="text-muted-foreground text-xs">
                    Estructura de la asignatura
                  </Label>
                  <Select
                    value={field.state.value ?? undefined}
                    onValueChange={(val) => {
                      field.handleChange(val)
                      form.setFieldValue('datosBasicos.estructuraId', val)
                    }}
                  >
                    <SelectTrigger
                      aria-invalid={fieldInvalid(field.state.meta)}
                    >
                      <SelectValue placeholder="Selecciona una estructura" />
                    </SelectTrigger>
                    <SelectContent>
                      {(estructurasAsignatura ?? []).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldErrorText
                    meta={field.state.meta}
                    id="estructura-multiple-error"
                  />
                </div>
              )}
            </form.AppField>
          </div>

          <div className="border-border/60 bg-muted/30 rounded-xl border p-4">
            <h3 className="text-foreground mx-3 mb-2 text-lg font-semibold">
              Materias seleccionadas
            </h3>
            <form.AppField name="sugerencias">
              {(field) => {
                const sugerenciasSeleccionadas = field.state.value.filter(
                  (s) => s.selected,
                )

                return sugerenciasSeleccionadas.length === 0 ? (
                  <div className="text-muted-foreground text-sm">
                    Selecciona al menos una sugerencia para configurar su
                    descripción, línea curricular y ciclo.
                  </div>
                ) : (
                  <Accordion type="multiple" className="w-full space-y-2">
                    {sugerenciasSeleccionadas.map((asig) => (
                      <AccordionItem
                        key={asig.id}
                        value={asig.id}
                        className="border-border/60 bg-background/40 rounded-lg border border-b-0 px-3"
                      >
                        <AccordionTrigger className="hover:bg-accent/30 data-[state=open]:bg-accent/20 data-[state=open]:text-accent-foreground -mx-3 px-3">
                          {asig.nombre}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          <div className="mx-1 grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-1">
                              <Label className="text-muted-foreground text-xs">
                                Descripción
                              </Label>
                              <Textarea
                                value={asig.descripcion}
                                maxLength={7000}
                                rows={6}
                                onChange={(e) =>
                                  patchSugerencia(asig.id, {
                                    descripcion: e.target.value,
                                  })
                                }
                              />
                            </div>

                            <div className="grid content-start gap-3">
                              <div className="grid gap-1">
                                <Label className="text-muted-foreground text-xs">
                                  {nombreTipoCiclo(plan?.tipo_ciclo)} (opcional)
                                </Label>
                                <NumberField
                                  value={asig.numero_ciclo}
                                  min={1}
                                  max={maxCiclos}
                                  step={1}
                                  onValueChange={(value) =>
                                    patchSugerencia(asig.id, {
                                      numero_ciclo: value,
                                    })
                                  }
                                >
                                  <NumberFieldGroup>
                                    <NumberFieldDecrement />
                                    <NumberFieldInput
                                      placeholder={`1-${maxCiclos}`}
                                    />
                                    <NumberFieldIncrement />
                                  </NumberFieldGroup>
                                </NumberField>
                              </div>
                              <div className="grid gap-1">
                                <Label className="text-muted-foreground text-xs">
                                  Línea curricular (opcional)
                                </Label>
                                <Select
                                  value={asig.linea_plan_id ?? '__none__'}
                                  onValueChange={(val) =>
                                    patchSugerencia(asig.id, {
                                      linea_plan_id:
                                        val === '__none__' ? null : val,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Sin línea" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">
                                      Ninguna
                                    </SelectItem>
                                    {(lineasPlan ?? []).map((l) => (
                                      <SelectItem key={l.id} value={l.id}>
                                        {l.nombre}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )
              }}
            </form.AppField>
          </div>
        </div>
      )
    }

    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return (
        <div className="flex flex-col gap-4">
          <form.AppField
            name="clonTradicional.archivosAdjuntos"
            validators={{
              onChange: ({ value }) =>
                primerError(archivosClonadoSchema, value),
            }}
          >
            {(field) => (
              <>
                <FileDropzone
                  title="Word o PDF de las asignaturas"
                  acceptedTypes=".doc,.docx,.pdf"
                  maxFiles={10}
                  autoScrollToDropzone={true}
                  enableSha256Dedupe={true}
                  enableAutoUpload={true}
                  persistentFiles={field.state.value}
                  onDedupePendingChange={(pendingCount) =>
                    form.setFieldValue(
                      'archivosAdjuntosDedupePending',
                      pendingCount,
                    )
                  }
                  onFilesChange={(files: Array<UploadedFile>) =>
                    field.handleChange(files)
                  }
                />
                <FieldErrorText
                  meta={field.state.meta}
                  id="archivos-clonado-error"
                />
              </>
            )}
          </form.AppField>
        </div>
      )
    }

    // CLONADO_INTERNO no se renderiza aquí: el contenedor muestra
    // PasoBasicosClonadoInterno en el paso de detalles para ese modo.
    return null
  },
})
