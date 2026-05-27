/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { useRouter } from '@tanstack/react-router'
import {
  FileText,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  Check,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { supabaseBrowser } from '@/data'
import {
  useDeleteOpenAIFile,
  useFileSignedUrl,
  useRepositorioFiles,
  useFilesList,
} from '@/data/hooks/useFiles'
import { cn } from '@/lib/utils'

interface Props {
  repositorioId?: string
  selectable?: boolean
  selectedFiles?: Array<string>
  onToggleFile?: (fileId: string, checked: boolean) => void
  viewType?: 'table' | 'custom-grid'
}

export function FileTableDetailed({
  repositorioId,
  selectable = false,
  selectedFiles = [],
  onToggleFile,
}: Props) {
  const { data: repositorioArchivos, isLoading: loadingRepositorio } =
    useRepositorioFiles(repositorioId)

  const { data: allFiles, isLoading: loadingFiles } = useFilesList()

  const isGlobal = !repositorioId

  const isLoading = isGlobal ? loadingFiles : loadingRepositorio
  const archivos = isGlobal ? allFiles : repositorioArchivos
  const router = useRouter()

  const { mutate: getSignedUrl } = useFileSignedUrl()
  const { mutate: deleteFile, isPending: isDeleting } = useDeleteOpenAIFile()

  if (!archivos) return null
  const formatBytes = (bytes?: number | null, decimals = 2) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
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

  const handleDelete = (archivoId: string) => {
    if (window.confirm('¿Estás seguro de eliminar este archivo?')) {
      deleteFile({
        archivoId,
        repositorioId: repositorioId!,
      })
      router.invalidate()
    }
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
    supabaseBrowser().storage.from('ai-storage').download(archivo.path)
  }

  if (isLoading) {
    return (
      <div className="text-muted-foreground p-8 text-center text-sm">
        Este repositorio no tiene archivos
      </div>
    )
  }

  const renderFileCard = (item: any, compact = false) => {
    const archivo = isGlobal ? item : item.archivos

    const nombreCompleto =
      archivo.path?.replace(/^[^-]+-[^-]+-[^-]+-[^-]+-[^-]+-/, '') ||
      'Sin nombre'

    const extension = nombreCompleto.split('.').pop()?.toUpperCase()
    const kind = getFileKind(nombreCompleto)
    const isSelected = selectedFiles.includes(archivo.id)

    return (
      <div
        key={archivo.id}
        onClick={() => {
          if (selectable) {
            onToggleFile?.(archivo.id, !isSelected)
          }
        }}
        className={cn(
          'group relative overflow-hidden rounded-3xl border transition-all select-none',
          compact ? 'p-4' : 'p-5',
          isSelected
            ? 'border-primary/30 bg-primary/5 shadow-[0_20px_45px_-30px_rgba(59,130,246,0.55)]'
            : 'border-border bg-background hover:border-primary/20 hover:-translate-y-0.5 hover:shadow-lg',
        )}
      >
        <div className="from-primary/8 absolute inset-x-0 top-0 h-20 bg-linear-to-b to-transparent" />
        <div className="bg-primary/5 absolute top-4 right-4 h-16 w-16 rounded-full blur-2xl" />

        <div className="relative flex h-full flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-2xl border',
                  compact ? 'h-12 w-12' : 'h-14 w-14',
                  isSelected
                    ? 'border-primary/30 bg-primary/10'
                    : 'border-border bg-muted/60',
                )}
              >
                <FileText
                  className={cn(
                    compact ? 'h-5 w-5' : 'h-6 w-6',
                    isSelected ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
              </div>

              <div className="min-w-0">
                <p className="text-foreground min-h-10 text-sm leading-5 font-semibold [overflow-wrap:anywhere]">
                  {nombreCompleto}
                </p>
                <div className="text-muted-foreground mt-1 text-xs">
                  {new Date(archivo.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:bg-muted h-8 w-8"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handlePreview(archivo)}
                    className="cursor-pointer gap-2"
                  >
                    <Eye className="h-4 w-4" /> Previsualizar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDownload(archivo)}
                    className="cursor-pointer gap-2"
                  >
                    <Download className="h-4 w-4" /> Descargar
                  </DropdownMenuItem>
                  <Separator className="my-1" />
                  <DropdownMenuItem
                    onClick={() => handleDelete(archivo)}
                    disabled={isDeleting}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2"
                  >
                    <Trash2
                      className={cn('h-4 w-4', isDeleting && 'animate-spin')}
                    />
                    {isDeleting ? 'Desvinculando...' : 'Desvincular'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {extension && (
              <Badge variant="secondary" className="text-[11px]">
                {extension}
              </Badge>
            )}
            <Badge variant="outline" className="text-[11px]">
              {kind}
            </Badge>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-[11px]"
            >
              {formatBytes(archivo.size)}
            </Badge>
          </div>

          <div className="mt-auto flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">
                Repositorio
              </div>
              <div className="text-foreground text-xs font-medium">
                {isGlobal ? 'Global' : 'Repositorio vinculado'}
              </div>
            </div>

            {selectable ? (
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                  isSelected
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/30 bg-background',
                )}
              >
                {isSelected && (
                  <Check className="text-primary-foreground h-4 w-4 stroke-3" />
                )}
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">
                {formatBytes(archivo.size)}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
      {archivos.map((item: any) => renderFileCard(item, false))}
    </div>
  )
}
