import {
  FileText,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
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
  useVectorStoreFiles,
} from '@/data/hooks/useFiles'
import { cn } from '@/lib/utils'

interface Props {
  vectorStoreId?: string
}

export function FileTableDetailed({
  vectorStoreId,
}: Props) {
  const {
    data: archivos ,
    isLoading,
  } = useVectorStoreFiles(vectorStoreId)

  const { mutate: getSignedUrl } = useFileSignedUrl()
  

  const {
    mutate: deleteFile,
    isPending: isDeleting,
  } = useDeleteOpenAIFile()

  const formatBytes = (
    bytes: number,
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

  const handleDelete = (archivoId: string) => {
    
    if (
      window.confirm(
        '¿Estás seguro de que deseas eliminar este archivo?',
      )
    ) {
      deleteFile({ archivoId })
    }
  }

  const handleDownload = (archivoId: string) => {
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
      <div className="p-8 text-center text-slate-500">
        Cargando archivos...
      </div>
    )
  }

  if (!archivos?.data?.length) {
    return (
      <div className="p-8 text-center text-slate-500">
        Este repositorio no tiene archivos
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
      <Table>
        <TableHeader className="bg-slate-50/50">
          <TableRow>
            <TableHead className="py-4">
              Archivo
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
          {archivos.data.map((archivo) => {
            const isIndexed =
              archivo.status === 'completed'

            return (
              <TableRow
                key={archivo.id}
                className="group hover:bg-slate-50/50 transition-colors"
              >
                <TableCell className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-white border border-transparent group-hover:border-blue-100">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>

                    <div className="flex flex-col max-w-[300px]">
                      <span className="text-sm font-semibold text-slate-700 truncate">
                        {archivo.id}
                      </span>

                      <span className="text-[10px] text-slate-400 font-mono truncate">
                        {archivo.vector_store_id}
                      </span>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge
                    variant="secondary"
                    className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2"
                  >
                    {formatBytes(
                      archivo.usage_bytes,
                    )}
                  </Badge>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    {isIndexed ? (
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-200 text-[11px]"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Indexado
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200 text-[11px]"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        Procesando
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-xs font-medium text-slate-500">
                      {new Date(
                        archivo.created_at * 1000,
                      ).toLocaleDateString()}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="end"
                        className="w-52"
                      >
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
                          className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
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