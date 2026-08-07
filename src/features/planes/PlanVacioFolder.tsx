import { Link } from '@tanstack/react-router'
import { LockKeyhole, Plus } from 'lucide-react'
import { useRef } from 'react'

import type { PlanesListaSearch } from '@/types/search'

import { getOrganicMotion, gsap, useGSAP } from '@/lib/animations'

interface PlanVacioFolderProps {
  canCreate: boolean
  search: PlanesListaSearch
}

export function PlanVacioFolder({ canCreate, search }: PlanVacioFolderProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const root = rootRef.current
      if (!root || !getOrganicMotion()) return

      const folder = root.querySelector<HTMLElement>(
        '[data-plan-folder-object]',
      )
      if (!folder) return

      const sheets = root.querySelectorAll<HTMLElement>(
        '[data-plan-folder-sheet]',
      )
      const prompt = root.querySelector<HTMLElement>(
        '[data-plan-folder-prompt]',
      )

      gsap.fromTo(
        folder,
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
        { y: 26 },
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

  const animateFolder = (open: boolean) => {
    const root = rootRef.current
    if (!root || !getOrganicMotion()) return

    const folder = root.querySelector<HTMLElement>('[data-plan-folder-object]')
    const front = root.querySelector<HTMLElement>('[data-plan-folder-front]')
    const back = root.querySelector<HTMLElement>('[data-plan-folder-back]')
    const sheets = root.querySelectorAll<HTMLElement>(
      '[data-plan-folder-sheet]',
    )
    const action = root.querySelector<HTMLElement>('[data-plan-folder-action]')
    const shadow = root.querySelector<HTMLElement>('[data-plan-folder-shadow]')

    gsap.to(folder, {
      y: open ? -6 : 0,
      scale: open ? 1.025 : 1,
      rotateX: open ? 2 : 0,
      duration: 0.42,
      ease: 'power3.out',
      overwrite: 'auto',
    })
    gsap.to(back, {
      y: open ? -3 : 0,
      duration: 0.42,
      ease: 'power3.out',
      overwrite: 'auto',
    })
    gsap.to(front, {
      y: open ? 10 : 0,
      rotateX: open ? -8 : 0,
      duration: 0.42,
      ease: 'power3.out',
      overwrite: 'auto',
    })
    gsap.to(sheets, {
      y: (index) => (open ? [-12, -20, -14][index] : 0),
      duration: 0.46,
      ease: 'power3.out',
      stagger: 0.045,
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

  const folder = (
    <div
      data-plan-folder-object
      className="relative h-64 w-[min(22rem,82vw)] [transform-style:preserve-3d]"
      aria-hidden
    >
      <span
        data-plan-folder-shadow
        className="bg-primary/20 absolute inset-x-10 bottom-1 h-8 rounded-full opacity-60 blur-xl"
      />

      <div
        data-plan-folder-back
        className="plan-empty-folder-back shadow-primary/10 absolute inset-x-5 top-12 bottom-7 rounded-2xl shadow-lg"
      >
        <span className="plan-empty-folder-back-tab absolute -top-5 left-0 h-8 w-28 rounded-t-xl" />
      </div>

      <div
        data-plan-folder-sheet
        className="plan-empty-folder-sheet border-primary/10 p-grupo absolute bottom-16 left-14 h-36 w-28 -rotate-8 rounded-xl border shadow-lg"
      >
        <span className="plan-empty-folder-mark block h-2 w-12 rounded-full" />
        <span className="plan-empty-folder-mark mt-control block h-1.5 w-16 rounded-full" />
        <span className="plan-empty-folder-mark mt-relacionado block h-1.5 w-12 rounded-full" />
        <span className="plan-empty-folder-mark mt-relacionado block h-1.5 w-14 rounded-full" />
      </div>

      <div
        data-plan-folder-sheet
        className="plan-empty-folder-sheet border-primary/10 p-grupo absolute bottom-17 left-1/2 z-10 h-40 w-30 -translate-x-1/2 rotate-1 rounded-xl border shadow-lg"
      >
        <span className="plan-empty-folder-mark block h-2 w-14 rounded-full" />
        <div className="mt-grupo space-y-relacionado">
          <span className="plan-empty-folder-mark block h-1.5 w-20 rounded-full" />
          <span className="plan-empty-folder-mark block h-1.5 w-16 rounded-full" />
          <span className="plan-empty-folder-mark block h-1.5 w-18 rounded-full" />
          <span className="plan-empty-folder-mark block h-1.5 w-12 rounded-full" />
        </div>
      </div>

      <div
        data-plan-folder-sheet
        className="plan-empty-folder-sheet border-primary/10 p-grupo absolute right-14 bottom-16 h-35 w-27 rotate-8 rounded-xl border shadow-lg"
      >
        <span className="plan-empty-folder-mark block h-2 w-10 rounded-full" />
        <span className="plan-empty-folder-mark mt-control block h-1.5 w-14 rounded-full" />
        <span className="plan-empty-folder-mark mt-relacionado block h-1.5 w-10 rounded-full" />
        <span className="plan-empty-folder-mark mt-relacionado block h-1.5 w-12 rounded-full" />
      </div>

      <div
        data-plan-folder-front
        className="plan-empty-folder-front border-primary-foreground/10 shadow-primary/20 absolute inset-x-2 bottom-2 z-20 h-36 origin-bottom overflow-hidden rounded-2xl border shadow-2xl"
      >
        <span className="bg-primary-foreground/15 absolute inset-x-8 top-0 h-px" />
        <span
          data-plan-folder-action
          className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground absolute right-5 bottom-5 flex size-12 items-center justify-center rounded-full border backdrop-blur-sm"
        >
          {canCreate ? (
            <Plus className="size-6" strokeWidth={1.8} />
          ) : (
            <LockKeyhole className="size-5" strokeWidth={1.8} />
          )}
        </span>
      </div>
    </div>
  )

  return (
    <div ref={rootRef} className="perspective-distant">
      {canCreate ? (
        <Link
          data-plan-empty-create
          to="/planes/nuevo"
          search={search}
          resetScroll={false}
          preload="intent"
          aria-label="Nuevo plan de estudios"
          className="group focus-visible:ring-ring gap-control flex flex-col items-center rounded-2xl outline-none focus-visible:ring-3"
          onPointerEnter={() => animateFolder(true)}
          onPointerLeave={() => animateFolder(false)}
          onFocus={() => animateFolder(true)}
          onBlur={() => animateFolder(false)}
        >
          {folder}
          <p
            data-plan-folder-prompt
            className="text-muted-foreground group-hover:text-foreground text-sm font-medium transition-colors"
          >
            Empieza creando tu primer plan
          </p>
        </Link>
      ) : (
        <div role="img" aria-label="Sin permiso para crear planes de estudio">
          {folder}
        </div>
      )}
    </div>
  )
}
