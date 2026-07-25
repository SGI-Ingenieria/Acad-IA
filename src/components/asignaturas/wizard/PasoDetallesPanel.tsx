import { useStore } from '@tanstack/react-form'

import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import type { AnyFieldMeta } from '@tanstack/react-form'

import { withForm } from '@/components/form'
import { AIRequestComposer } from '@/components/ia/AIRequestComposer'
import { FileDropzone } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import {
  archivosClonadoSchema,
  enfoqueAcademicoSchema,
  nuevaAsignaturaFormOpts,
  primerError,
} from '@/features/asignaturas/nueva/schema'

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
    const iaConfig = useStore(form.store, (s) => s.values.iaConfig)

    if (tipoOrigen === 'MANUAL') {
      return null
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
