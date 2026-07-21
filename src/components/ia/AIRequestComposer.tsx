import {
  ArrowUp,
  Check,
  FileText,
  Folder,
  Globe2,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ReasoningEffortSelect } from './ReasoningEffortSelect'
import { VoiceDictation } from './VoiceDictation'

import type { ReasoningEffortOption } from './ReasoningEffortSelect'
import type { DocumentoArchivo } from '@/data/api/documentos.api'
import type { Ref } from 'react'

import {
  GlobalFileDropOverlay,
  normalizarArchivosReferencia,
  obtenerArchivosDelPortapapeles,
} from '@/components/referencias/GlobalFileDropOverlay'
import { ReferenceLibrary } from '@/components/referencias/ReferenceLibrary'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useBibliotecaReferencias,
  useSubirDocumento,
} from '@/data/hooks/useDocumentos'
import { notify } from '@/lib/toast'

type Props = {
  value: string
  onChange: (value: string) => void
  reasoningEffort?: ReasoningEffortOption
  onReasoningEffortChange?: (value: ReasoningEffortOption) => void
  selectedFileIds?: Array<string>
  onSelectedFileIdsChange?: (ids: Array<string>) => void
  selectedCollectionIds?: Array<string>
  onSelectedCollectionIdsChange?: (ids: Array<string>) => void
  webSearchEnabled: boolean
  onWebSearchEnabledChange: (enabled: boolean) => void
  showWebSearch?: boolean
  showAttachments?: boolean
  showReasoning?: boolean
  showVoice?: boolean
  onUnresolvedUploadsChange?: (count: number) => void
  placeholder: string
  disabled?: boolean
  compact?: boolean
  textareaRef?: Ref<HTMLTextAreaElement>
  /**
   * Cuando se define, el compositor adopta la variante compacta en una sola
   * fila: la altura arranca en un párrafo y crece con el contenido, Enter envía
   * (Shift+Enter inserta salto) y el botón de envío queda dentro del input. Es
   * la variante para peticiones puntuales de campo.
   */
  onSubmit?: () => void
  /** Muestra el spinner en el botón de envío inline. */
  submitting?: boolean
  /** Deshabilita el envío inline aun con texto (p. ej. cargas sin resolver). */
  submitDisabled?: boolean
}

export type PendingUpload = {
  id: string
  file: File
  status: 'uploading' | 'resolving' | 'failed'
  fileId?: string
  failureKind?: 'upload' | 'processing'
}

const MAX_REFERENCES = 5

