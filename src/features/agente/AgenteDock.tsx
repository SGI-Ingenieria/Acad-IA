import { PencilLine, Redo2, Square, Undo2, X } from 'lucide-react'
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

const ANCHO_CONTEXTO_CERRADO = 36

function anchoContextoExpandido() {
  return Math.max(144, Math.min(288, window.innerWidth - 160))
}

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
  const controlContextoRef = useRef<HTMLDivElement>(null)
  const contenidoContextoRef = useRef<HTMLSpanElement>(null)
  const inputContextoRef = useRef<HTMLInputElement>(null)
  const botonContextoRef = useRef<HTMLButtonElement>(null)
  const [revirtiendo, setRevirtiendo] = useState(false)
  const [contextoAbierto, setContextoAbierto] = useState(false)

  // El provider detiene la sesión al perder el plan. Esta condición evita un
  // destello del dock durante el render previo a que ese efecto haga limpieza.
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

  // El botón de contexto no abre un popover: el propio botón se estira y se
  // convierte en el campo. Al estar el dock imantado a la derecha, compensamos
  // su `x` al mismo ritmo para que el borde no se despegue de la esquina.
  const contextoColocado = useRef(false)
  useGSAP(
    () => {
      const dock = dockRef.current
      const control = controlContextoRef.current
      const contenido = contenidoContextoRef.current
      if (!dock || !control || !contenido) {
        contextoColocado.current = false
        return
      }

      const instantaneo = !contextoColocado.current
      contextoColocado.current = true
      const anchoActual = control.getBoundingClientRect().width
      const anchoDestino = contextoAbierto
        ? anchoContextoExpandido()
        : ANCHO_CONTEXTO_CERRADO
      const xActual = Number(gsap.getProperty(dock, 'x')) || 0
      const xDestino = esquinaRef.current.endsWith('derecha')
        ? xActual - (anchoDestino - anchoActual)
        : xActual

      const colocarFoco = () => {
        if (instantaneo) return
        if (contextoAbierto) inputContextoRef.current?.focus()
        else botonContextoRef.current?.focus()
      }

      if (instantaneo || !getOrganicMotion()) {
        gsap.set(control, { width: anchoDestino })
        gsap.set(contenido, {
          autoAlpha: contextoAbierto ? 1 : 0,
          x: contextoAbierto ? 0 : -4,
        })
        gsap.set(dock, { x: xDestino })
        colocarFoco()
      } else {
        const timeline = gsap.timeline({
          defaults: {
            duration: organicDuration.base,
            ease: 'power3.out',
            overwrite: 'auto',
          },
          onComplete: colocarFoco,
        })
        timeline
          .to(control, { width: anchoDestino }, 0)
          .to(dock, { x: xDestino }, 0)
          .to(
            contenido,
            {
              autoAlpha: contextoAbierto ? 1 : 0,
              x: contextoAbierto ? 0 : -4,
              duration: organicDuration.quick,
            },
            contextoAbierto ? 0.08 : 0,
          )
      }

      const alRedimensionar = () => {
        if (!contextoAbierto) return
        gsap.set(control, { width: anchoContextoExpandido() })
        imantarAEsquina(dock, esquinaRef.current)
      }
      window.addEventListener('resize', alRedimensionar)
      return () => window.removeEventListener('resize', alRedimensionar)
    },
    { dependencies: [visible, contextoAbierto], scope: dockRef },
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

  const abrirContexto = () => {
    if (contextoAbierto) {
      inputContextoRef.current?.focus()
      return
    }
    setContextoAbierto(true)
  }

  const quitarContexto = () => {
    setContexto('')
    setContextoAbierto(false)
  }

  const detenerAgente = () => {
    setContextoAbierto(false)
    detener()
  }

  if (!visible) return null

  return (
    <div
      ref={dockRef}
      className="fixed top-0 left-0 z-90 cursor-grab active:cursor-grabbing"
      role="toolbar"
      aria-label="Modo agente de inteligencia artificial"
    >
      <div className="bg-background/90 border-border/70 gap-micro p-micro flex h-11 items-center rounded-full border shadow-lg backdrop-blur-xl">
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

        {/* Grupo 2 — contexto progresivo. Sin texto, el agente trabaja de forma
            autónoma; el lapicero se estira para ofrecer una acotación opcional. */}
        <div
          ref={controlContextoRef}
          className={cn(
            'flex h-9 shrink-0 items-center overflow-hidden rounded-full transition-colors',
            contextoAbierto
              ? 'bg-muted/70 ring-primary/25 shadow-inner ring-1 ring-inset'
              : 'bg-transparent',
          )}
          style={{ width: ANCHO_CONTEXTO_CERRADO }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                ref={botonContextoRef}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={
                  contexto.trim()
                    ? 'Editar contexto del agente'
                    : 'Agregar contexto al agente'
                }
                aria-controls="agente-contexto-input"
                aria-expanded={contextoAbierto}
                onClick={abrirContexto}
                className={cn(
                  'text-muted-foreground relative size-9 shrink-0 rounded-full border-0 shadow-none',
                  contextoAbierto
                    ? 'text-primary hover:bg-transparent'
                    : 'hover:text-foreground',
                )}
              >
                <PencilLine className="size-4" />
                {!contextoAbierto && contexto.trim() ? (
                  <span
                    className="bg-primary absolute top-1.5 right-1.5 size-1.5 rounded-full"
                    aria-hidden
                  />
                ) : null}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {contexto.trim() ? 'Editar contexto' : 'Agregar contexto'}
            </TooltipContent>
          </Tooltip>

          <span
            ref={contenidoContextoRef}
            className="flex min-w-0 flex-1 items-center opacity-0"
            inert={!contextoAbierto}
            aria-hidden={!contextoAbierto}
          >
            <input
              ref={inputContextoRef}
              id="agente-contexto-input"
              data-agente-contexto
              value={contexto}
              onChange={(event) => setContexto(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  quitarContexto()
                }
              }}
              placeholder="contexto…"
              aria-label="Palabras de contexto para el agente"
              autoComplete="off"
              spellCheck={false}
              className="placeholder:text-muted-foreground/50 min-w-0 flex-1 border-0 bg-transparent text-sm font-medium tracking-tight outline-none focus-visible:ring-0"
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Quitar contexto del agente"
                  onClick={quitarContexto}
                  className="text-muted-foreground/45 hover:text-foreground mr-micro size-7 shrink-0 rounded-full"
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Quitar contexto</TooltipContent>
            </Tooltip>
          </span>
        </div>

        {/* Grupo 3 — salir. Detener desmonta el dock y devuelve el menú
            contextual, así que no hay un estado "puesto pero apagado" que
            necesite un botón de empezar. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Detener el modo agente"
              onClick={detenerAgente}
              className="text-destructive/85 bg-destructive/8 hover:bg-destructive/12 gap-relacionado px-control h-9 rounded-full border-0 shadow-none"
            >
              <Square className="size-3 fill-current" />
              <span className="hidden text-xs font-medium sm:inline">
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
