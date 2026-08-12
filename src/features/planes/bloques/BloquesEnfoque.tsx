import type { LineaPlan } from '@/data'

import {
  ControlesZoomTipografico,
  useZoomTipografico,
} from '@/components/editor/zoom-tipografico'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { descripcionBloque } from '@/lib/bloques-conocimiento'
import { colorLineaCurricular } from '@/lib/linea-curricular-colors'
import { cn } from '@/lib/utils'

export function BloquesEnfoque({
  open,
  onOpenChange,
  bloques,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bloques: Array<LineaPlan>
}) {
  const zoom = useZoomTipografico(1, open)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        spacing="flush"
        className={cn(
          'top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] rounded-none border-0 sm:max-w-none',
          zoom.contenedor.className,
        )}
        style={zoom.contenedor.style}
      >
        <DialogHeader className="border-border/60 gap-grupo px-seccion py-control flex-row items-center justify-between border-b text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Bloques de conocimiento
          </DialogTitle>
          <DialogDescription className="sr-only">
            Lectura ordenada de los cuerpos de conocimiento que estructuran el
            plan.
          </DialogDescription>
          <ControlesZoomTipografico zoom={zoom} className="mr-region" />
        </DialogHeader>

        <div className="px-seccion py-pagina overflow-y-auto">
          <div className="ancho-zoom-tipografico space-y-pagina mx-auto w-full">
            {bloques.map((bloque, index) => {
              const descripcion = descripcionBloque(bloque)
              const color = colorLineaCurricular(bloque, index)

              return (
                <article key={bloque.id} className="scroll-m-24">
                  <div className="gap-control flex items-center">
                    <span
                      className="h-8 w-1 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <h3
                      className="titulo-bloque-zoom font-semibold tracking-tight"
                      style={{ color }}
                    >
                      {bloque.nombre}
                    </h3>
                  </div>
                  <p className="mt-grupo whitespace-pre-wrap">
                    {descripcion || (
                      <span className="text-muted-foreground italic">
                        Todavía sin describir.
                      </span>
                    )}
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
