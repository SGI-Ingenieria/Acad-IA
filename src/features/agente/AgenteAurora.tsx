import { useRef } from 'react'

import { useAgente } from './AgenteContext'

import {
  getOrganicMotion,
  gsap,
  organicDuration,
  useGSAP,
} from '@/lib/animations'

/**
 * Marco de aurora boreal que enmarca el viewport mientras el modo agente está
 * activo. Es la señal de cambio de modo: el usuario tiene que notar de golpe
 * que la página dejó de comportarse como siempre.
 *
 * Va en `z-30` — sobre el contenido, pero por debajo del FAB del menú
 * contextual (`z-40`), de los Sheet/Dialog (`z-50`) y del dock (`z-90`).
 * `aria-hidden` porque el estado del modo ya lo anuncia el dock; duplicarlo
 * aquí sólo añadiría ruido al lector de pantalla.
 */
export function AgenteAurora() {
  const { activo } = useAgente()
  const marcoRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const marco = marcoRef.current
      if (!marco) return

      if (!getOrganicMotion()) {
        gsap.set(marco, { autoAlpha: 1, scale: 1 })
        return
      }

      // Entra creciendo desde fuera del encuadre: refuerza la idea de que algo
      // envuelve la página, en vez de aparecer encima de ella.
      gsap.fromTo(
        marco,
        { autoAlpha: 0, scale: 1.06 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: organicDuration.slow,
          ease: 'power2.out',
        },
      )
    },
    { dependencies: [activo], scope: marcoRef },
  )

  if (!activo) return null

  return (
    <div ref={marcoRef} className="agente-aurora-marco" aria-hidden="true">
      <div className="agente-aurora-blob agente-aurora-blob--primary" />
      <div className="agente-aurora-blob agente-aurora-blob--cool" />
      <div className="agente-aurora-blob agente-aurora-blob--warm" />
    </div>
  )
}
