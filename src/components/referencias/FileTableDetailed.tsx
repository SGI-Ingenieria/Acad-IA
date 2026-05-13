import {
  FileText,
  MoreVertical,
  Eye,
  Download,
  Trash2,
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
import { use, useEffect } from 'react'
import { Checkbox } from '../ui/checkbox'

interface Props {
  repositorioId?: string

  selectable?: boolean

  selectedFiles?: string[]

  onToggleFile?: (
    fileId: string,
    checked: boolean,
  ) => void
}

export function FileTableDetailed({
  repositorioId,
  selectable = false,
  selectedFiles = [],
  onToggleFile,
}: Props){
  const {
  data: repositorioArchivos,
  isLoading: loadingRepositorio,
} = useRepositorioFiles(repositorioId)

const {
  data: allFiles,
  isLoading: loadingFiles,
} = useFilesList()

const isGlobal = !repositorioId

const isLoading = isGlobal
  ? loadingFiles
  : loadingRepositorio

const archivos = isGlobal
  ? allFiles
  : repositorioArchivos

  const { mutate: getSignedUrl } =
    useFileSignedUrl()

  const {
    mutate: deleteFile,
    isPending: isDeleting,
  } = useDeleteOpenAIFile()
        
useEffect(() => {
  console.log(archivos);
}, [archivos]) 

  const formatBytes = (
    bytes?: number | null,
    decimals = 2,
  ) => {
    if (!bytes) return '0 Bytes'

    
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB']

    const i = Math.floor(
      Math.log(bytes) / Math.log(k),
    )

    return (
      parseFloat(
        (bytes / Math.pow(k, i)).toFixed(dm),
      ) +
      ' ' +
      sizes[i]
    )
  }

  const handleDelete = (
    archivoId: string,
  ) => {
    if (
      window.confirm(
        '¿Estás seguro de eliminar este archivo?',
      )
    ) {
      deleteFile({ archivoId })
    }
  }

  const handleDownload = (
    archivoId: string,
  ) => {
    getSignedUrl(
      { archivoId },
      {
        onSuccess: (data) => {
          window.open(
            data.signedUrl,
            '_blank',
          )
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Cargando archivos...
      </div>
    )
  }

  if (!archivos?.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Este repositorio no tiene archivos
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden shadow-sm">
      <Table>
  <TableHeader className="bg-muted/40">
  <TableRow>
    {selectable && (
      <TableHead className="w-[50px]" />
    )}

    <TableHead>
      Archivo
    </TableHead>

    <TableHead>
      Tipo
    </TableHead>

    <TableHead>
      Tamaño
    </TableHead>

    <TableHead>
      Estado
    </TableHead>

    <TableHead className="text-right">
      Fecha
    </TableHead>
  </TableRow>
</TableHeader>

  <TableBody>
  {archivos.map((item: any) => {
  const archivo = isGlobal
    ? item
    : item.archivos

    // quitar UUID inicial
    const nombreCompleto =
      archivo.path?.replace(
        /^[^-]+-[^-]+-[^-]+-[^-]+-[^-]+-/,
        '',
      ) || 'Sin nombre'

    // extensión
    const extension =
      nombreCompleto.split('.').pop()?.toUpperCase()

    return (
      <TableRow
        key={archivo.id}
        className="group hover:bg-muted/40 transition-colors"
      >

        {selectable && (
            <TableCell>
              <Checkbox
                checked={selectedFiles.includes(
                  archivo.id,
                )}
                onCheckedChange={(value) => {
                  onToggleFile?.(
                    archivo.id,
                    !!value,
                  )
                }}
              />
            </TableCell>
          )}

        <TableCell className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>

            <div className="flex flex-col max-w-[300px]">
              <span className="text-sm font-semibold text-foreground truncate">
                {nombreCompleto}
              </span>

              <span className="text-[10px] text-muted-foreground font-mono truncate">
                {archivo.openai_file_id}
              </span>
            </div>
          </div>
        </TableCell>

        {/* TIPO */}
        <TableCell>
          <Badge
            variant="secondary"
            className="text-[11px]"
          >
            {extension}
          </Badge>
        </TableCell>

        {/* TAMAÑO */}
        <TableCell>
          <Badge
            variant="outline"
            className="font-mono"
          >
            {formatBytes(archivo.size)}
          </Badge>
        </TableCell>

        {/* ESTADO */}
        <TableCell>
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary border-primary/20 text-[11px]"
          >
            Vinculado
          </Badge>
        </TableCell>

        {/* FECHA */}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              {new Date(
                archivo.created_at,
              ).toLocaleDateString()}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    handleDownload(
                      archivo.id,
                    )
                  }
                  className="gap-2 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  Previsualizar
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() =>
                    handleDownload(
                      archivo.id,
                    )
                  }
                  className="gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </DropdownMenuItem>

                <Separator className="my-1" />

                <DropdownMenuItem
                  onClick={() =>
                    handleDelete(
                      archivo.id,
                    )
                  }
                  disabled={isDeleting}
                  className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                >
                  <Trash2
                    className={cn(
                      'w-4 h-4',
                      isDeleting &&
                        'animate-spin',
                    )}
                  />

                  {isDeleting
                    ? 'Eliminando...'
                    : 'Eliminar'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    )
  })}
</TableBody>
</Table>
    </div>
  )
}