/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import {
  FileText,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  Check,
} from 'lucide-react'
import { useState } from 'react'

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  useDeleteOpenAIFile,
  useFileSignedUrl,
  useRepositorioFiles,
  useFilesList,
  useFileDownload,
} from '@/data/hooks/useFiles'
import { formatFileDisplayName } from '@/lib/display-safe'
import { cn } from '@/lib/utils'

interface Props {
  repositorioId?: string
  selectable?: boolean
  selectedFiles?: Array<string>
  onToggleFile?: (fileId: string, checked: boolean) => void
  viewType?: 'cards' | 'list'
}

export function FileTableDetailed({
  repositorioId,
  selectable = false,
  selectedFiles = [],
  onToggleFile,
  viewType = 'cards',
}: Props) {
  const { data: repositorioArchivos, isLoading: loadingRepositorio } =
    useRepositorioFiles(repositorioId)

  const { data: allFiles, isLoading: loadingFiles } = useFilesList()

  const isGlobal = !repositorioId
  const isLoading = isGlobal ? loadingFiles : loadingRepositorio
  const archivos = isGlobal ? allFiles : repositorioArchivos

  const { mutate: getSignedUrl } = useFileSignedUrl()
  const { mutate: downloadFile } = useFileDownload()
  const { mutate: deleteFile, isPending: isDeleting } = useDeleteOpenAIFile()

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const formatBytes = (bytes?: number | null, decimals = 2) => {
    if (!bytes) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
  }

  const getFileKind = (name: string) => {
    const extension = name.split('.').pop()?.toUpperCase()

    if (!extension) return 'Archivo'

    if (['PDF', 'DOC', 'DOCX', 'TXT', 'RTF'].includes(extension)) {
      return 'Documento'
    }

    if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(extension)) {
      return 'Imagen'
    }

    if (['XLS', 'XLSX', 'CSV', 'TSV'].includes(extension)) {
      return 'Datos'
    }

    return extension
  }

  const cleanFileName = (path?: string | null) => formatFileDisplayName(path)

  const getArchivo = (item: any) => {
    return isGlobal ? item : item.archivos
  }

  const getFileInfo = (archivo: any) => {
    const nombreCompleto = cleanFileName(archivo?.path)
    const extension = nombreCompleto.split('.').pop()?.toUpperCase()
    const kind = getFileKind(nombreCompleto)
    const isSelected = selectedFiles.includes(archivo.id)

    return {
      nombreCompleto,
      extension,
      kind,
      isSelected,
    }
  }

  const toggleArchivo = (archivoId: string, isSelected: boolean) => {
    if (!selectable) return

    onToggleFile?.(archivoId, !isSelected)
  }

  const handleKeyToggle = (
    event: React.KeyboardEvent<HTMLDivElement>,
    archivoId: string,
    isSelected: boolean,
  ) => {
    if (!selectable) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleArchivo(archivoId, isSelected)
    }
  }

  const handleDelete = (archivoId: string) => {
    setConfirmDeleteId(archivoId)
  }

  const handleConfirmDelete = () => {
    if (!confirmDeleteId) return
    deleteFile({
      archivoId: confirmDeleteId,
      repositorioId: repositorioId!,
    })
    setConfirmDeleteId(null)
  }

  const handlePreview = (archivo: any) => {
    getSignedUrl(
      {
        path: archivo.path,
        preview: true,
      },
      {
        onSuccess: (data) => {
          window.open(data.finalUrl, '_blank')
        },
        onError: (err) => {
          console.error('Error preview archivo:', err)
        },
      },
    )
  }

  const handleDownload = (archivo: any) => {
    downloadFile(
      { path: archivo.path },
      {
        onSuccess: (data) => {
          const url = window.URL.createObjectURL(data)
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', cleanFileName(archivo.path))
          document.body.appendChild(link)
          link.click()
          link.remove()
        },
        onError: (err) => {
          console.error('Error descargando archivo:', err)
        },
      },
    )
  }

  const renderFileActions = (archivo: any) => {
    return (
      <div onClick={(event) => event.stopPropagation()} className="shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-muted/80 h-9 w-9 rounded-xl"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation()
                handlePreview(archivo)
              }}
              className="cursor-pointer gap-2"
            >
              <Eye className="h-4 w-4" />
              Previsualizar
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation()
                handleDownload(archivo)
              }}
              className="cursor-pointer gap-2"
            >
              <Download className="h-4 w-4" />
              Descargar
            </DropdownMenuItem>

            <Separator className="my-1" />

            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation()
                handleDelete(archivo.id)
              }}
              disabled={isDeleting}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2"
            >
              <Trash2 className={cn('h-4 w-4', isDeleting && 'animate-spin')} />
              {isDeleting ? 'Desvinculando...' : 'Desvincular'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  const renderSelectedIndicator = (isSelected: boolean) => {
    if (!selectable || !isSelected) return null

    return (
      <div className="bg-primary text-primary-foreground shadow-primary/25 ring-background absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full shadow-lg ring-4">
        <Check className="h-4 w-4 stroke-3" />
      </div>
    )
  }

  const renderFileCard = (item: any) => {
    const archivo = getArchivo(item)
    const { nombreCompleto, extension, kind, isSelected } = getFileInfo(archivo)

    return (
      <div
        key={archivo.id}
        role={selectable ? 'button' : undefined}
        tabIndex={selectable ? 0 : undefined}
        aria-pressed={selectable ? isSelected : undefined}
        onClick={() => toggleArchivo(archivo.id, isSelected)}
        onKeyDown={(event) => handleKeyToggle(event, archivo.id, isSelected)}
        className={cn(
          'group bg-background relative min-h-55 overflow-hidden rounded-3xl border p-5 transition-all duration-300',
          'hover:shadow-primary/5 hover:-translate-y-1 hover:shadow-xl',
          selectable && 'cursor-pointer select-none',
          isSelected
            ? 'border-primary/40 bg-primary/4 shadow-primary/10 ring-primary/20 shadow-xl ring-2'
            : 'border-border hover:border-primary/25',
        )}
      >
        <div className="from-primary/10 pointer-events-none absolute inset-0 bg-linear-to-br via-transparent to-transparent opacity-80" />
        <div className="bg-primary/10 pointer-events-none absolute -top-14 -right-14 h-32 w-32 rounded-full blur-3xl transition-transform duration-300 group-hover:scale-125" />

        {renderSelectedIndicator(isSelected)}

        <div className="relative flex h-full flex-col">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition-colors',
                isSelected
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-muted/60 text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary',
              )}
            >
              <FileText className="h-6 w-6" />
            </div>

            {renderFileActions(archivo)}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1.5">
              <h3 className="text-foreground line-clamp-2 text-sm leading-5 font-semibold tracking-tight">
                {nombreCompleto}
              </h3>

              <p className="text-muted-foreground text-xs">
                {new Date(archivo.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {extension && (
                <Badge
                  variant="secondary"
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                >
                  {extension}
                </Badge>
              )}

              <Badge
                variant="outline"
                className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              >
                {kind}
              </Badge>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <span className="text-muted-foreground text-xs">
              {formatBytes(archivo.size)}
            </span>

            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium',
                isGlobal
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary/10 text-primary',
              )}
            >
              {isGlobal ? 'Global' : 'Vinculado'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const renderFileRow = (item: any) => {
    const archivo = getArchivo(item)
    const { nombreCompleto, extension, kind, isSelected } = getFileInfo(archivo)

    return (
      <div
        key={archivo.id}
        role={selectable ? 'button' : undefined}
        tabIndex={selectable ? 0 : undefined}
        aria-pressed={selectable ? isSelected : undefined}
        onClick={() => toggleArchivo(archivo.id, isSelected)}
        onKeyDown={(event) => handleKeyToggle(event, archivo.id, isSelected)}
        className={cn(
          'group bg-background relative grid min-h-26 grid-cols-[56px_minmax(0,1fr)_auto_auto] items-center gap-4 overflow-hidden rounded-2xl border p-4 transition-all duration-300',
          'hover:border-primary/25 hover:shadow-primary/5 hover:shadow-lg',
          selectable && 'cursor-pointer select-none',
          isSelected
            ? 'border-primary/60 bg-primary/4.5 ring-primary/20 shadow-primary/10 shadow-lg ring-2'
            : 'border-border',
        )}
      >
        <div className="bg-primary pointer-events-none absolute inset-y-0 left-0 w-1 opacity-0 transition-opacity group-hover:opacity-40" />

        <div
          className={cn(
            'flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border transition-colors',
            isSelected
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-muted/60 text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary',
          )}
        >
          <FileText className="h-5 w-5" />
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="text-foreground truncate text-sm font-semibold tracking-tight">
              {nombreCompleto}
            </h3>
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span>{formatBytes(archivo.size)}</span>
            <span>•</span>
            <span>{new Date(archivo.created_at).toLocaleDateString()}</span>
            <span>•</span>
            <span>{isGlobal ? 'Global' : 'Repositorio vinculado'}</span>
          </div>
        </div>

        <div className="hidden min-w-42.5 items-center justify-end gap-2 md:flex">
          {extension && (
            <Badge
              variant="secondary"
              className="rounded-full px-2.5 py-0.5 text-[11px]"
            >
              {extension}
            </Badge>
          )}

          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-0.5 text-[11px]"
          >
            {kind}
          </Badge>
        </div>

        <div
          className="flex min-w-35 items-center justify-end gap-3"
          onClick={(event) => event.stopPropagation()}
        >
          {selectable && (
            <div className="flex min-w-23 justify-end">
              {isSelected ? (
                <Badge className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 text-[10px]">
                  Seleccionado
                </Badge>
              ) : (
                <span className="text-muted-foreground text-[11px] opacity-0 transition-opacity group-hover:opacity-100">
                  Seleccionar
                </span>
              )}
            </div>
          )}

          {selectable && (
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-primary/25 shadow-md'
                  : 'border-border bg-muted/40 group-hover:text-muted-foreground text-transparent',
              )}
            >
              {isSelected && <Check className="h-4 w-4 stroke-3" />}
            </div>
          )}

          {renderFileActions(archivo)}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="text-muted-foreground rounded-3xl border border-dashed p-10 text-center text-sm">
        Cargando archivos...
      </div>
    )
  }

  const confirmDialog = (
    <AlertDialog
      open={confirmDeleteId !== null}
      onOpenChange={(open) => {
        if (!open) setConfirmDeleteId(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Desvincular este archivo?</AlertDialogTitle>
          <AlertDialogDescription>
            El archivo dejará de estar asociado a este repositorio. No se
            elimina el archivo subido a la biblioteca, solo el vínculo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Desvincular
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (!archivos || archivos.length === 0) {
    return (
      <>
        <div className="text-muted-foreground rounded-3xl border border-dashed p-10 text-center text-sm">
          Este repositorio no tiene archivos
        </div>
        {confirmDialog}
      </>
    )
  }

  if (viewType === 'list') {
    return (
      <>
        <div className="space-y-3">{archivos.map(renderFileRow)}</div>
        {confirmDialog}
      </>
    )
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {archivos.map(renderFileCard)}
      </div>
      {confirmDialog}
    </>
  )
}
