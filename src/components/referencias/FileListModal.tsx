/* eslint-disable import/order */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'
import { FileText } from 'lucide-react'

interface FileListModalProps {
  isOpen: boolean
  onClose: () => void
  planTitle: string
}

export function FileListModal({
  isOpen,
  onClose,
  planTitle,
}: FileListModalProps) {
  const files = [
    { name: 'Marco_Curricular_Nacional_2024.pdf', type: 'pdf' },
    { name: 'Perfiles_Egreso_Ingenieria.pdf', type: 'pdf' },
    { name: 'Competencias_Siglo_XXI.docx', type: 'docx' },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card text-card-foreground border-border p-6 shadow-2xl sm:max-w-[560px]">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Archivos usados
              </DialogTitle>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                Archivos utilizados en el plan de estudios{' '}
                <span className="text-foreground font-semibold">
                  {planTitle}
                </span>
              </p>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              {files.length} archivos
            </Badge>
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-3">
          {files.map((file) => (
            <div
              key={file.name}
              className="border-border/70 bg-muted/30 hover:bg-accent/40 hover:border-primary/20 flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-colors"
            >
              <div className="bg-background border-border/60 flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm">
                <FileText
                  className={cn(
                    'h-5 w-5',
                    file.type === 'pdf' ? 'text-destructive' : 'text-primary',
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">
                  {file.name}
                </p>
                <p className="text-muted-foreground mt-1 text-xs tracking-wide uppercase">
                  {file.type}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end border-t pt-4">
          <Button variant="outline" onClick={onClose} className="px-8">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
