/* eslint-disable jsx-a11y/label-has-associated-control */
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  useDeleteOpenAIFile,
  useFileSignedUrl,
  useRepositorioFiles,
  useFilesList,
} from '@/data/hooks/useFiles'

import { cn } from '@/lib/utils'
import { Checkbox } from '../ui/checkbox'
import { useRouter } from '@tanstack/react-router'

interface Props {
  repositorioId?: string
  selectable?: boolean
  selectedFiles?: string[]
  onToggleFile?: (fileId: string, checked: boolean) => void
  viewType?: 'table' | 'custom-grid'
}

export function FileTableDetailed({
  repositorioId,
  selectable = false,
  selectedFiles = [],
  onToggleFile,
  viewType = 'table',
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

  const formatBytes = (bytes?: number | null, decimals = 2) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
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
  getSignedUrl(
    {
      path: archivo.path,
      preview: false,
    },
    {
      onSuccess: (data) => {
        window.open(data.finalUrl, '_blank')
      },
      onError: (err) => {
        console.error('Error download archivo:', err)
      },
    },
  )
}

  if (isLoading) {
    return (
      <div className="text-muted-foreground p-8 text-center text-sm">
        Cargando archivos...
      </div>
    )
  }

  if (!archivos?.length) {
    return (
      <div className="text-muted-foreground p-8 text-center text-sm">
        Este repositorio no tiene archivos
      </div>
    )
  }

  // ==========================================
  // VISTA 1: DISEÑO PERSONALIZADO (MOCKUP MODAL)
  // ==========================================
  if (viewType === 'custom-grid') {
    return (
      <div className="w-full space-y-2">
        {archivos.map((item: any) => {
          const archivo = isGlobal ? item : item.archivos

          const nombreCompleto =
            archivo.path?.replace(/^[^-]+-[^-]+-[^-]+-[^-]+-[^-]+-/, '') ||
            'Sin nombre'

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
                'flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all select-none',
                isSelected
                  ? 'bg-primary/10 border-primary text-foreground'
                  : 'bg-background border-border hover:border-muted-foreground/50 text-foreground',
              )}
            >
              {selectable && (
                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    isSelected
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/50',
                  )}
                >
                  {isSelected && (
                    <Check className="text-primary-foreground h-3 w-3 stroke-[3]" />
                  )}
                </div>
              )}

              <div
                className={cn(
                  'shrink-0 rounded-lg p-2',
                  isSelected ? 'bg-primary/20' : 'bg-muted',
                )}
              >
                <FileText
                  className={cn(
                    'h-5 w-5',
                    isSelected ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-semibold">
                  {nombreCompleto}
                </p>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>{formatBytes(archivo.size)}</span>
                  <span>•</span>
                  <span>
                    {new Date(archivo.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Acciones separadas a la extrema derecha */}
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
                      onClick={() => handleDelete(archivo.id)}
                      disabled={isDeleting}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2"
                    >
                      <Trash2
                        className={cn('h-4 w-4', isDeleting && 'animate-spin')}
                      />
                      {isDeleting ? 'Eliminando...' : 'Eliminar'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ==========================================
  // VISTA 2: TU TABLA TRADICIONAL CORREGIDA
  // ==========================================
  return (
    <div className="border-border bg-background overflow-hidden rounded-xl border shadow-sm">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            {selectable && <TableHead className="w-[50px]" />}
            <TableHead>Archivo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Tamaño</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="w-[60px] text-center">
              Acciones
            </TableHead>{' '}
            {/* Cabecera de acciones independiente */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {archivos.map((item: any) => {
            const archivo = isGlobal ? item : item.archivos

            const nombreCompleto =
              archivo.path?.replace(/^[^-]+-[^-]+-[^-]+-[^-]+-[^-]+-/, '') ||
              'Sin nombre'

            const extension = nombreCompleto.split('.').pop()?.toUpperCase()

            return (
              <TableRow
                key={archivo.id}
                className="group hover:bg-muted/40 transition-colors"
              >
                {selectable && (
                  <TableCell>
                    <Checkbox
                      checked={selectedFiles.includes(archivo.id)}
                      onCheckedChange={(value) => {
                        onToggleFile?.(archivo.id, !!value)
                      }}
                    />
                  </TableCell>
                )}

                <TableCell className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-lg p-2">
                      <FileText className="text-primary h-5 w-5" />
                    </div>
                    <div className="flex max-w-[300px] flex-col">
                      <span className="text-foreground truncate text-sm font-semibold">
                        {nombreCompleto}
                      </span>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge variant="secondary" className="text-[11px]">
                    {extension}
                  </Badge>
                </TableCell>

                <TableCell>
                  <Badge variant="outline" className="font-mono">
                    {formatBytes(archivo.size)}
                  </Badge>
                </TableCell>

                <TableCell>
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20 text-[11px]"
                  >
                    Vinculado
                  </Badge>
                </TableCell>

                {/* COLUMNA DE FECHA SEPARADA */}
                <TableCell className="whitespace-nowrap">
                  <span className="text-muted-foreground text-xs font-medium">
                    {new Date(archivo.created_at).toLocaleDateString()}
                  </span>
                </TableCell>

                {/* COLUMNA DE ACCIONES INDEPENDIENTE */}
                <TableCell className="text-center">
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
                        onClick={() => handleDelete(archivo.id)}
                        disabled={isDeleting}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2"
                      >
                        <Trash2
                          className={cn(
                            'h-4 w-4',
                            isDeleting && 'animate-spin',
                          )}
                        />
                        {isDeleting ? 'Desvinculando...' : 'Desvincular'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
