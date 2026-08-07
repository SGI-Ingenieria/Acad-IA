import { FileText, Loader2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { UploadedFile } from './FileDropZone'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useDocumentos, useSubirDocumento } from '@/data/hooks/useDocumentos'

export type ReferenciasIAMetadata = {
  archivos: Array<{ id: string; label: string }>
  repositorios: Array<{ id: string; label: string; repoId: string }>
}

type Props = {
  selectedArchivoIds?: Array<string>
  selectedRepositorioIds?: Array<string>
  uploadedFiles?: Array<UploadedFile>
  onToggleArchivo?: (id: string, checked: boolean) => void
  onToggleRepositorio?: (id: string, checked: boolean) => void
  onFilesChange?: (files: Array<UploadedFile>) => void
  enableSha256Dedupe?: boolean
  onDedupePendingChange?: (pendingCount: number) => void
  enableAutoUpload?: boolean
  autoScrollToDropzone?: boolean
  onReferenceMetadataChange?: (metadata: ReferenciasIAMetadata) => void
}

const ACCEPT =
  '.pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp'

/** Referencias privadas: los identificadores son archivos de Acad-IA, nunca IDs de OpenAI. */
const ReferenciasParaIA = ({
  selectedArchivoIds = [],
  uploadedFiles = [],
  onToggleArchivo,
  onFilesChange,
  onReferenceMetadataChange,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const documentos = useDocumentos()
  const subir = useSubirDocumento()
  const files = useMemo(() => documentos.data ?? [], [documentos.data])
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es-MX')
    return files.filter(
      (file) =>
        !term || file.display_name.toLocaleLowerCase('es-MX').includes(term),
    )
  }, [files, query])

  const metadata = useMemo<ReferenciasIAMetadata>(
    () => ({
      archivos: files.map((file) => ({
        id: file.id,
        label: file.display_name,
      })),
      repositorios: [],
    }),
    [files],
  )

  // La referencia se recalcula desde la fuente de verdad; no conserva vector stores externos.
  useEffect(
    () => onReferenceMetadataChange?.(metadata),
    [metadata, onReferenceMetadataChange],
  )

  const onChoose = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const result = await subir.mutateAsync(file)
    if (!result.fileId) return
    const next: UploadedFile = {
      id: result.sessionId,
      file,
      archivoId: result.fileId,
      uploadStatus: 'exito',
    }
    onFilesChange?.([...uploadedFiles, next])
    onToggleArchivo?.(result.fileId, true)
  }

  return (
    <section
      className="space-y-control"
      aria-label="Referencias documentales para la IA"
    >
      <div className="gap-control flex items-center justify-between">
        <div>
          <Label>Referencias para la IA</Label>
          <p className="text-muted-foreground text-xs">
            Documentos privados de Acad-IA; la IA sólo recibe los que autorices.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => void onChoose(event)}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={subir.isPending}
        >
          {subir.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
          Subir
        </Button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar documentos autorizados"
        className="border-input bg-background focus-visible:ring-ring px-control h-9 w-full rounded-md border text-sm outline-none focus-visible:ring-2"
      />

      <div className="divide-border max-h-72 divide-y overflow-y-auto rounded-md border">
        {documentos.isLoading ? (
          <p className="text-muted-foreground p-control text-sm">
            Cargando documentos…
          </p>
        ) : null}
        {!documentos.isLoading && !filtered.length ? (
          <p className="text-muted-foreground p-control text-sm">
            Aún no hay documentos disponibles para esta referencia.
          </p>
        ) : null}
        {filtered.map((file) => {
          const ready = file.status === 'ready'
          const selected = selectedArchivoIds.includes(file.id)
          return (
            <Label
              key={file.id}
              className="hover:bg-muted/50 gap-control p-control flex cursor-pointer items-center"
            >
              <Checkbox
                checked={selected}
                disabled={!ready}
                onCheckedChange={(checked) =>
                  onToggleArchivo?.(file.id, Boolean(checked))
                }
              />
              <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {file.display_name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {ready
                    ? 'Listo para usarse'
                    : file.status === 'processing'
                      ? 'Procesando e indexando…'
                      : 'Requiere atención'}
                </span>
              </span>
            </Label>
          )
        })}
      </div>
    </section>
  )
}

export default ReferenciasParaIA
