import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { Flip } from 'gsap/Flip'
import { InertiaPlugin } from 'gsap/InertiaPlugin'

// GSAP 3.13+ publica todos los plugins sin membresía, así que Draggable,
// InertiaPlugin y Flip se registran aquí una sola vez: son los tres que usa el
// modo agente (dock arrastrable con imán y reacomodos del mapa/post-its).
gsap.registerPlugin(useGSAP, Draggable, InertiaPlugin, Flip)

export const organicEase = 'power3.out'
export const organicInOut = 'sine.inOut'

/** Rebote corto y contenido para el imán del dock del modo agente. */
export const magneticEase = 'elastic.out(1, 0.72)'

export const organicDuration = {
  quick: 0.18,
  base: 0.32,
  slow: 0.72,
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return true

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function getOrganicMotion(enabled = true) {
  return enabled && !prefersReducedMotion()
}

export function animateControlIcon(control: HTMLElement, active: boolean) {
  if (!getOrganicMotion()) return

  const icon = control.querySelector<SVGElement>('[data-motion-icon]')
  if (!icon) return

  gsap.to(icon, {
    y: active ? -1 : 0,
    scale: active ? 1.08 : 1,
    duration: organicDuration.quick,
    ease: 'power3.out',
    overwrite: 'auto',
  })
}

/** Las cuatro esquinas del viewport a las que se puede imantar un elemento flotante. */
export type Esquina =
  | 'inferior-derecha'
  | 'inferior-izquierda'
  | 'superior-derecha'
  | 'superior-izquierda'

export const ESQUINAS: Array<Esquina> = [
  'inferior-derecha',
  'inferior-izquierda',
  'superior-derecha',
  'superior-izquierda',
]

/**
 * Esquina del viewport más cercana al centro del elemento. Se compara contra la
 * mitad del viewport en cada eje —no contra la distancia euclídea a los cuatro
 * vértices— porque así el resultado es estable cuando el elemento es ancho: un
 * dock que ocupa media pantalla nunca queda "más cerca" de la esquina contraria.
 */
export function esquinaMasCercana(el: HTMLElement): Esquina {
  const rect = el.getBoundingClientRect()
  const centroX = rect.left + rect.width / 2
  const centroY = rect.top + rect.height / 2

  const derecha = centroX >= window.innerWidth / 2
  const inferior = centroY >= window.innerHeight / 2

  if (inferior) return derecha ? 'inferior-derecha' : 'inferior-izquierda'
  return derecha ? 'superior-derecha' : 'superior-izquierda'
}

/**
 * Traslada un elemento `fixed` hasta pegarlo a una esquina del viewport con un
 * margen dado. Devuelve el desplazamiento aplicado por si el llamador necesita
 * persistirlo.
 *
 * El elemento debe estar anclado con `top`/`left` a 0 y moverse sólo con
 * `transform`: Draggable escribe `x`/`y` y aquí se continúa sobre esos mismos
 * valores, de modo que arrastrar y imantar no se pelean por la misma propiedad.
 */
export function imantarAEsquina(
  el: HTMLElement,
  esquina: Esquina,
  margen = 20,
): { x: number; y: number } {
  const rect = el.getBoundingClientRect()
  const actualX = Number(gsap.getProperty(el, 'x')) || 0
  const actualY = Number(gsap.getProperty(el, 'y')) || 0

  // Posición del elemento si no tuviera transform alguno.
  const baseIzquierda = rect.left - actualX
  const baseArriba = rect.top - actualY

  const destinoIzquierda = esquina.endsWith('derecha')
    ? window.innerWidth - rect.width - margen
    : margen
  const destinoArriba = esquina.startsWith('inferior')
    ? window.innerHeight - rect.height - margen
    : margen

  const x = destinoIzquierda - baseIzquierda
  const y = destinoArriba - baseArriba

  if (getOrganicMotion()) {
    gsap.to(el, {
      x,
      y,
      duration: 0.55,
      ease: magneticEase,
      overwrite: 'auto',
    })
  } else {
    gsap.set(el, { x, y })
  }

  return { x, y }
}

export { gsap, useGSAP, Draggable, Flip, InertiaPlugin }
