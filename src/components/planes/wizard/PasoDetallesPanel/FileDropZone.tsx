import {
  CheckCircle2,
  File,
  FileText,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MAX_DOCUMENT_UPLOAD_BYTES } from '@/data/api/documentos.api'
import {
  useEliminarDocumento,
  useSubirDocumento,
} from '@/data/hooks/useDocumentos'
import { formatFileSize } from '@/features/planes/utils/format-file-size'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

export type FileUploadStatus =
  | 'en_cola'
  | 'subiendo'
  | 'procesando'
  | 'exito'
  | 'error'
  | 'eliminando'

export type SerializedFileMetadata = {
  name: string
  size: number
  type: string
  lastModified?: number
}

export interface UploadedFile {
  id: string
  file: File | SerializedFileMetadata
  preview?: string
  uploadStatus?: FileUploadStatus
  uploadError?: string
  uploadProgress?: number
  bytesUploaded?: number
  estimatedSecondsRemaining?: number | null
  archivoId?: string
  path?: string
}

const MAX_PARALLEL_UPLOADS = 3

function isNativeFile(file: File | SerializedFileMetadata): file is File {
  return typeof (file as File).arrayBuffer === 'function'
}

function fileExtension(filename: string) {
  return `.${filename.split('.').pop()?.toLocaleLowerCase('es-MX') ?? ''}`
}

function acceptedExtensions(accept: string) {
  return new Set(
    accept
      .split(',')
      .map((value) => value.trim().toLocaleLowerCase('es-MX'))
      .filter((value) => value.startsWith('.')),
  )
}

function uploadIdentity(file: File | SerializedFileMetadata) {
  return `${file.name}:${file.size}:${file.lastModified ?? 0}:${file.type}`
}

