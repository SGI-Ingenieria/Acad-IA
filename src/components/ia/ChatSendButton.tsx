import { Loader2, Send, Square } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * `true` cuando el dispositivo no tiene hover fino (táctiles). En esos casos el
 * gesto "hover para revelar cancelar" no existe, así que la cancelación se
 * confirma con un pequeño sheet/popover (§11).
 */
function useCoarsePointer() {
  const [isCoarse, setIsCoarse] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const query = window.matchMedia('(hover: none), (pointer: coarse)')
    const update = () => setIsCoarse(query.matches)

    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return isCoarse
}

/**
 * Máquina de estados visual del botón principal del composer (ver §6 del
 * diseño): Enviar → Generando → Cancelar.
 *
 * - `send`: estado normal, icono de avión. Lift + scale en hover.
 * - `busy` + cancelable (puntero fino): el icono de carga hace crossfade a un
 *   icono de stop al hacer hover, y el fondo vira a un tono cálido para anunciar
 *   la interrupción; el clic cancela directamente.
 * - `busy` + cancelable (puntero grueso/táctil): un toque abre un popover de
 *   confirmación "¿Cancelar generación?" (§11), ya que no hay hover.
 * - `busy` sin posibilidad de cancelar todavía (sin responseId): sigue girando,
 *   sin revelar cancelación.
 * - `cancelling`: spinner bloqueado mientras se confirma la interrupción.
 */
export function ChatSendButton({
  mode,
  canCancel,
  disabled = false,
  onSend,
  onCancel,
}: {
  mode: 'send' | 'busy' | 'cancelling'
  /** El mensaje en curso puede cancelarse (tiene responseId). */
  canCancel?: boolean
  /** Sólo aplica al estado `send`: input vacío. */
  disabled?: boolean
  onSend: () => void
  onCancel: () => void
}) {
  const isCoarse = useCoarsePointer()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isBusy = mode === 'busy' || mode === 'cancelling'
  const isCancelling = mode === 'cancelling'
  // El hover revela "Cancelar" sólo cuando realmente se puede cancelar.
  const revealCancel = mode === 'busy' && Boolean(canCancel)

  // Si la generación termina (o ya no es cancelable) cerramos el popover.
  useEffect(() => {
    if (!revealCancel && confirmOpen) setConfirmOpen(false)
  }, [confirmOpen, revealCancel])

  const tooltip = !isBusy
    ? 'Enviar solicitud'
    : isCancelling
      ? 'Cancelando respuesta…'
      : canCancel
        ? 'Generando respuesta. Haz clic para cancelar.'
        : 'Generando respuesta…'

  const ariaLabel = !isBusy
    ? 'Enviar solicitud'
    : canCancel
      ? 'Cancelar respuesta'
      : 'Generando respuesta'

  const handleClick = () => {
    if (isCancelling) return
    if (isBusy) {
      if (!canCancel) return
      // En táctil no hay hover: pedimos confirmación explícita.
      if (isCoarse) {
        setConfirmOpen((open) => !open)
        return
      }
      onCancel()
      return
    }
    onSend()
  }

  const confirmCancel = () => {
    setConfirmOpen(false)
    onCancel()
  }

  return (
    <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <PopoverAnchor asChild>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleClick}
                disabled={isBusy ? !canCancel || isCancelling : disabled}
                aria-label={ariaLabel}
                aria-haspopup={revealCancel && isCoarse ? 'dialog' : undefined}
                aria-expanded={
                  revealCancel && isCoarse ? confirmOpen : undefined
                }
                data-mode={mode}
                className={cn(
                  'group relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border shadow-sm transition-all duration-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:h-11 md:w-11',
                  'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0',
                  // Enviar
                  !isBusy &&
                    'border-border/70 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/30 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95',
                  // Generando (variante "ocupado" dentro de la familia primaria)
                  isBusy &&
                    'border-primary/30 bg-primary/85 text-primary-foreground focus-visible:ring-primary/30',
                  // Crossfade del fondo a cálido al hover (puntero fino), o tono
                  // cálido persistente cuando el popover de confirmación abre.
                  revealCancel &&
                    'hover:border-destructive/40 hover:bg-destructive/90 focus-visible:ring-destructive/40',
                  revealCancel &&
                    confirmOpen &&
                    'border-destructive/40 bg-destructive/90',
                )}
              >
                {/* Stack de iconos: cada uno aparece según el estado */}
                {!isBusy ? (
                  <Send size={15} />
                ) : (
                  <>
                    {/* Loader (estado base ocupado / cancelando) */}
                    <Loader2
                      size={15}
                      className={cn(
                        'animate-spin transition-opacity duration-200',
                        revealCancel && 'group-hover:opacity-0',
                        revealCancel && confirmOpen && 'opacity-0',
                      )}
                    />
                    {/* Stop (revelado al hover en fino, o con popover abierto) */}
                    {revealCancel && (
                      <Square
                        size={13}
                        fill="currentColor"
                        className={cn(
                          'absolute opacity-0 transition-opacity duration-200 group-hover:opacity-100',
                          confirmOpen && 'opacity-100',
                        )}
                      />
                    )}
                  </>
                )}
              </button>
            </TooltipTrigger>
          </PopoverAnchor>
          {/* En táctil el tooltip no aporta; lo ocultamos cuando hay confirmación. */}
          {!(isCoarse && revealCancel) && (
            <TooltipContent>{tooltip}</TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        side="top"
        align="end"
        className="w-56 p-3"
        role="alertdialog"
        aria-label="Confirmar cancelación de la generación"
      >
        <p className="text-foreground text-sm font-semibold">
          ¿Cancelar generación?
        </p>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          Se detendrá la respuesta que la IA está generando.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs"
            onClick={() => setConfirmOpen(false)}
          >
            Seguir
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8 px-3 text-xs"
            onClick={confirmCancel}
          >
            Sí, cancelar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
