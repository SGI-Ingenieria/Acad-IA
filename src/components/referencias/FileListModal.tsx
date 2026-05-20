/* eslint-disable import/order */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { Button } from "../ui/button";

interface FileListModalProps {
  isOpen: boolean;
  onClose: () => void;
  planTitle: string;
}

export function FileListModal({ isOpen, onClose, planTitle }: FileListModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Archivos usados</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Archivos utilizados en plan de estudios: <span className="font-semibold text-foreground">{planTitle}</span>
          </p>
        </DialogHeader>

        <div className="mt-6 space-y-3">
          {[
            { name: "Marco_Curricular_Nacional_2024.pdf", type: "pdf" },
            { name: "Perfiles_Egreso_Ingenieria.pdf", type: "pdf" },
            { name: "Competencias_Siglo_XXI.docx", type: "docx" },
          ].map((file) => (
            <div key={file.name} className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-xl border border-transparent hover:border-slate-200 transition-colors cursor-pointer">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <FileText className={cn("w-6 h-6", file.type === 'pdf' ? "text-red-500" : "text-blue-500")} />
              </div>
              <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={onClose} className="px-8">Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}