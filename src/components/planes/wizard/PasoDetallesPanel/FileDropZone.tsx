import {
  Upload,
  File,
  X,
  FileText,
  Loader2,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { supabaseBrowser } from '@/data'
import {
  deleteArchivo,
  uploadOpenAIForArchivo,
  uploadSingleFile,
  UploadSingleFileError,
} from '@/data/api/files.api'
import { formatFileSize } from '@/features/planes/utils/format-file-size'
import { cn } from '@/lib/utils'

export type FileUploadStatus = 'subiendo' | 'exito' | 'error' | 'eliminando'

export interface UploadedFile {
  id: string // Necesario para React (key)
  file: File // La fuente de verdad (contiene name, size, type)
  preview?: string // Opcional: si fueran imágenes
  sha256?: string // Hash SHA256 (hex) calculado en frontend

  // Estado del flujo: Storage -> BD -> OpenAI
  uploadStatus?: FileUploadStatus
  uploadError?: string
  archivoId?: string
  path?: string
  openaiFileId?: string
}

interface FileDropzoneProps {
  persistentFiles?: Array<UploadedFile>
  onFilesChange?: (files: Array<UploadedFile>) => void
  acceptedTypes?: string
  maxFiles?: number
  title?: string
  description?: string
  autoScrollToDropzone?: boolean
  enableSha256Dedupe?: boolean
  onDedupePendingChange?: (pendingCount: number) => void
  enableAutoUpload?: boolean
}

export function FileDropzone({
  persistentFiles,
  onFilesChange,
  acceptedTypes = '.doc,.docx,.pdf',
  maxFiles = 5,
  title = 'Arrastra archivos aquí',
  description = 'o haz clic para seleccionar',
  autoScrollToDropzone = false,
  enableSha256Dedupe = false,
  onDedupePendingChange,
  enableAutoUpload = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<Array<UploadedFile>>(persistentFiles ?? [])
  const onFilesChangeRef = useRef<typeof onFilesChange>(onFilesChange)
  const onDedupePendingChangeRef = useRef<typeof onDedupePendingChange>(
    onDedupePendingChange,
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevFilesLengthRef = useRef(files.length)
  const filesRef = useRef<Array<UploadedFile>>(files)

  const pendingChecksRef = useRef(new Set<string>())
  const [pendingChecks, setPendingChecks] = useState(0)

  useEffect(() => {
    onDedupePendingChangeRef.current = onDedupePendingChange
  }, [onDedupePendingChange])

  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => {
    onDedupePendingChangeRef.current?.(pendingChecks)
  }, [pendingChecks])

  const computeSha256Hex = useCallback(async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buf)
    const bytes = new Uint8Array(digest)
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }, [])

  const getBasename = (path: string) => {
    const parts = path.split('/').filter(Boolean)
    return parts.length ? parts[parts.length - 1] : path
  }

  const stripUuidPrefixFromBasename = (basename: string) => {
    return basename.replace(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
      '',
    )
  }

  const startUpload = useCallback(
    async (fileId: string) => {
      const current = filesRef.current.find((f) => f.id === fileId)
      if (!current) return
      if (
        current.uploadStatus === 'subiendo' ||
        current.uploadStatus === 'eliminando' ||
        current.uploadStatus === 'exito'
      ) {
        return
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, uploadStatus: 'subiendo', uploadError: undefined }
            : f,
        ),
      )

      try {
        const sha256 = current.sha256 ?? (await computeSha256Hex(current.file))

        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, sha256 } : f)),
        )

        const result = await uploadSingleFile({ file: current.file, sha256 })

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  archivoId: result.archivoId,
                  path: result.path,
                  openaiFileId: result.openaiFileId,
                  uploadStatus: 'exito',
                  uploadError: undefined,
                }
              : f,
          ),
        )
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Error subiendo archivo.'
        const archivoId =
          e instanceof UploadSingleFileError ? e.archivoId : undefined
        const path = e instanceof UploadSingleFileError ? e.path : undefined

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  uploadStatus: 'error',
                  uploadError: message,
                  ...(archivoId ? { archivoId } : {}),
                  ...(path ? { path } : {}),
                }
              : f,
          ),
        )
      }
    },
    [computeSha256Hex],
  )

  const retryUpload = useCallback(
    async (fileId: string) => {
      const current = filesRef.current.find((f) => f.id === fileId)
      if (!current) return

      // Si alcanzamos a crear el registro en BD/Storage, reintenta SOLO OpenAI.
      if (current.archivoId) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, uploadStatus: 'subiendo', uploadError: undefined }
              : f,
          ),
        )

        try {
          const { openaiFileId } = await uploadOpenAIForArchivo({
            archivoId: current.archivoId,
          })

          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    openaiFileId,
                    uploadStatus: 'exito',
                    uploadError: undefined,
                  }
                : f,
            ),
          )
        } catch (e) {
          const message =
            e instanceof Error ? e.message : 'Error subiendo archivo a OpenAI.'
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? { ...f, uploadStatus: 'error', uploadError: message }
                : f,
            ),
          )
        }

        return
      }

      await startUpload(fileId)
    },
    [startUpload],
  )

  const runDuplicateCheck = useCallback(
    async (uploaded: UploadedFile) => {
      if (!enableSha256Dedupe && !enableAutoUpload) return
      if (pendingChecksRef.current.has(uploaded.id)) return

      pendingChecksRef.current.add(uploaded.id)
      setPendingChecks((n) => n + 1)

      try {
        const sha256 = await computeSha256Hex(uploaded.file)

        setFiles((prev) =>
          prev.map((f) => (f.id === uploaded.id ? { ...f, sha256 } : f)),
        )

        const supabase = supabaseBrowser()

        const { data: existing, error } = enableSha256Dedupe
          ? await supabase
              .from('archivos')
              .select('id,path,openai_file_id')
              .eq('hash', sha256)
              .maybeSingle()
          : { data: null, error: null }

        if (error) {
          console.error('Error buscando duplicados por hash:', error)
          return
        }

        if (existing?.id) {
          // Si ya existe en la BD, adjuntarlo usando sus metadatos en lugar de subir de nuevo.
          const archivoId = String(existing.id)
          const path = existing.path ? String(existing.path) : undefined
          const openaiFileId = existing.openai_file_id
            ? String(existing.openai_file_id)
            : undefined

          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploaded.id
                ? {
                    ...f,
                    sha256: f.sha256 ?? uploaded.sha256,
                    archivoId,
                    path,
                    openaiFileId,
                    uploadError: undefined,
                    uploadStatus: openaiFileId ? 'exito' : 'subiendo',
                  }
                : f,
            ),
          )

          // Adjuntar silenciosamente usando metadatos existentes (sin notificar)

          // Si no tiene openaiFileId y está habilitado auto-upload, intentar sólo la subida a OpenAI
          if (!openaiFileId && enableAutoUpload) {
            // Dejar que retryUpload gestione sólo la subida a OpenAI (archivoId ya existe)
            void retryUpload(uploaded.id)
          }

          return
        }

        if (enableAutoUpload) {
          void startUpload(uploaded.id)
        }
      } catch (e) {
        console.error('Error calculando hash / dedupe:', e)
      } finally {
        pendingChecksRef.current.delete(uploaded.id)
        setPendingChecks((n) => Math.max(0, n - 1))
      }
    },
    [
      computeSha256Hex,
      enableAutoUpload,
      enableSha256Dedupe,
      startUpload,
      retryUpload,
    ],
  )

  const addFiles = useCallback(
    (incomingFiles: Array<File>) => {
      console.log(
        'incoming files:',
        incomingFiles.map((file) => file.name),
      )

      setFiles((previousFiles) => {
        console.log(
          'previous files',
          previousFiles.map((f) => f.file.name),
        )

        // Evitar duplicados por nombre (comprobación global en los archivos existentes)
        const existingFileNames = new Set(
          previousFiles.map((uploaded) => uploaded.file.name),
        )
        const uniqueNewFiles = incomingFiles.filter(
          (incomingFile) => !existingFileNames.has(incomingFile.name),
        )

        // Convertir archivos a objetos con ID único para manejo en React
        const filesToUpload: Array<UploadedFile> = uniqueNewFiles.map(
          (incomingFile) => ({
            id:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? (crypto as any).randomUUID()
                : `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file: incomingFile,
          }),
        )

        // Calcular espacio disponible respetando el límite máximo
        const room = Math.max(0, maxFiles - previousFiles.length)
        const nextFiles = [
          ...previousFiles,
          ...filesToUpload.slice(0, room),
        ].slice(0, maxFiles)

        // Lanzar dedupe/auto-upload no bloqueante (fuera del flujo de render)
        if (enableSha256Dedupe || enableAutoUpload) {
          window.setTimeout(() => {
            filesToUpload.slice(0, room).forEach((u) => {
              void runDuplicateCheck(u)
            })
          }, 0)
        }

        return nextFiles
      })
    },
    [enableAutoUpload, enableSha256Dedupe, maxFiles, runDuplicateCheck],
  )

  // Manejador para cuando se arrastran archivos sobre la zona
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  // Manejador para cuando se sale de la zona de arrastre
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  // Manejador para cuando se sueltan los archivos
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const droppedFiles = Array.from(e.dataTransfer.files)
      addFiles(droppedFiles)
    },
    [addFiles],
  )

  // Manejador para la selección de archivos mediante el input nativo
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files)
        addFiles(selectedFiles)
        // Corrección de bug: Limpiar el valor para permitir seleccionar el mismo archivo nuevamente si fue eliminado
        e.target.value = ''
      }
    },
    [addFiles],
  )

  // Función para eliminar un archivo específico por su ID
  const removeFile = useCallback(async (fileId: string) => {
    const current = filesRef.current.find((f) => f.id === fileId)
    if (!current) return

    if (
      current.uploadStatus === 'subiendo' ||
      current.uploadStatus === 'eliminando'
    ) {
      return
    }

    // Si nunca se subió a BD/Storage, solo remover local
    if (!current.archivoId) {
      setFiles((previousFiles) =>
        previousFiles.filter((uploadedFile) => uploadedFile.id !== fileId),
      )
      return
    }

    const prevStatus = current.uploadStatus
    const prevError = current.uploadError

    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, uploadStatus: 'eliminando', uploadError: undefined }
          : f,
      ),
    )

    try {
      await deleteArchivo({ archivoId: current.archivoId })

      setFiles((previousFiles) =>
        previousFiles.filter((uploadedFile) => uploadedFile.id !== fileId),
      )
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Error eliminando archivo.'

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, uploadStatus: prevStatus, uploadError: prevError }
            : f,
        ),
      )

      toast.error(message)
    }
  }, [])

  // Mantener la referencia actualizada de la función callback externa para evitar loops en useEffect
  useEffect(() => {
    onFilesChangeRef.current = onFilesChange
  }, [onFilesChange])

  // Notificar al componente padre cuando cambia la lista de archivos
  useEffect(() => {
    if (onFilesChangeRef.current) onFilesChangeRef.current(files)
  }, [files])

  // Scroll automático hacia abajo solo cuando se pasa de 0 a 1 o más archivos
  useEffect(() => {
    if (
      autoScrollToDropzone &&
      prevFilesLengthRef.current === 0 &&
      files.length > 0
    ) {
      // Usar un pequeño timeout para asegurar que el renderizado se complete
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)

      // Actualizar la referencia
      prevFilesLengthRef.current = files.length
      return () => clearTimeout(timer)
    }

    // Mantener sincronizada la referencia en otros casos
    prevFilesLengthRef.current = files.length
  }, [files.length, autoScrollToDropzone])

  // Determinar el icono a mostrar según la extensión del archivo
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText className="text-destructive h-4 w-4" />
      case 'doc':
      case 'docx':
        return <FileText className="text-info h-4 w-4" />
      default:
        return <File className="text-muted-foreground h-4 w-4" />
    }
  }

  return (
    <div className="space-y-3">
      {/* Elemento invisible para referencia de scroll */}
      <div ref={bottomRef} />

      {/* Área principal de dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'cursor-pointer rounded-xl border-2 border-dashed p-7 text-center transition-all duration-300',
          // Siempre usar borde por defecto a menos que se esté arrastrando
          'border-border hover:border-primary/50',
          isDragging && 'ring-primary ring-2 ring-offset-2',
        )}
      >
        <input
          type="file"
          accept={acceptedTypes}
          multiple
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
          disabled={files.length >= maxFiles}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer"
          aria-label="Seleccionar archivos"
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl transition-colors',
                isDragging
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-accent-foreground',
              )}
            >
              <Upload className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className="text-foreground text-sm font-medium">{title}</p>
              {description ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  {description}
                </p>
              ) : null}
              <p className="text-muted-foreground mt-1 text-xs">
                Formatos:{' '}
                {acceptedTypes
                  .replace(/\./g, '')
                  .toUpperCase()
                  .replace(/,/g, ', ')}
              </p>

              <div className="mt-2 flex items-center justify-center gap-1.5">
                <span
                  className={cn(
                    'text-primary text-xl font-bold',
                    files.length >= maxFiles ? 'text-destructive' : '',
                  )}
                >
                  {files.length}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium transition-colors',
                    files.length >= maxFiles
                      ? 'text-destructive'
                      : 'text-muted-foreground/80',
                  )}
                >
                  / {maxFiles} archivos (máximo)
                </span>
              </div>
            </div>
          </div>
        </label>
      </div>

      {/* Lista de archivos subidos (Orden inverso: más recientes primero) */}
      <div className="h-56 overflow-y-auto">
        {files.length > 0 && (
          <div className="space-y-2">
            {[...files].reverse().map((uploadedFile) => (
              <div
                key={uploadedFile.id}
                className={cn(
                  'bg-accent/50 border-border fade-in flex items-center gap-3 rounded-lg border p-3',
                  uploadedFile.uploadStatus === 'eliminando' && 'opacity-60',
                )}
              >
                {getFileIcon(uploadedFile.file.type)}
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {uploadedFile.file.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatFileSize(uploadedFile.file.size)}
                  </p>
                  {uploadedFile.uploadStatus === 'error' &&
                  uploadedFile.uploadError ? (
                    <p className="text-destructive mt-1 text-xs">
                      {uploadedFile.uploadError}
                    </p>
                  ) : null}
                </div>

                {uploadedFile.uploadStatus === 'subiendo' ||
                uploadedFile.uploadStatus === 'eliminando' ? (
                  <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                ) : uploadedFile.uploadStatus === 'exito' ? (
                  <CheckCircle2 className="text-success h-5 w-5" />
                ) : uploadedFile.uploadStatus === 'error' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => void retryUpload(uploadedFile.id)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reintentar
                  </Button>
                ) : null}

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => void removeFile(uploadedFile.id)}
                  disabled={
                    uploadedFile.uploadStatus === 'subiendo' ||
                    uploadedFile.uploadStatus === 'eliminando'
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
