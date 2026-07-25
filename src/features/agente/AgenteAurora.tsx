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
 * Tiene dos regímenes, y la diferencia entre ambos es lo que la hace
 * informativa en vez de decorativa: en reposo es una deriva lenta y tenue al
 * borde de la percepción; mientras hay una acción de IA en vuelo se enciende
 * —más opaca, menos difusa, con la cortina barriendo— y al terminar decae
 * despacio, dejando un rastro que dice «acaba de cambiar algo». Ese decaimiento
 * largo es deliberado: una acción que dura medio segundo, apagada de golpe,
 * pasaría desapercibida.
 *
 * Va en `z-30` — sobre el contenido, pero por debajo del FAB del menú
 * contextual (`z-40`), de los Sheet/Dialog (`z-50`) y del dock (`z-90`).
 * `aria-hidden` porque el estado del modo ya lo anuncia el dock; duplicarlo
 * aquí sólo añadiría ruido al lector de pantalla.
 */
export function AgenteAurora() {
  const { activo, enCurso } = useAgente()
  const marcoRef = useRef<HTMLDivElement>(null)
  const trabajando = enCurso.size > 0

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

  useGSAP(
    () => {
      const marco = marcoRef.current
      if (!marco) return

      // Sin motion la aurora es señal de estado, no animación: la intensidad
      // salta al valor que toca y ahí se queda.
      if (!getOrganicMotion()) {
        marco.style.setProperty(
          '--agente-aurora-fuerza',
          trabajando ? '1' : '0',
        )
        return
      }

      gsap.to(marco, {
        // Subir rápido y bajar despacio: el encendido acompaña a la acción, el
        // apagado es el rastro que la hace visible aunque haya durado poco.
        '--agente-aurora-fuerza': trabajando ? 1 : 0,
        duration: trabajando ? 0.45 : 2.8,
        ease: trabajando ? 'power2.out' : 'power1.inOut',
        overwrite: 'auto',
      })
    },
    { dependencies: [trabajando], scope: marcoRef },
  )

  if (!activo) return null

  return (
    <div ref={marcoRef} className="agente-aurora-marco" aria-hidden="true">
      <div className="agente-aurora-blob agente-aurora-blob--primary" />
      <div className="agente-aurora-blob agente-aurora-blob--cool" />
      <div className="agente-aurora-blob agente-aurora-blob--warm" />
      <div className="agente-aurora-velo" />
    </div>
  )
}
