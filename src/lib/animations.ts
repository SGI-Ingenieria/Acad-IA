import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

gsap.registerPlugin(useGSAP)

export const organicEase = 'power3.out'
export const organicInOut = 'sine.inOut'

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

export { gsap, useGSAP }
