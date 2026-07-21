import { Download, FileDown, Loader2, Presentation } from 'lucide-react'
import { useRef } from 'react'

import type { PaqueteTipo } from '@/data/api/paquetes.api'
import type { RecursoTipo } from '@/data/api/recursos.api'
import type { Tables } from '@/types/supabase'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RECURSO_TIPO_SINGULAR_LABEL } from '@/data/api/recursos.api'
import {
  useExportarContenido,
  usePrevisualizarContenido,
} from '@/data/hooks/usePaquetes'

const DESCARGAS_POR_TIPO: Record<
  RecursoTipo,
  Array<{ tipo: PaqueteTipo; label: string; icon: typeof Download }>
> = {
  outline_presentacion: [
    {
      tipo: 'pptx_bundle',
      label: 'Descargar presentación (PPTX)',
      icon: Presentation,
    },
    { tipo: 'html_bundle', label: 'Descargar página web', icon: FileDown },
  ],
  apunte: [
    { tipo: 'html_bundle', label: 'Descargar página web', icon: FileDown },
    { tipo: 'scorm_1_2', label: 'Descargar SCORM 1.2', icon: Download },
  ],
  quiz: [
    { tipo: 'html_bundle', label: 'Descargar página web', icon: FileDown },
    { tipo: 'scorm_1_2', label: 'Descargar SCORM 1.2', icon: Download },
  ],
  ejercicios: [
    { tipo: 'html_bundle', label: 'Descargar página web', icon: FileDown },
    { tipo: 'scorm_1_2', label: 'Descargar SCORM 1.2', icon: Download },
  ],
  actividad: [
    { tipo: 'html_bundle', label: 'Descargar página web', icon: FileDown },
    { tipo: 'scorm_1_2', label: 'Descargar SCORM 1.2', icon: Download },
  ],
  rubrica: [
    { tipo: 'html_bundle', label: 'Descargar página web', icon: FileDown },
    { tipo: 'scorm_1_2', label: 'Descargar SCORM 1.2', icon: Download },
  ],
  recursos_externos: [
    { tipo: 'html_bundle', label: 'Descargar página web', icon: FileDown },
  ],
}

export function RecursoPreviewModal({
  recurso,
  asignaturaId,
  open,
  onOpenChange,
}: {
  recurso: Tables<'learning_objects'> | null
  asignaturaId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Query dependiente: solo carga con el modal abierto y un recurso elegido.
  const previsualizar = usePrevisualizarContenido(
    open && recurso ? { asignaturaId, objectIds: [recurso.id] } : null,
  )
  const exportar = useExportarContenido(asignaturaId)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  if (!recurso) return null

  const opciones = DESCARGAS_POR_TIPO[recurso.tipo]
  const html = previsualizar.data?.html

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-lg">{recurso.titulo}</DialogTitle>
          <DialogDescription>
            {RECURSO_TIPO_SINGULAR_LABEL[recurso.tipo]} — Vista previa
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex shrink-0 flex-wrap gap-2">
          {opciones.map((opcion) => {
            const Icon = opcion.icon
            const isPending =
              exportar.isPending && exportar.variables.tipo === opcion.tipo

            return (
              <Button
                key={opcion.tipo}
                size="sm"
                variant="outline"
                disabled={exportar.isPending}
                onClick={() =>
                  exportar.mutate({
                    tipo: opcion.tipo,
                    objectIds: [recurso.id],
                  })
                }
              >
                {isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                )}
                {opcion.label}
              </Button>
            )
          })}
        </div>

        <div className="bg-muted relative mt-2 min-h-[320px] flex-1 overflow-hidden rounded-md border">
          {previsualizar.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          )}
          {html && (
            <iframe
              ref={iframeRef}
              title={`Preview ${recurso.titulo}`}
              srcDoc={html}
              sandbox="allow-scripts"
              className="h-full w-full"
              style={{ minHeight: '480px' }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