export function formatUploadEta(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null
  if (seconds < 5) return 'unos segundos'
  if (seconds < 60) return `${seconds} s restantes`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} min restante${minutes === 1 ? '' : 's'}`
}

interface FileDropzoneProps {
  persistentFiles?: Array<UploadedFile>
  onFilesChange?: (files: Array<UploadedFile>) => void
  acceptedTypes?: string
  maxFiles?: number
  maxFileBytes?: number
  title?: string
  description?: string
  autoScrollToDropzone?: boolean
  /** Nombre heredado: informa cargas aún no materializadas, no hashing local. */
  onDedupePendingChange?: (pendingCount: number) => void
  enableAutoUpload?: boolean
}

export function FileDropzone({
  persistentFiles,
  onFilesChange,
  acceptedTypes = '.doc,.docx,.pdf',
  maxFiles = 5,
  maxFileBytes = MAX_DOCUMENT_UPLOAD_BYTES,
  title = 'Añadir archivos',
  description = 'Arrastra o selecciona',
  autoScrollToDropzone = false,
  onDedupePendingChange,
  enableAutoUpload = false,
}: FileDropzoneProps) {
  const inputId = useId()
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<Array<UploadedFile>>(persistentFiles ?? [])
  const filesRef = useRef(files)
  const uploadQueueRef = useRef<Array<UploadedFile>>([])
  const activeUploadsRef = useRef(0)
  const pumpQueueRef = useRef<() => void>(() => undefined)
  const onFilesChangeRef = useRef(onFilesChange)
  const onPendingChangeRef = useRef(onDedupePendingChange)
  const bottomRef = useRef<HTMLDivElement>(null)
  const previousFilesLengthRef = useRef(files.length)

  const updateFiles = useCallback(
    (updater: (current: Array<UploadedFile>) => Array<UploadedFile>) => {
      const next = updater(filesRef.current)
      filesRef.current = next
      setFiles(next)
    },
    [],
  )

  const upload = useSubirDocumento({
    onProgress: (file, progress) => {
      updateFiles((current) =>
        current.map((item) =>
          item.file === file
            ? {
                ...item,
                uploadStatus: 'subiendo',
                uploadProgress: progress.percentage,
                bytesUploaded: progress.bytesUploaded,
                estimatedSecondsRemaining: progress.estimatedSecondsRemaining,
              }
            : item,
        ),
      )
    },
    onStage: (file, stage) => {
      if (stage !== 'processing') return
      updateFiles((current) =>
        current.map((item) =>
          item.file === file
            ? {
                ...item,
                uploadStatus: 'procesando',
                uploadProgress: 100,
                bytesUploaded: file.size,
                estimatedSecondsRemaining: 0,
              }
            : item,
        ),
      )
    },
  })
  const remove = useEliminarDocumento()

  const startUpload = useCallback(
    async (queued: UploadedFile) => {
      const current = filesRef.current.find((file) => file.id === queued.id)
      if (
        !current ||
        current.uploadStatus === 'subiendo' ||
        current.uploadStatus === 'procesando' ||
        current.uploadStatus === 'eliminando' ||
        current.uploadStatus === 'exito'
      ) {
        return
      }

      if (!isNativeFile(current.file)) {
        updateFiles((items) =>
          items.map((item) =>
            item.id === current.id
              ? {
                  ...item,
                  uploadStatus: 'error',
                  uploadError: 'El archivo local ya no está disponible.',
                }
              : item,
          ),
        )
        return
      }

      updateFiles((items) =>
        items.map((item) =>
          item.id === current.id
            ? {
                ...item,
                uploadStatus: 'subiendo',
                uploadError: undefined,
                uploadProgress: 0,
                bytesUploaded: 0,
                estimatedSecondsRemaining: null,
              }
            : item,
        ),
      )

      try {
        const result = await upload.mutateAsync(current.file)
        if (!result.fileId) {
          throw new Error('No se recibió el documento procesado.')
        }
        updateFiles((items) =>
          items.map((item) =>
            item.id === current.id
              ? {
                  ...item,
                  archivoId: result.fileId,
                  uploadStatus: 'exito',
                  uploadError: undefined,
                  uploadProgress: 100,
                  bytesUploaded: current.file.size,
                  estimatedSecondsRemaining: 0,
                }
              : item,
          ),
        )
      } catch (error) {
        updateFiles((items) =>
          items.map((item) =>
            item.id === current.id
              ? {
                  ...item,
                  uploadStatus: 'error',
                  uploadError:
                    error instanceof Error
                      ? error.message
                      : 'No se pudo subir el archivo.',
                }
              : item,
          ),
        )
      }
    },
    [updateFiles, upload],
  )

  const pumpQueue = useCallback(() => {
    while (
      activeUploadsRef.current < MAX_PARALLEL_UPLOADS &&
      uploadQueueRef.current.length
    ) {
      const next = uploadQueueRef.current.shift()
      if (!next) break
      if (!filesRef.current.some((file) => file.id === next.id)) continue
      activeUploadsRef.current += 1
      void startUpload(next).finally(() => {
        activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1)
        pumpQueueRef.current()
      })
    }
  }, [startUpload])

  useEffect(() => {
    pumpQueueRef.current = pumpQueue
  }, [pumpQueue])

  const enqueueUploads = useCallback(
    (items: Array<UploadedFile>) => {
      uploadQueueRef.current.push(...items)
      pumpQueue()
    },
    [pumpQueue],
  )

  const retryUpload = useCallback(
    (fileId: string) => {
      const current = filesRef.current.find((file) => file.id === fileId)
      if (!current) return
      updateFiles((items) =>
        items.map((item) =>
          item.id === fileId
            ? { ...item, uploadStatus: 'en_cola', uploadError: undefined }
            : item,
        ),
      )
      enqueueUploads([current])
    },
    [enqueueUploads, updateFiles],
  )

  const addFiles = useCallback(
    (incomingFiles: Array<File>) => {
      const extensions = acceptedExtensions(acceptedTypes)
      const existing = new Set(
        filesRef.current.map((item) => uploadIdentity(item.file)),
      )
      const unique: Array<File> = []
      let duplicates = 0
      let rejectedTypes = 0
      let rejectedSizes = 0

      for (const file of incomingFiles) {
        if (extensions.size && !extensions.has(fileExtension(file.name))) {
          rejectedTypes += 1
          continue
        }
        if (file.size < 1 || file.size > maxFileBytes) {
          rejectedSizes += 1
          continue
        }
        const identity = uploadIdentity(file)
        if (existing.has(identity)) {
          duplicates += 1
          continue
        }
        existing.add(identity)
        unique.push(file)
      }

      const room = Math.max(0, maxFiles - filesRef.current.length)
      const accepted = unique.slice(0, room)
      const overflow = Math.max(0, unique.length - accepted.length)
      const queued = accepted.map<UploadedFile>((file) => ({
        id: crypto.randomUUID(),
        file,
        uploadStatus: enableAutoUpload ? 'en_cola' : undefined,
        uploadProgress: 0,
        bytesUploaded: 0,
        estimatedSecondsRemaining: null,
      }))

      if (queued.length) {
        updateFiles((current) => [...current, ...queued])
        if (enableAutoUpload) enqueueUploads(queued)
      }
      if (rejectedTypes) {
        notify.warning(
          `${rejectedTypes === 1 ? 'Un archivo tiene' : `${rejectedTypes} archivos tienen`} un formato no permitido.`,
        )
      }
      if (rejectedSizes) {
        notify.warning(
          `${rejectedSizes === 1 ? 'Un archivo excede' : `${rejectedSizes} archivos exceden`} ${formatFileSize(maxFileBytes)}.`,
        )
      }
      if (duplicates) notify.info('Los archivos repetidos se omitieron.')
      if (overflow) notify.warning(`Puedes añadir hasta ${maxFiles} archivos.`)
    },
    [
      acceptedTypes,
      enableAutoUpload,
      enqueueUploads,
      maxFileBytes,
      maxFiles,
      updateFiles,
    ],
  )

  const removeFile = useCallback(
    async (fileId: string) => {
      const current = filesRef.current.find((file) => file.id === fileId)
      if (!current) return
      if (
        current.uploadStatus === 'subiendo' ||
        current.uploadStatus === 'procesando' ||
        current.uploadStatus === 'eliminando'
      ) {
        return
      }

      uploadQueueRef.current = uploadQueueRef.current.filter(
        (item) => item.id !== fileId,
      )
      if (!current.archivoId) {
        updateFiles((items) => items.filter((item) => item.id !== fileId))
        return
      }

      const previousStatus = current.uploadStatus
      updateFiles((items) =>
        items.map((item) =>
          item.id === fileId
            ? { ...item, uploadStatus: 'eliminando', uploadError: undefined }
            : item,
        ),
      )
      try {
        await remove.mutateAsync(current.archivoId)
        updateFiles((items) => items.filter((item) => item.id !== fileId))
      } catch {
        updateFiles((items) =>
          items.map((item) =>
            item.id === fileId
              ? { ...item, uploadStatus: previousStatus }
              : item,
          ),
        )
      }
    },
    [remove, updateFiles],
  )

  useEffect(() => {
    onFilesChangeRef.current = onFilesChange
  }, [onFilesChange])

  useEffect(() => {
    onPendingChangeRef.current = onDedupePendingChange
  }, [onDedupePendingChange])

  useEffect(() => {
    onFilesChangeRef.current?.(files)
    onPendingChangeRef.current?.(
      files.filter((file) =>
        ['en_cola', 'subiendo', 'procesando'].includes(file.uploadStatus ?? ''),
      ).length,
    )
  }, [files])

  useEffect(() => {
    if (
      autoScrollToDropzone &&
      previousFilesLengthRef.current === 0 &&
      files.length > 0
    ) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    previousFilesLengthRef.current = files.length
  }, [autoScrollToDropzone, files.length])

  const handleSelection = useCallback(
    (selected: FileList | null) => {
      if (selected) addFiles(Array.from(selected))
    },
    [addFiles],
  )

  const formatLabel = acceptedTypes
    .split(',')
    .map((type) => type.trim().replace(/^\./, '').toLocaleUpperCase('es-MX'))
    .join(', ')

  return (
    <div className="gap-grupo flex flex-col">
      <div ref={bottomRef} />
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setIsDragging(false)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          addFiles(Array.from(event.dataTransfer.files))
        }}
        className={cn(
          'border-border bg-background hover:border-primary/50 rounded-xl border border-dashed transition-colors',
          isDragging && 'border-primary bg-primary/5',
        )}
      >
        <input
          id={inputId}
          type="file"
          accept={acceptedTypes}
          multiple
          className="sr-only"
          disabled={files.length >= maxFiles}
          onChange={(event) => {
            handleSelection(event.target.files)
            event.target.value = ''
          }}
        />
        <label
          htmlFor={inputId}
          className={cn(
            'gap-control px-seccion py-grupo flex min-h-24 items-center text-left',
            files.length >= maxFiles
              ? 'cursor-not-allowed opacity-60'
              : 'cursor-pointer',
          )}
        >
          <span
            className={cn(
              'bg-muted text-muted-foreground grid size-11 shrink-0 place-items-center rounded-lg transition-colors',
              isDragging && 'bg-primary text-primary-foreground',
            )}
          >
            <Upload className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block text-sm font-semibold">
              {title}
            </span>
            <span className="text-muted-foreground mt-micro block text-sm">
              {isDragging ? 'Suelta para añadir' : description}
            </span>
            <span className="text-muted-foreground mt-relacionado block text-xs">
              {formatLabel} · hasta {formatFileSize(maxFileBytes)}
            </span>
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {files.length}/{maxFiles}
          </span>
        </label>
      </div>

      {files.length ? (
        <div className="space-y-relacionado pr-micro max-h-72 overflow-y-auto">
          {[...files].reverse().map((uploadedFile) => {
            const size = uploadedFile.file.size
            const progress = uploadedFile.uploadProgress ?? 0
            const eta = formatUploadEta(uploadedFile.estimatedSecondsRemaining)
            const extension = fileExtension(uploadedFile.file.name)
            const FileIcon = ['.pdf', '.doc', '.docx'].includes(extension)
              ? FileText
              : File
            const busy = [
              'en_cola',
              'subiendo',
              'procesando',
              'eliminando',
            ].includes(uploadedFile.uploadStatus ?? '')
            const status =
              uploadedFile.uploadStatus === 'en_cola'
                ? 'En cola'
                : uploadedFile.uploadStatus === 'subiendo'
                  ? `Subiendo · ${progress}%`
                  : uploadedFile.uploadStatus === 'procesando'
                    ? 'Procesando'
                    : uploadedFile.uploadStatus === 'eliminando'
                      ? 'Eliminando'
                      : uploadedFile.uploadStatus === 'exito'
                        ? 'Listo'
                        : uploadedFile.uploadStatus === 'error'
                          ? 'No se pudo subir'
                          : null
            const transferred = formatFileSize(
              Math.min(uploadedFile.bytesUploaded ?? 0, size),
            )

            return (
              <div
                key={uploadedFile.id}
                className={cn(
                  'border-border gap-control px-control py-control animate-in fade-in grid grid-cols-[auto_minmax(0,1fr)_auto] items-center rounded-lg border',
                  uploadedFile.uploadStatus === 'error' &&
                    'border-destructive/40',
                )}
              >
                <span className="bg-muted text-muted-foreground grid size-9 place-items-center rounded-lg">
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : uploadedFile.uploadStatus === 'exito' ? (
                    <CheckCircle2 className="text-success size-4" />
                  ) : (
                    <FileIcon className="size-4" />
                  )}
                </span>

                <span className="min-w-0">
                  <span className="text-foreground block truncate text-sm font-medium">
                    {uploadedFile.file.name}
                  </span>
                  <span
                    className={cn(
                      'text-muted-foreground mt-micro block text-xs',
                      uploadedFile.uploadStatus === 'error' &&
                        'text-destructive',
                    )}
                  >
                    {status ? `${status} · ` : ''}
                    {uploadedFile.uploadStatus === 'subiendo'
                      ? `${transferred} de ${formatFileSize(size)}`
                      : formatFileSize(size)}
                    {eta ? ` · ${eta}` : ''}
                  </span>
                  {uploadedFile.uploadStatus === 'subiendo' ? (
                    <span
                      className="bg-muted mt-relacionado block h-1 overflow-hidden rounded-full"
                      role="progressbar"
                      aria-label={`Progreso de ${uploadedFile.file.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                    >
                      <span
                        className="bg-primary block h-full rounded-full transition-[width]"
                        style={{ width: `${progress}%` }}
                      />
                    </span>
                  ) : null}
                  {uploadedFile.uploadStatus === 'error' &&
                  uploadedFile.uploadError ? (
                    <span className="text-destructive mt-micro block text-xs">
                      {uploadedFile.uploadError}
                    </span>
                  ) : null}
                </span>

                <span className="gap-micro flex items-center">
                  {uploadedFile.uploadStatus === 'error' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => retryUpload(uploadedFile.id)}
                    >
                      <RotateCcw className="size-4" />
                      Reintentar
                    </Button>
                  ) : null}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar ${uploadedFile.file.name}`}
                        onClick={() => void removeFile(uploadedFile.id)}
                        disabled={busy}
                      >
                        <X className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Quitar archivo</TooltipContent>
                  </Tooltip>
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
