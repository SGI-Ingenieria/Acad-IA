import {
  Download,
  FileText,
  GitBranch,
  Loader2,
  MoreHorizontal,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import type { CarboneTemplate } from '@/data'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePlantillas, usePlantillasCrud } from '@/data'
import { fetchPlantillaDocx } from '@/data/api/document.api'
import { cn } from '@/lib/utils'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

export function TemplateCard({
  tpl,
  isActive,
  extension = '.docx',
  onSelect,
  onDelete,
  onAddVersion,
}: {
  tpl: CarboneTemplate
  isActive: boolean
  /** Extensión usada para nombrar el archivo al descargar (default `.docx`). */
  extension?: string
  onSelect: () => void
  onDelete: () => void
  onAddVersion: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const effectiveId = tpl.id || tpl.versionId

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const blob = await fetchPlantillaDocx(effectiveId)
      const name = tpl.name
        ? `${tpl.name}${extension}`
        : `plantilla${extension}`
      triggerDownload(blob, name)
    } catch (error) {
      toast.error('No se pudo descargar la plantilla')
      console.log('Error downloading plantilla:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
      <div
        className={cn(
          'border-border/60 flex items-center gap-4 rounded-xl border p-4 transition-colors',
          isActive
            ? 'border-primary/30 bg-primary/5 border-l-primary border-l-2'
            : 'hover:bg-muted/40',
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            isActive ? 'bg-primary/10' : 'bg-muted',
          )}
        >
          <FileText
            className={cn(
              'h-5 w-5',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-sm font-semibold',
                isActive ? 'text-foreground' : 'text-foreground',
              )}
            >
              {tpl.name ?? 'Plantilla sin nombre'}
            </span>
            {isActive && (
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 border px-1.5 py-0 text-xs font-medium">
                <Star className="h-2.5 w-2.5 fill-current" /> Activa
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span>{formatBytes(tpl.size)}</span>
            <span>·</span>
            <span>{formatDate(tpl.createdAt)}</span>
            {tpl.id && (
              <>
                <span>·</span>
                <span>Versión disponible</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Descargar plantilla</TooltipContent>
          </Tooltip>

          {!isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSelect}
              className="h-8 gap-1.5 px-2.5 text-xs"
            >
              <Star className="h-3.5 w-3.5" /> Usar
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isActive && (
                <DropdownMenuItem onClick={onSelect}>
                  <Star className="mr-2 h-4 w-4" /> Usar esta plantilla
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onAddVersion}>
                <GitBranch className="mr-2 h-4 w-4" /> Subir nueva versión
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{tpl.name ?? 'esta plantilla'}</strong> de
              Carbone. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDelete(false)
                onDelete()
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function PlantillasTab({
  estructuraId,
  templateId,
  onTemplateSelect,
}: {
  estructuraId: string
  templateId?: string | null
  onTemplateSelect: (id: string | null) => void
}) {
  const { data: plantillas = [], isLoading } = usePlantillas(estructuraId)
  const crud = usePlantillasCrud(estructuraId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [addVersionTo, setAddVersionTo] = useState<string | null>(null)

  const triggerUpload = (existingId?: string) => {
    setAddVersionTo(existingId ?? null)
    fileRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.docx')) {
      toast.error('Solo se aceptan archivos .docx')
      return
    }
    const currentExistingId = addVersionTo
    setAddVersionTo(null)
    setUploading(true)
    try {
      const result = await crud.upload.mutateAsync({
        file,
        estructuraId,
        existingId: currentExistingId ?? undefined,
      })
      const newId = result.id ?? result.templateId
      if (newId && !templateId) {
        onTemplateSelect(newId)
      }
      if (currentExistingId) {
        toast.success('Nueva versión subida correctamente')
      } else {
        toast.success('Plantilla subida correctamente')
      }
    } catch {
      toast.error('No se pudo subir la plantilla')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (tpl: CarboneTemplate) => {
    const effectiveId = tpl.id || tpl.versionId
    try {
      await crud.remove.mutateAsync(effectiveId)
      if (templateId === effectiveId) onTemplateSelect(null)
      toast.success('Plantilla eliminada')
    } catch {
      toast.error('No se pudo eliminar la plantilla')
    }
  }

  const handleSelect = (tpl: CarboneTemplate) => {
    const effectiveId = tpl.id || tpl.versionId
    if (!effectiveId) {
      toast.error('Esta plantilla no tiene una referencia técnica válida')
      return
    }
    onTemplateSelect(effectiveId)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">Plantillas Word</p>
          <p className="text-muted-foreground text-sm">
            Archivos .docx usados para generar documentos con esta estructura
          </p>
        </div>
        <Button size="sm" onClick={() => triggerUpload()} disabled={uploading}>
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Subir plantilla
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* List */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && plantillas.length === 0 && (
        <div className="border-border/60 flex flex-col items-center gap-3 rounded-xl border border-dashed py-12">
          <div className="bg-muted rounded-xl p-3">
            <FileText className="text-muted-foreground h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-foreground text-sm font-medium">
              Sin plantillas
            </p>
            <p className="text-muted-foreground text-xs">
              Sube un archivo .docx para generar documentos con esta estructura.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => triggerUpload()}>
            <Upload className="mr-2 h-4 w-4" /> Subir plantilla
          </Button>
        </div>
      )}

      {!isLoading && plantillas.length > 0 && (
        <div className="space-y-2">
          {plantillas.map((tpl) => {
            const effectiveId = tpl.id || tpl.versionId
            return (
              <TemplateCard
                key={effectiveId}
                tpl={tpl}
                isActive={
                  !!templateId &&
                  (templateId === tpl.id || templateId === tpl.versionId)
                }
                onSelect={() => handleSelect(tpl)}
                onDelete={() => handleDelete(tpl)}
                onAddVersion={() => triggerUpload(tpl.id || undefined)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
