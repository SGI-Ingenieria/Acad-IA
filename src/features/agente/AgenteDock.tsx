import { Redo2, Square, Undo2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { useAgente } from './AgenteContext'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Draggable,
  esquinaMasCercana,
  getOrganicMotion,
  gsap,
  imantarAEsquina,
  organicDuration,
  useGSAP,
} from '@/lib/animations'
import { cn } from '@/lib/utils'

/**
 * Muestra u oculta un control del dock animando su ancho, no su `display`: así
 * el resto del dock se recompone con continuidad en vez de dar un salto. El
 * envoltorio queda `inert` cuando está oculto para que no siga siendo
 * tabulable ni visible para el lector de pantalla.
 */
function animarRanura(
  ranura: HTMLElement,
  visible: boolean,
  instantaneo: boolean,
) {
  if (instantaneo || !getOrganicMotion()) {
    gsap.set(ranura, {
      width: visible ? 'auto' : 0,
      autoAlpha: visible ? 1 : 0,
      scale: visible ? 1 : 0.6,
    })
    return
  }

  gsap.to(ranura, {
    width: visible ? 'auto' : 0,
    autoAlpha: visible ? 1 : 0,
    scale: visible ? 1 : 0.6,
    duration: organicDuration.base,
    ease: visible ? 'back.out(1.6)' : 'power2.in',
    overwrite: 'auto',
  })
}

