import { Loader2, Send, Square } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Máquina de estados visual del botón principal del composer (ver §6 del
 * diseño): Enviar → Generando → Cancelar (al hover sobre Generando).
 *
 * - `send`: estado normal, icono de avión. Lift + scale en hover.
 * - `busy` + cancelable: el icono de carga hace crossfade a un icono de stop
 *   al hacer hover, y el fondo vira a un tono cálido (acento) para anunciar la
 *   interrupción. Tooltip explícito de cancelación.
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
  const isBusy = mode === 'busy' || mode === 'cancelling'
  const isCancelling = mode === 'cancelling'
  // El hover revela "Cancelar" sólo cuando realmente se puede cancelar.
  const revealCancel = mode === 'busy' && Boolean(canCancel)

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
      if (canCancel) onCancel()
      return
    }
    onSend()
  }

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            disabled={isBusy ? !canCancel || isCancelling : disabled}
            aria-label={ariaLabel}
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
              // Crossfade del fondo a cálido al hover, cuando se puede cancelar
              revealCancel &&
                'hover:border-destructive/40 hover:bg-destructive/90 focus-visible:ring-destructive/40',
            )}
          >
            {/* Stack de iconos: cada uno aparece según el estado, con crossfade */}
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
                  )}
                />
                {/* Stop (revelado al hover cuando es cancelable) */}
                {revealCancel && (
                  <Square
                    size={13}
                    fill="currentColor"
                    className="absolute opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  />
                )}
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
