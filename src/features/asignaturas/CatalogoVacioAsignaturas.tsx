import { Link } from '@tanstack/react-router'
import { BookOpenText } from 'lucide-react'
import { useRef } from 'react'

import { getOrganicMotion, gsap, useGSAP } from '@/lib/animations'
import { defaultPlanesSearch } from '@/types/search'

interface CatalogoVacioAsignaturasProps {
  canCreate: boolean
}

export function CatalogoVacioAsignaturas({
  canCreate,
}: CatalogoVacioAsignaturasProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const root = rootRef.current
      if (!root || !getOrganicMotion()) return

      const object = root.querySelector<HTMLElement>(
        '[data-catalogo-empty-object]',
      )
      const sheets = root.querySelectorAll<HTMLElement>(
        '[data-catalogo-empty-sheet]',
      )
      const prompt = root.querySelector<HTMLElement>(
        '[data-catalogo-empty-prompt]',
      )

      gsap.fromTo(
        object,
        { autoAlpha: 0, y: 24, scale: 0.94, rotateX: -6 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          duration: 0.64,
          ease: 'power3.out',
          clearProps: 'opacity,visibility',
        },
      )
      gsap.fromTo(
        sheets,
        { y: 24 },
        {
          y: 0,
          duration: 0.72,
          ease: 'back.out(1.2)',
          stagger: 0.07,
        },
      )
      gsap.fromTo(
        prompt,
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.42,
          delay: 0.18,
          ease: 'power3.out',
          clearProps: 'opacity,visibility',
        },
      )
    },
    { scope: rootRef },
  )

  const animateCatalog = (open: boolean) => {
    const root = rootRef.current
    if (!root || !getOrganicMotion()) return

    const object = root.querySelector<HTMLElement>(
      '[data-catalogo-empty-object]',
    )
    const leftSheet = root.querySelector<HTMLElement>(
      '[data-catalogo-sheet-left]',
    )
    const rightSheet = root.querySelector<HTMLElement>(
      '[data-catalogo-sheet-right]',
    )
    const mainSheet = root.querySelector<HTMLElement>(
      '[data-catalogo-sheet-main]',
    )
    const action = root.querySelector<HTMLElement>(
      '[data-catalogo-empty-action]',
    )
    const shadow = root.querySelector<HTMLElement>(
      '[data-catalogo-empty-shadow]',
    )

    gsap.to(object, {
      y: open ? -5 : 0,
      scale: open ? 1.025 : 1,
      rotateX: open ? 2 : 0,
      duration: 0.42,
      ease: 'power3.out',
      overwrite: 'auto',
    })
    gsap.to(leftSheet, {
      x: open ? -12 : 0,
      y: open ? -8 : 0,
      rotation: open ? -11 : -7,
      duration: 0.46,
      ease: 'power3.out',
      overwrite: 'auto',
    })
    gsap.to(rightSheet, {
      x: open ? 12 : 0,
      y: open ? -7 : 0,
      rotation: open ? 11 : 7,
      duration: 0.46,
      ease: 'power3.out',
      overwrite: 'auto',
    })
    gsap.to(mainSheet, {
      y: open ? -13 : 0,
      duration: 0.46,
      ease: 'power3.out',
      overwrite: 'auto',
    })
    gsap.to(action, {
      rotate: open ? 90 : 0,
      scale: open ? 1.08 : 1,
      duration: 0.36,
      ease: 'power3.out',
      overwrite: 'auto',
    })
    gsap.to(shadow, {
      opacity: open ? 0.9 : 0.6,
      scaleX: open ? 1.08 : 1,
      duration: 0.42,
      ease: 'power3.out',
      overwrite: 'auto',
    })
  }

  const catalog = (
    <div
      data-catalogo-empty-object
      className="relative h-64 w-[min(20rem,80vw)] [transform-style:preserve-3d]"
      aria-hidden
    >
      <span
        data-catalogo-empty-shadow
        className="bg-primary/20 absolute inset-x-12 bottom-3 h-8 rounded-full opacity-60 blur-xl"
      />

      <div className="catalog-empty-back shadow-primary/15 absolute inset-x-8 top-12 bottom-8 rounded-2xl shadow-xl" />

      <div
        data-catalogo-empty-sheet
        data-catalogo-sheet-left
        className="catalog-empty-sheet border-primary/10 p-grupo absolute bottom-10 left-10 h-42 w-31 -rotate-7 rounded-xl border shadow-lg"
      >
        <span className="catalog-empty-mark block h-2 w-12 rounded-full" />
        <span className="catalog-empty-mark mt-grupo block h-1.5 w-18 rounded-full" />
        <span className="catalog-empty-mark mt-relacionado block h-1.5 w-14 rounded-full" />
        <span className="catalog-empty-mark mt-relacionado block h-1.5 w-16 rounded-full" />
      </div>

      <div
        data-catalogo-empty-sheet
        data-catalogo-sheet-right
        className="catalog-empty-sheet border-primary/10 p-grupo absolute right-10 bottom-10 h-42 w-31 rotate-7 rounded-xl border shadow-lg"
      >
        <span className="catalog-empty-mark block h-2 w-10 rounded-full" />
        <span className="catalog-empty-mark mt-grupo block h-1.5 w-16 rounded-full" />
        <span className="catalog-empty-mark mt-relacionado block h-1.5 w-18 rounded-full" />
        <span className="catalog-empty-mark mt-relacionado block h-1.5 w-12 rounded-full" />
      </div>

      <div
        data-catalogo-empty-sheet
        data-catalogo-sheet-main
        className="catalog-empty-sheet border-primary/10 p-grupo absolute bottom-7 left-1/2 z-10 h-48 w-36 -translate-x-1/2 rounded-2xl border shadow-xl"
      >
        <span className="bg-primary/12 text-primary flex size-10 items-center justify-center rounded-xl">
          <BookOpenText className="size-5" strokeWidth={1.8} />
        </span>
        <span className="catalog-empty-mark mt-grupo block h-2 w-20 rounded-full" />
        <span className="catalog-empty-mark mt-control block h-1.5 w-24 rounded-full" />
        <span className="catalog-empty-mark mt-relacionado block h-1.5 w-19 rounded-full" />
        <span className="catalog-empty-mark mt-relacionado block h-1.5 w-22 rounded-full" />
      </div>
    </div>
  )

  return (
    <div ref={rootRef} className="perspective-distant">
      {canCreate ? (
        <Link
          to="/planes"
          search={defaultPlanesSearch}
          resetScroll={false}
          preload="intent"
          aria-label="Elegir un plan para crear una asignatura"
          className="group focus-visible:ring-ring gap-control flex flex-col items-center rounded-2xl outline-none focus-visible:ring-3"
          onPointerEnter={() => animateCatalog(true)}
          onPointerLeave={() => animateCatalog(false)}
          onFocus={() => animateCatalog(true)}
          onBlur={() => animateCatalog(false)}
        >
          {catalog}
          <p
            data-catalogo-empty-prompt
            className="text-muted-foreground group-hover:text-foreground text-sm font-medium transition-colors"
          >
            Elige un plan para crear una asignatura
          </p>
        </Link>
      ) : (
        <div role="img" aria-label="El catálogo no tiene asignaturas">
          {catalog}
          <p
            data-catalogo-empty-prompt
            className="text-muted-foreground group-hover:text-foreground text-sm font-medium transition-colors"
          >
            Aún no hay asignaturas en el catálogo
          </p>
        </div>
      )}
    </div>
  )
}