export function claveCargaReferencia(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`
}

export function reservarArchivosReferencia(
  files: Array<File>,
  occupiedSlots: number,
  reservedKeys: ReadonlySet<string>,
) {
  const available = Math.max(0, MAX_REFERENCES - occupiedSlots)
  return normalizarArchivosReferencia(files, Number.POSITIVE_INFINITY)
    .filter((file) => !reservedKeys.has(claveCargaReferencia(file)))
    .slice(0, available)
}

export function reconciliarCargasPendientes(
  pendingUploads: Array<PendingUpload>,
  files: Array<Pick<DocumentoArchivo, 'id' | 'status'>>,
) {
  const byId = new Map(files.map((file) => [file.id, file]))
  return pendingUploads.flatMap((pending) => {
    if (!pending.fileId) return [pending]
    const persisted = byId.get(pending.fileId)
    if (!persisted) return [pending]
    if (persisted.status === 'ready') return []
    if (
      persisted.status === 'failed' ||
      persisted.status === 'partial_error' ||
      persisted.status === 'deleted'
    ) {
      return pending.status === 'failed' && pending.failureKind === 'processing'
        ? [pending]
        : [
            {
              ...pending,
              status: 'failed' as const,
              failureKind: 'processing' as const,
            },
          ]
    }
    return pending.status === 'resolving'
      ? [pending]
      : [
          {
            ...pending,
            status: 'resolving' as const,
            failureKind: undefined,
          },
        ]
  })
}

export function contarCargasSinResolver(
  pendingUploads: Array<Pick<PendingUpload, 'fileId'>>,
) {
  return pendingUploads.filter((item) => !item.fileId).length
}

function FilePreview({ file }: { file?: File }) {
  const previewUrl = useMemo(
    () => (file?.type.startsWith('image/') ? URL.createObjectURL(file) : null),
    [file],
  )
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )

  return previewUrl ? (
    <img
      src={previewUrl}
      alt=""
      className="size-5 rounded object-cover"
      aria-hidden="true"
    />
  ) : (
    <FileText className="size-3" />
  )
}

export function AIRequestComposer({
  value,
  onChange,
  reasoningEffort,
  onReasoningEffortChange = () => undefined,
  selectedFileIds = [],
  onSelectedFileIdsChange = () => undefined,
  selectedCollectionIds = [],
  onSelectedCollectionIdsChange = () => undefined,
  webSearchEnabled,
  onWebSearchEnabledChange,
  showWebSearch = true,
  showAttachments = true,
  showReasoning = true,
  showVoice = false,
  onUnresolvedUploadsChange,
  placeholder,
  disabled,
  compact = false,
  textareaRef,
  onSubmit,
  submitting = false,
  submitDisabled = false,
}: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [pendingUploads, setPendingUploads] = useState<Array<PendingUpload>>([])
  const [localFilesById, setLocalFilesById] = useState<Record<string, File>>({})
  const pendingUploadsRef = useRef<Array<PendingUpload>>([])
  const unresolvedUploadsCallbackRef = useRef(onUnresolvedUploadsChange)
  const selectedFileIdsRef = useRef(selectedFileIds)
  const selectedCollectionIdsRef = useRef(selectedCollectionIds)
  const dropScopeRef = useRef<HTMLElement>(null)
  const library = useBibliotecaReferencias({ query: '', sort: 'updated_desc' })
  const upload = useSubirDocumento()
  const libraryFiles = useMemo(
    () => library.data?.files ?? [],
    [library.data?.files],
  )
  const selectedFiles = libraryFiles.filter((file) =>
    selectedFileIds.includes(file.id),
  )
  const selectedCollections = (library.data?.collections ?? []).filter(
    (collection) => selectedCollectionIds.includes(collection.id),
  )
  const selectedCollectionFileIds = useMemo(
    () =>
      new Set(selectedCollections.flatMap((collection) => collection.fileIds)),
    [selectedCollections],
  )
  const resolvedPendingIds = useMemo(
    () =>
      new Set(
        pendingUploads.flatMap((item) => (item.fileId ? [item.fileId] : [])),
      ),
    [pendingUploads],
  )
  const unresolvedUploads = useMemo(
    () => contarCargasSinResolver(pendingUploads),
    [pendingUploads],
  )
  const visibleSelectedFiles = selectedFiles.filter(
    (file) =>
      !selectedCollectionFileIds.has(file.id) &&
      !resolvedPendingIds.has(file.id),
  )

  useEffect(() => {
    selectedFileIdsRef.current = selectedFileIds
  }, [selectedFileIds])

  useEffect(() => {
    selectedCollectionIdsRef.current = selectedCollectionIds
  }, [selectedCollectionIds])

  useEffect(() => {
    unresolvedUploadsCallbackRef.current = onUnresolvedUploadsChange
  }, [onUnresolvedUploadsChange])

  useEffect(() => {
    unresolvedUploadsCallbackRef.current?.(unresolvedUploads)
  }, [unresolvedUploads])

  useEffect(
    () => () => {
      unresolvedUploadsCallbackRef.current?.(0)
    },
    [],
  )

  const replacePendingUploads = useCallback(
    (updater: (current: Array<PendingUpload>) => Array<PendingUpload>) => {
      const next = updater(pendingUploadsRef.current)
      pendingUploadsRef.current = next
      setPendingUploads(next)
    },
    [],
  )

  const replaceSelectedFileIds = useCallback(
    (ids: Array<string>) => {
      const next = Array.from(new Set(ids)).slice(0, MAX_REFERENCES)
      selectedFileIdsRef.current = next
      onSelectedFileIdsChange(next)
    },
    [onSelectedFileIdsChange],
  )

  const replaceSelectedCollectionIds = useCallback(
    (ids: Array<string>) => {
      const next = Array.from(new Set(ids))
      selectedCollectionIdsRef.current = next
      onSelectedCollectionIdsChange(next)
    },
    [onSelectedCollectionIdsChange],
  )

  const setSelected = useCallback(
    (fileId: string, selected: boolean) => {
      const current = selectedFileIdsRef.current
      if (!selected) {
        replaceSelectedFileIds(current.filter((id) => id !== fileId))
        replaceSelectedCollectionIds(
          selectedCollectionIdsRef.current.filter((collectionId) => {
            const collection = library.data?.collections.find(
              (item) => item.id === collectionId,
            )
            return !collection?.fileIds.includes(fileId)
          }),
        )
        setLocalFilesById((localFiles) => {
          const { [fileId]: _removed, ...rest } = localFiles
          return rest
        })
        return
      }
      if (current.length >= MAX_REFERENCES) {
        notify.warning('Puedes utilizar hasta cinco archivos por solicitud.')
        return
      }
      replaceSelectedFileIds([...current, fileId])
    },
    [
      library.data?.collections,
      replaceSelectedCollectionIds,
      replaceSelectedFileIds,
    ],
  )

  const uploadPending = useCallback(
    async (item: PendingUpload) => {
      if (item.fileId) {
        replaceSelectedFileIds(
          selectedFileIdsRef.current.filter((id) => id !== item.fileId),
        )
        setLocalFilesById((current) => {
          const { [item.fileId!]: _removed, ...rest } = current
          return rest
        })
      }
      replacePendingUploads((current) =>
        current.map((pending) =>
          pending.id === item.id
            ? {
                ...pending,
                status: 'uploading',
                fileId: undefined,
                failureKind: undefined,
              }
            : pending,
        ),
      )
      try {
        const result = await upload.mutateAsync(item.file)
        if (!result.fileId)
          throw new Error('No se recibió el archivo procesado.')
        setLocalFilesById((current) => ({
          ...current,
          [result.fileId]: item.file,
        }))
        replaceSelectedFileIds([...selectedFileIdsRef.current, result.fileId])
        replacePendingUploads((current) =>
          current.map((pending) =>
            pending.id === item.id
              ? { ...pending, status: 'resolving', fileId: result.fileId }
              : pending,
          ),
        )
      } catch {
        replacePendingUploads((current) =>
          current.map((pending) =>
            pending.id === item.id
              ? {
                  ...pending,
                  status: 'failed',
                  fileId: undefined,
                  failureKind: 'upload',
                }
              : pending,
          ),
        )
      }
    },
    [replacePendingUploads, replaceSelectedFileIds, upload],
  )

  const uploadAndSelect = useCallback(
    async (files: Array<File>) => {
      const selectedSet = new Set(selectedFileIdsRef.current)
      const pendingReservations = pendingUploadsRef.current.filter(
        (item) => !item.fileId || !selectedSet.has(item.fileId),
      ).length
      const reservedKeys = new Set(
        pendingUploadsRef.current.map((item) =>
          claveCargaReferencia(item.file),
        ),
      )
      const candidates = reservarArchivosReferencia(
        files,
        selectedSet.size + pendingReservations,
        reservedKeys,
      )
      if (
        normalizarArchivosReferencia(files, Number.POSITIVE_INFINITY).length >
        candidates.length
      ) {
        notify.warning(
          selectedSet.size + pendingReservations >= MAX_REFERENCES
            ? 'Puedes utilizar hasta cinco archivos por solicitud.'
            : 'Ese archivo ya se está añadiendo.',
        )
      }
      if (!candidates.length) return
      const pending = candidates.map((file) => ({
        id: `pending:${claveCargaReferencia(file)}`,
        file,
        status: 'uploading' as const,
      }))
      replacePendingUploads((current) => [...current, ...pending])
      await Promise.all(pending.map((item) => uploadPending(item)))
    },
    [replacePendingUploads, uploadPending],
  )

  const toggleCollection = useCallback(
    (collectionId: string, selected: boolean) => {
      const collection = library.data?.collections.find(
        (item) => item.id === collectionId,
      )
      if (!collection) return
      const readyIds = collection.fileIds.filter(
        (fileId) =>
          libraryFiles.find((file) => file.id === fileId)?.status === 'ready',
      )
      if (selected) {
        const nextFiles = Array.from(
          new Set([...selectedFileIdsRef.current, ...readyIds]),
        )
        if (!readyIds.length || nextFiles.length > MAX_REFERENCES) {
          notify.warning(
            !readyIds.length
              ? 'Esta colección todavía no tiene archivos listos para IA.'
              : 'La colección excede el límite de cinco referencias.',
          )
          return
        }
        replaceSelectedCollectionIds([
          ...selectedCollectionIdsRef.current,
          collection.id,
        ])
        replaceSelectedFileIds(nextFiles)
        return
      }
      const remainingCollections = selectedCollectionIdsRef.current.filter(
        (id) => id !== collection.id,
      )
      const retainedByAnotherCollection = new Set(
        (library.data?.collections ?? [])
          .filter((item) => remainingCollections.includes(item.id))
          .flatMap((item) => item.fileIds),
      )
      replaceSelectedCollectionIds(remainingCollections)
      replaceSelectedFileIds(
        selectedFileIdsRef.current.filter(
          (fileId) =>
            !collection.fileIds.includes(fileId) ||
            retainedByAnotherCollection.has(fileId),
        ),
      )
    },
    [
      library.data?.collections,
      libraryFiles,
      replaceSelectedCollectionIds,
      replaceSelectedFileIds,
    ],
  )

  useEffect(() => {
    replacePendingUploads((current) => {
      const next = reconciliarCargasPendientes(current, libraryFiles)
      return next.length === current.length &&
        next.every((item, index) => item === current[index])
        ? current
        : next
    })
  }, [libraryFiles, replacePendingUploads])

  const removePending = useCallback(
    (item: PendingUpload) => {
      replacePendingUploads((current) =>
        current.filter((pending) => pending.id !== item.id),
      )
      if (item.fileId) setSelected(item.fileId, false)
    },
    [replacePendingUploads, setSelected],
  )

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = obtenerArchivosDelPortapapeles(event.clipboardData)
      if (!files.length) return
      event.preventDefault()
      void uploadAndSelect(files)
    },
    [uploadAndSelect],
  )

  const canSubmit = Boolean(
    onSubmit && !disabled && !submitDisabled && value.trim(),
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Petición puntual: Enter envía, Shift+Enter inserta un salto de línea.
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        if (canSubmit) onSubmit?.()
      }
    },
    [canSubmit, onSubmit],
  )

  const appendTranscript = useCallback(
    (text: string) => {
      const separator = value && !/\s$/.test(value) ? ' ' : ''
      onChange(`${value}${separator}${text}`)
    },
    [onChange, value],
  )
  const uploadProgressByKey = useMemo(
    () =>
      new Map(
        libraryFiles
          .filter((file) => file.id.startsWith('upload:'))
          .map((file) => [
            file.id,
            file.uploadProgress ?? (file.status === 'failed' ? 0 : undefined),
          ]),
      ),
    [libraryFiles],
  )

  // Variante compacta en una fila para peticiones puntuales de campo: altura de
  // un párrafo que crece con el contenido, Enter envía y el botón vive dentro
  // del input. Sin adjuntos, búsqueda web ni razonamiento (el consumidor los
  // oculta) para no robar espacio vertical.
  if (onSubmit) {
    return (
      <section aria-label="Solicitud para la inteligencia artificial">
        <div className="border-input bg-card focus-within:border-ring/50 focus-within:ring-ring/15 flex items-end gap-1 rounded-3xl border py-1 pr-1.5 pl-3 shadow-sm focus-within:ring-2">
          {!isRecording && (
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              maxLength={14_000}
              rows={1}
              disabled={disabled}
              className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-sm leading-6 shadow-none focus-visible:ring-0"
            />
          )}
          {showVoice && (
            <div
              className={
                isRecording ? 'mb-0.5 flex min-w-0 flex-1' : 'mb-0.5 shrink-0'
              }
            >
              <VoiceDictation
                onTranscript={appendTranscript}
                onRecordingChange={setIsRecording}
                disabled={disabled}
              />
            </div>
          )}
          {!isRecording && (
            <Button
              type="button"
              size="icon"
              className="mb-0.5 size-9 shrink-0 rounded-full"
              aria-label="Solicitar cambio"
              disabled={!canSubmit || submitting}
              onClick={onSubmit}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section
      ref={dropScopeRef}
      aria-label="Solicitud para la inteligencia artificial"
    >
      {showAttachments && (
        <GlobalFileDropOverlay
          scopeRef={dropScopeRef}
          onFiles={uploadAndSelect}
          acceptPaste
        />
      )}
      <div className="border-input bg-card focus-within:border-ring/50 focus-within:ring-ring/15 rounded-3xl border p-2 shadow-sm focus-within:ring-2">
        {showAttachments &&
        (visibleSelectedFiles.length ||
          selectedCollections.length ||
          pendingUploads.length) ? (
          <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2">
            {selectedCollections.map((collection) => (
              <span
                key={collection.id}
                className="bg-muted text-muted-foreground flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
              >
                <Folder className="size-3.5 shrink-0" />
                <span className="max-w-48 truncate">{collection.name}</span>
                <button
                  type="button"
                  className="hover:text-foreground rounded-full"
                  aria-label={`Quitar ${collection.name}`}
                  onClick={() => toggleCollection(collection.id, false)}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {pendingUploads.map((item) => (
              <span
                key={item.id}
                className="bg-muted text-muted-foreground flex min-w-0 items-center gap-2 rounded-full py-1 pr-2 pl-1 text-xs"
              >
                <span className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-full">
                  <FilePreview file={item.file} />
                  {item.status === 'uploading' ? (
                    <span className="bg-background/70 absolute inset-0 grid place-items-center">
                      <Loader2 className="size-3 animate-spin" />
                    </span>
                  ) : item.status === 'resolving' ? (
                    <span className="bg-background/70 absolute inset-0 grid place-items-center">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block max-w-48 truncate">
                    {item.file.name}
                  </span>
                  <span
                    className={
                      item.status === 'failed'
                        ? 'text-destructive block text-[10px]'
                        : 'block text-[10px]'
                    }
                  >
                    {item.status === 'uploading'
                      ? `Subiendo ${
                          uploadProgressByKey.get(
                            `upload:${item.file.name}:${item.file.size}:${item.file.lastModified}`,
                          ) ?? 0
                        }%`
                      : item.status === 'resolving'
                        ? 'Procesando referencia…'
                        : item.failureKind === 'processing'
                          ? 'No se pudo preparar'
                          : 'No se pudo subir'}
                  </span>
                </span>
                {item.status === 'failed' ? (
                  <>
                    <button
                      type="button"
                      className="hover:text-foreground rounded-full"
                      aria-label={`Reintentar ${item.file.name}`}
                      onClick={() => void uploadPending(item)}
                    >
                      <RefreshCw className="size-3" />
                    </button>
                    <button
                      type="button"
                      className="hover:text-foreground rounded-full"
                      aria-label={`Quitar ${item.file.name}`}
                      onClick={() => removePending(item)}
                    >
                      <X className="size-3" />
                    </button>
                  </>
                ) : null}
              </span>
            ))}
            {visibleSelectedFiles.map((file) => (
              <span
                key={file.id}
                className="bg-muted text-muted-foreground flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
              >
                <FilePreview file={localFilesById[file.id]} />
                <span className="max-w-48 truncate">{file.display_name}</span>
                <button
                  type="button"
                  className="hover:text-foreground rounded-full"
                  aria-label={`Quitar ${file.display_name}`}
                  onClick={() => setSelected(file.id, false)}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={showAttachments ? handlePaste : undefined}
          placeholder={placeholder}
          maxLength={14_000}
          disabled={disabled}
          className={
            compact
              ? 'min-h-16 resize-none border-0 bg-transparent px-3 py-2 text-sm shadow-none focus-visible:ring-0'
              : 'min-h-32 resize-none border-0 bg-transparent px-3 py-2 text-base shadow-none focus-visible:ring-0'
          }
        />

        {showAttachments || showWebSearch || showReasoning ? (
          <div className="flex items-center gap-2 px-1 pb-1">
            {showAttachments && (
              <Popover open={libraryOpen} onOpenChange={setLibraryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full"
                    aria-label="Añadir referencias"
                    disabled={disabled}
                  >
                    <Plus className="size-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="top"
                  className="max-h-[min(70vh,620px)] w-[min(92vw,520px)] overflow-y-auto p-3"
                >
                  <ReferenceLibrary
                    compact
                    showUploadAction
                    selectedFileIds={selectedFileIds}
                    selectedCollectionIds={selectedCollectionIds}
                    onToggleFile={(file, selected) =>
                      setSelected(file.id, selected)
                    }
                    onToggleCollection={(collection, selected) =>
                      toggleCollection(collection.id, selected)
                    }
                    onUploadFiles={uploadAndSelect}
                    onUploadComplete={(fileId) => setSelected(fileId, true)}
                  />
                </PopoverContent>
              </Popover>
            )}
            {showWebSearch && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`size-9 rounded-full ${
                      webSearchEnabled ? 'bg-primary/10 text-primary' : ''
                    }`}
                    aria-label={
                      webSearchEnabled
                        ? 'Desactivar búsqueda web'
                        : 'Activar búsqueda web'
                    }
                    aria-pressed={webSearchEnabled}
                    disabled={disabled}
                    onClick={() => onWebSearchEnabledChange(!webSearchEnabled)}
                  >
                    <Globe2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {webSearchEnabled
                    ? 'Búsqueda web activada'
                    : 'Usar búsqueda web'}
                </TooltipContent>
              </Tooltip>
            )}
            {showReasoning && (
              <ReasoningEffortSelect
                compact
                value={reasoningEffort}
                onChange={onReasoningEffortChange}
                disabled={disabled}
              />
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
