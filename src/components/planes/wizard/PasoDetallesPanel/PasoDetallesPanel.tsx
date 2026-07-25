import { useStore } from '@tanstack/react-form'

import { FileDropzone } from './FileDropZone'

import type { UploadedFile } from './FileDropZone'
import type { AnyFieldMeta } from '@tanstack/react-form'

import { withForm } from '@/components/form'
import { AIRequestComposer } from '@/components/ia/AIRequestComposer'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  archivoPlanSchema,
  enfoqueAcademicoPlanSchema,
  nuevoPlanFormOpts,
  primerError,
} from '@/features/planes/nuevo/schema'

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
  ...nuevoPlanFormOpts,
  render: function Render({ form }) {
    const tipoOrigen = useStore(form.store, (s) => s.values.tipoOrigen)
    const iaConfig = useStore(form.store, (s) => s.values.iaConfig)

    if (tipoOrigen === 'MANUAL') {
      return null
    }

    if (tipoOrigen === 'IA') {
      return (
        <form.AppField
          name="iaConfig.descripcionEnfoqueAcademico"
          validators={{ onChange: enfoqueAcademicoPlanSchema }}
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
                placeholder="Describe en una sola solicitud el plan que quieres crear: perfil de egreso, enfoque pedagógico, sector profesional, normativa, estructura y cualquier restricción relevante…"
              />
              <FieldErrorText meta={field.state.meta} id="enfoque-error" />
            </div>
          )}
        </form.AppField>
      )
    }

    if (tipoOrigen === 'CLONADO_TRADICIONAL') {
      return (
        <div className="flex flex-col gap-4">
          <form.AppField
            name="clonTradicional.archivoPlanId"
            validators={{
              onChange: ({ value }) => primerError(archivoPlanSchema, value),
            }}
          >
            {(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="word">Word o PDF del plan de estudios</Label>

                <FileDropzone
                  title="Word o PDF del plan de estudios"
                  acceptedTypes=".doc,.docx,.pdf"
                  maxFiles={1}
                  autoScrollToDropzone={true}
                  enableSha256Dedupe={true}
                  enableAutoUpload={true}
                  persistentFiles={field.state.value ? [field.state.value] : []}
                  onDedupePendingChange={(pendingCount) =>
                    form.setFieldValue(
                      'archivosAdjuntosDedupePending',
                      pendingCount,
                    )
                  }
                  onFilesChange={(files: Array<UploadedFile>) =>
                    field.handleChange(files[0] ?? null)
                  }
                />
                <FieldErrorText
                  meta={field.state.meta}
                  id="archivo-plan-error"
                />
              </div>
            )}
          </form.AppField>
        </div>
      )
    }

    // CLONADO_INTERNO no se renderiza aquí: el contenedor muestra
    // PasoBasicosForm en el paso de detalles para ese modo.
    return (
      <Card>
        <CardHeader>
          <CardTitle>Selecciona un modo</CardTitle>
          <CardDescription>
            Elige una opción en el paso anterior para continuar.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  },
})