export function AgenteDock() {
  const {
    abierto,
    ambito,
    contexto,
    esquina,
    detener,
    setContexto,
    setEsquina,
    puedeDeshacer,
    puedeRehacer,
    deshacer,
    rehacer,
  } = useAgente()

  const dockRef = useRef<HTMLDivElement>(null)
  const ranuraDeshacer = useRef<HTMLSpanElement>(null)
  const ranuraRehacer = useRef<HTMLSpanElement>(null)
  const [revirtiendo, setRevirtiendo] = useState(false)

  const visible = abierto && ambito !== null

  // La esquina viva se lee por ref, no por dependencia: si el efecto se
  // reejecutara cada vez que el imán la actualiza, GSAP revertiría la propia
  // animación de imantado a media transición y el dock daría un salto.
  const esquinaRef = useRef(esquina)
  esquinaRef.current = esquina

  // Imantado: posición inicial, arrastre con inercia y reencaje al
  // redimensionar. El dock se ancla en 0,0 y se mueve sólo con `transform`, que
  // es también lo que escribe Draggable — así arrastre e imán no se pelean por
  // la misma propiedad.
  useGSAP(
    () => {
      const dock = dockRef.current
      if (!dock) return

      gsap.set(dock, { x: 0, y: 0 })
      imantarAEsquina(dock, esquinaRef.current)

      const [arrastrable] = Draggable.create(dock, {
        type: 'x,y',
        inertia: true,
        edgeResistance: 0.92,
        // Sin esto, arrastrar desde un botón o desde el campo de contexto
        // secuestraría el clic y el foco.
        dragClickables: false,
        onDragEnd() {
          const destino = esquinaMasCercana(dock)
          esquinaRef.current = destino
          setEsquina(destino)
          imantarAEsquina(dock, destino)
        },
      })

      const alRedimensionar = () => imantarAEsquina(dock, esquinaRef.current)
      window.addEventListener('resize', alRedimensionar)

      return () => {
        window.removeEventListener('resize', alRedimensionar)
        arrastrable.kill()
      }
    },
    { dependencies: [visible], scope: dockRef },
  )

  // Entrada del dock.
  useGSAP(
    () => {
      const dock = dockRef.current
      if (!dock || !getOrganicMotion()) return

      gsap.from(dock.firstElementChild, {
        autoAlpha: 0,
        scale: 0.88,
        duration: organicDuration.base,
        ease: 'back.out(1.5)',
      })
    },
    { dependencies: [visible], scope: dockRef },
  )

  // `visible` está en las dependencias porque las ranuras no existen hasta que
  // el dock se monta: sin él, el primer pintado dejaba deshacer y rehacer a su
  // ancho natural —visibles— aunque no hubiera nada que deshacer todavía.
  const ranurasColocadas = useRef(false)
  useGSAP(
    () => {
      const deshacerEl = ranuraDeshacer.current
      const rehacerEl = ranuraRehacer.current
      if (!deshacerEl || !rehacerEl) {
        ranurasColocadas.current = false
        return
      }

      // La primera colocación es instantánea: animar desde el ancho natural
      // sería enseñar los botones justo para esconderlos.
      const instantaneo = !ranurasColocadas.current
      ranurasColocadas.current = true

      animarRanura(deshacerEl, puedeDeshacer, instantaneo)
      animarRanura(rehacerEl, puedeRehacer, instantaneo)

      // El dock cambia de ancho al aparecer o desaparecer un control: sin
      // reimantar, el borde pegado a la esquina se despegaría.
      const dock = dockRef.current
      if (dock) {
        gsap.delayedCall(instantaneo ? 0 : organicDuration.base, () =>
          imantarAEsquina(dock, esquinaRef.current),
        )
      }
    },
    { dependencies: [visible, puedeDeshacer, puedeRehacer], scope: dockRef },
  )

  const revertir = useCallback(
    async (accion: () => Promise<void>) => {
      if (revirtiendo) return
      setRevirtiendo(true)
      try {
        await accion()
      } finally {
        setRevirtiendo(false)
      }
    },
    [revirtiendo],
  )

  if (!visible) return null

  return (
    <div
      ref={dockRef}
      className="fixed top-0 left-0 z-90 cursor-grab active:cursor-grabbing"
      role="toolbar"
      aria-label="Modo agente de inteligencia artificial"
    >
      <div className="bg-background/85 border-primary/30 flex items-center gap-2 rounded-2xl border py-2 pr-2 pl-2.5 shadow-xl backdrop-blur-md">
        {/* Grupo 1 — deshacer / rehacer. Las ranuras colapsan a cero cuando no
            hay nada que deshacer o rehacer. */}
        <span className="flex items-center">
          <span
            ref={ranuraDeshacer}
            className="inline-flex overflow-hidden"
            inert={!puedeDeshacer}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Deshacer el último cambio del agente"
                  disabled={revirtiendo}
                  onClick={() => void revertir(deshacer)}
                >
                  <Undo2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Deshacer</TooltipContent>
            </Tooltip>
          </span>
          <span
            ref={ranuraRehacer}
            className="inline-flex overflow-hidden"
            inert={!puedeRehacer}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Rehacer el cambio deshecho"
                  disabled={revirtiendo}
                  onClick={() => void revertir(rehacer)}
                >
                  <Redo2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rehacer</TooltipContent>
            </Tooltip>
          </span>
        </span>

        {/* Grupo 2 — contexto. Reactivo puro: sin guardar ni cancelar. */}
        <input
          data-agente-contexto
          value={contexto}
          onChange={(event) => setContexto(event.target.value)}
          placeholder="contexto…"
          aria-label="Palabras de contexto para el agente"
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'placeholder:text-muted-foreground/50 w-[16ch] border-0 bg-transparent text-lg font-medium tracking-tight outline-none sm:w-[22ch]',
            'focus-visible:ring-0',
          )}
        />

        {/* Grupo 3 — salir. Detener desmonta el dock y devuelve el menú
            contextual, así que no hay un estado "puesto pero apagado" que
            necesite un botón de empezar. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Detener el modo agente"
              onClick={detener}
              className="text-destructive border-destructive/45 hover:bg-destructive/10 gap-1.5 rounded-xl border"
            >
              <Square className="fill-current" />
              <span className="text-muted-foreground/70 hidden text-[11px] font-normal sm:inline">
                Detener
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Detener el modo agente</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
