import { MoreVertical, Eye, Download, Edit3, PlusCircle, Trash2 } from "lucide-react"

import { Button } from "../ui/button"
import { Separator } from "../ui/separator"
import { TableCell, TableRow } from "../ui/table"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function FileTableRow({ file }: { file: any }) {
  return (
    <TableRow className="group">
      <TableCell>{/* Nombre y Metadata */}</TableCell>
      <TableCell>{/* Tipo */}</TableCell>
      <TableCell>{/* Tamaño */}</TableCell>
      <TableCell>{/* Estado */}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-4">
          <div className="flex flex-col text-right">
            <span className="text-xs text-slate-500">{file.fecha}</span>
            <span className="text-[10px] text-slate-400">{file.autor}</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 outline-none">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2">
              <DropdownMenuItem className="gap-2 py-2 cursor-pointer">
                <Eye className="w-4 h-4 text-slate-500" /> Previsualizar
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 py-2 cursor-pointer">
                <Download className="w-4 h-4 text-slate-500" /> Descargar
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 py-2 cursor-pointer">
                <Edit3 className="w-4 h-4 text-slate-500" /> Editar metadatos
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 py-2 cursor-pointer">
                <PlusCircle className="w-4 h-4 text-slate-500" /> Agregar a repositorio
              </DropdownMenuItem>
              <Separator className="my-1" />
              <DropdownMenuItem className="gap-2 py-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                <Trash2 className="w-4 h-4" /> Descartar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  )
}