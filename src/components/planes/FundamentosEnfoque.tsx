import { useMemo } from 'react'

import type { DatosGeneralesField } from '@/types/plan'

import { RichTextContent } from '@/components/editor/RichTextContent'
import { sanitizeHtml } from '@/components/editor/sanitize'
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
import { cn } from '@/lib/utils'

/**
 * Lectura enfocada de los tres fundamentos del plan.
 *
 * Existe porque revisarlos exige leerlos juntos —el perfil de egreso tiene que
 * ser alcanzable desde el de ingreso y responder a los fines— y en «Datos
 * generales» compiten con el resto de campos de la estructura. Aquí no se
 * edita: es una superficie de revisión y de presentación, con la lupa
 * tipográfica del canvas para proyectarlos sin recurrir al zoom del navegador.
 *
 * Se apoya en `Dialog` (Radix) en vez de en un portal propio para heredar el
 * cierre con Escape, el trampeo de foco y la semántica de diálogo modal.
 */
export function FundamentosEnfoque({
  open,
  onOpenChange,
  campos,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campos: Array<DatosGeneralesField>
}) {
  // La lupa es una lente de esta lectura, no un ajuste que se guarde: al cerrar
  // el diálogo el paso se descarta y la próxima apertura empieza al 100 %.
  const zoom = useZoomTipografico(1, open)

  const contenido = useMemo(
    () =>
      campos.map((campo) => ({
        clave: campo.clave,
        label: campo.label,
        html: sanitizeHtml(campo.value),
        vacio: !campo.value.replace(/<[^>]*>/g, '').trim(),
      })),
    [campos],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Superficie de lectura a pantalla completa: el ancho por defecto haría
        // ilegible un texto de varios párrafos y obligaría a desplazar dentro
        // de una caja pequeña, que es justo lo que esta vista evita.
        className={cn(
          'top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 rounded-none border-0 p-0 sm:max-w-none',
          zoom.contenedor.className,
        )}
        style={zoom.contenedor.style}
      >
        <DialogHeader className="border-border/60 flex-row items-center justify-between gap-4 border-b px-6 py-3 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Fundamentos del plan
          </DialogTitle>
          <DialogDescription className="sr-only">
            Perfil de ingreso, perfil de egreso y fines de aprendizaje del plan,
            en solo lectura.
          </DialogDescription>
          <ControlesZoomTipografico zoom={zoom} className="mr-8" />
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-10">
          <div className="ancho-zoom-tipografico mx-auto w-full space-y-12">
            {contenido.map((campo) => (
              <article key={campo.clave}>
                <h3 className="titulo-zoom-tipografico text-primary font-semibold tracking-wide">
                  {campo.label}
                </h3>
                <div className="mt-3">
                  {campo.vacio ? (
                    <p className="text-muted-foreground italic">
                      Todavía sin redactar.
                    </p>
                  ) : (
                    <RichTextContent html={campo.html} />
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
