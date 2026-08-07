import { AlertTriangle, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function SelectionQuote({
  referencia,
}: {
  referencia: {
    textoSeleccionado?: string
    contenedor?: string
    from?: number
    until?: number
  }
}) {
  const texto = referencia.textoSeleccionado ?? ''
  const contenedor = referencia.contenedor

  const handleLocate = () => {
    if (!contenedor) return
    const element = document.querySelector(contenedor)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Resaltar temporalmente
    element.classList.add('ring-primary', 'ring-2')
    setTimeout(() => {
      element.classList.remove('ring-primary', 'ring-2')
    }, 1500)
  }

  return (
    <div className="border-primary/30 bg-muted/30 my-relacionado px-control py-relacionado rounded-r-md border-l-2">
      <p className="text-muted-foreground line-clamp-3 text-xs italic">
        “{texto}”
      </p>
      <div className="mt-micro gap-relacionado flex items-center">
        {contenedor && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-micro px-relacionado h-6 text-[11px]"
                onClick={handleLocate}
              >
                <ExternalLink className="h-3 w-3" /> Ver en contexto
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ir al texto seleccionado</TooltipContent>
          </Tooltip>
        )}
        <span className="text-muted-foreground gap-micro flex items-center text-[11px]">
          <AlertTriangle className="h-3 w-3" />
          Puede estar desactualizado si el contenido cambió.
        </span>
      </div>
    </div>
  )
}
