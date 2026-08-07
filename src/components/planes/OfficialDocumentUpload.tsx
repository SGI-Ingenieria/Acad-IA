import { ExternalLink, FileText, Loader2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'

import type { PlanRegistroOficialInput } from '@/data/api/plans.api'
import type { UUID } from '@/data/types/domain'

import { Button } from '@/components/ui/button'
import {
  officialPlanDocument_get_signed_url,
  OFFICIAL_PLAN_DOCUMENTS_BUCKET,
  uploadOfficialPlanDocument,
} from '@/data/api/files.api'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

type OfficialDocumentValue = Pick<
  PlanRegistroOficialInput,
  | 'documentoArchivoId'
  | 'documentoBucket'
  | 'documentoPath'
  | 'documentoNombre'
  | 'documentoMime'
  | 'documentoSize'
  | 'documentoUrl'
>

function basename(path: string | null | undefined) {
  if (!path) return ''
  const parts = path.split('/').filter(Boolean)
  return parts.at(-1) ?? path
}

function formatBytes(value: number | null | undefined) {
  if (!value) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function OfficialDocumentUpload({
  planId,
  value,
  disabled,
  compact = false,
  className,
  onChange,
}: {
  planId: UUID
  value: OfficialDocumentValue
  disabled?: boolean
  compact?: boolean
  className?: string
  onChange: (value: OfficialDocumentValue) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [opening, setOpening] = useState(false)

  const documentName =
    value.documentoNombre ||
    basename(value.documentoPath) ||
    'Documento oficial'
  const documentMeta = [
    value.documentoMime,
    formatBytes(value.documentoSize),
  ].filter(Boolean)
  const hasStorageDocument = Boolean(value.documentoPath)
  const hasDocument = hasStorageDocument || Boolean(value.documentoUrl)

  const handleUpload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadOfficialPlanDocument({ planId, file })
      onChange({
        documentoArchivoId: result.archivoId,
        documentoBucket: result.bucket,
        documentoPath: result.path,
        documentoNombre: result.nombre,
        documentoMime: result.mime,
        documentoSize: result.size,
        documentoUrl: null,
      })
      notify.success('Documento oficial subido.')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo subir el documento oficial.'
      notify.error(message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleOpen = async () => {
    if (!hasDocument) return
    setOpening(true)
    try {
      if (value.documentoPath) {
        const { finalUrl } = await officialPlanDocument_get_signed_url({
          bucket: value.documentoBucket || OFFICIAL_PLAN_DOCUMENTS_BUCKET,
          path: value.documentoPath,
          preview: true,
          expiresIn: 3600,
        })
        window.open(finalUrl, '_blank', 'noopener,noreferrer')
        return
      }

      if (value.documentoUrl) {
        window.open(value.documentoUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo abrir el documento oficial.'
      notify.error(message)
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className={cn('bg-background p-control rounded-lg border', className)}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        disabled={disabled || uploading}
        onChange={(event) => void handleUpload(event.target.files?.[0])}
      />

      <div className="gap-control flex flex-col">
        {hasDocument ? (
          <div className="gap-control flex min-w-0 items-start">
            <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{documentName}</p>
              {documentMeta.length > 0 && (
                <p className="text-muted-foreground mt-micro text-xs">
                  {documentMeta.join(' · ')}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground gap-control flex items-center text-sm">
            <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
              <FileText className="h-4 w-4" />
            </div>
            <span>Sin documento cargado.</span>
          </div>
        )}

        <div
          className={cn(
            'gap-relacionado flex flex-col',
            !compact && 'sm:flex-row sm:justify-end',
          )}
        >
          {hasDocument && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpen}
              disabled={opening}
            >
              {opening ? (
                <Loader2 className="mr-relacionado h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-relacionado h-4 w-4" />
              )}
              Abrir
            </Button>
          )}
          <Button
            type="button"
            variant={hasDocument ? 'secondary' : 'default'}
            size="sm"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-relacionado h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-relacionado h-4 w-4" />
            )}
            {hasDocument ? 'Reemplazar archivo' : 'Subir archivo'}
          </Button>
        </div>
      </div>
    </div>
  )
}
