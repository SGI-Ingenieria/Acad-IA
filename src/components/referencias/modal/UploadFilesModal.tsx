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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir archivos</DialogTitle>
          <DialogDescription className="sr-only">
            Selecciona los archivos que se añadirán a la biblioteca.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-grupo">
          <FileDropzone
            persistentFiles={files}
            onFilesChange={handleFilesChange}
            enableAutoUpload={true}
            acceptedTypes=".pdf,.doc,.docx,.txt"
            title="Documentos de referencia"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
