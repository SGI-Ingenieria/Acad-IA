import { useState } from 'react'

import type { UploadedFile } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'

import { FileDropzone } from '@/components/planes/wizard/PasoDetallesPanel/FileDropZone'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface UploadFilesModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UploadFilesModal({ isOpen, onClose }: UploadFilesModalProps) {
  const [files, setFiles] = useState<Array<UploadedFile>>([])

  const handleFilesChange = (newFiles: Array<UploadedFile>) => {
    setFiles(newFiles)
    // Opcional: Si enableAutoUpload está activo, podrías cerrar el modal
    // cuando todos los archivos terminen de subir (status === 'success')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Subir nuevos archivos
          </DialogTitle>
          <DialogDescription>
            Arrastra tus documentos aquí. Se guardarán en el storage y se
            indexarán para la IA automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-grupo">
          <FileDropzone
            persistentFiles={files}
            onFilesChange={handleFilesChange}
            enableAutoUpload={true} // Esto dispara tu lógica de Supabase/OpenAI
            title="Área de carga"
            description="PDF, DOCX, TXT (Máx. 25MB)"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
