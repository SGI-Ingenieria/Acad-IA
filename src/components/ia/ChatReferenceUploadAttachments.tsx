import { AlertTriangle, FileText, Loader2, RotateCcw, X } from 'lucide-react'

import type { ChatReferenceUploadItem } from '@/components/ia/chatReferenceUploads'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChatReferenceUploadAttachments({
  uploads,
  onRetry,
  onRemove,
}: {
  uploads: Array<ChatReferenceUploadItem>
  onRetry: (upload: ChatReferenceUploadItem) => void
  onRemove: (upload: ChatReferenceUploadItem) => void
}) {
  if (!uploads.length) return null

  return (
    <div
      className="flex flex-wrap gap-2 px-1 pt-1.5 pb-0.5"
      aria-label="Archivos que se están añadiendo"
      aria-live="polite"
    >
      {uploads.map((upload) => {
        const processing = upload.status === 'uploading'
        const transferred = processing && upload.progress >= 100
        return (
          <div
            key={upload.id}
            className="border-border bg-muted/60 animate-in fade-in zoom-in-95 flex max-w-full min-w-0 items-center gap-2 rounded-xl border px-2 py-1.5"
          >
            <span className="bg-background relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg">
              {upload.previewUrl ? (
                <img
                  src={upload.previewUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <FileText className="text-muted-foreground size-4" />
              )}
              <span
                className={
                  upload.status === 'error'
                    ? 'bg-destructive text-destructive-foreground absolute right-0.5 bottom-0.5 grid size-4 place-items-center rounded-full'
                    : 'bg-background/90 text-muted-foreground absolute right-0.5 bottom-0.5 grid size-4 place-items-center rounded-full shadow-sm'
                }
                aria-hidden="true"
              >
                {processing ? (
                  <Loader2 className="size-2.5 animate-spin" />
                ) : (
                  <AlertTriangle className="size-2.5" />
                )}
              </span>
            </span>

            <span className="min-w-0">
              <span className="block max-w-48 truncate text-xs font-medium">
                {upload.file.name}
              </span>
              <span
                className={
                  upload.status === 'error'
                    ? 'text-destructive flex items-center gap-1 text-[11px]'
                    : 'text-muted-foreground text-[11px]'
                }
              >
                {upload.status === 'error' ? (
                  <>
                    <AlertTriangle className="size-3 shrink-0" />
                    No se pudo subir
                  </>
                ) : transferred ? (
                  'Procesando archivo…'
                ) : (
                  `Subiendo ${upload.progress}% · ${formatFileSize(upload.file.size)}`
                )}
              </span>
            </span>

            {!processing ? (
              <div className="flex shrink-0 items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Reintentar la carga de ${upload.file.name}`}
                      onClick={() => onRetry(upload)}
                    >
                      <RotateCcw />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {upload.error ?? 'Reintentar carga'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar ${upload.file.name}`}
                      onClick={() => onRemove(upload)}
                    >
                      <X />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Quitar archivo</TooltipContent>
                </Tooltip>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
