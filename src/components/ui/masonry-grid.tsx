import { Children, useLayoutEffect, useRef } from 'react'

import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '@/lib/utils'

/**
 * Masonry medido para contenido cuyo orden importa.
 *
 * Las columnas CSS dan la apariencia correcta, pero recorren cada columna de
 * arriba abajo y pueden cambiar la posición visual de los elementos al añadir
 * una página. El masonry nativo todavía no tiene soporte estable. Esta
 * implementación conserva el orden del DOM y coloca cada elemento sucesivo en
 * la columna más corta, sin imponer la altura de sus vecinos.
 */
export function MasonryGrid({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const items = Children.toArray(children)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const elements = Array.from(
      container.querySelectorAll<HTMLElement>('[data-masonry-item]'),
    )
    let animationFrame = 0

    const layout = () => {
      const width = container.clientWidth
      if (width === 0) return

      const columns = window.matchMedia('(min-width: 64rem)').matches
        ? 3
        : window.matchMedia('(min-width: 40rem)').matches
          ? 2
          : 1
      const computedGap = Number.parseFloat(
        window.getComputedStyle(container).columnGap,
      )
      const gap = Number.isFinite(computedGap) ? computedGap : 0
      const columnWidth = (width - gap * (columns - 1)) / columns
      const columnHeights = Array.from({ length: columns }, () => 0)

      for (const element of elements) {
        element.style.width = `${columnWidth}px`

        const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights))
        const top = columnHeights[shortestColumn]
        const left = shortestColumn * (columnWidth + gap)

        element.style.left = `${left}px`
        element.style.top = `${top}px`
        columnHeights[shortestColumn] =
          top + element.getBoundingClientRect().height + gap
      }

      const tallestColumn = Math.max(...columnHeights, 0)
      container.style.height = `${Math.max(0, tallestColumn - gap)}px`
    }

    const scheduleLayout = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(layout)
    }

    const observer = new ResizeObserver(scheduleLayout)
    observer.observe(container)
    elements.forEach((element) => observer.observe(element))
    scheduleLayout()

    return () => {
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
    }
  }, [items.length])

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full gap-4', className)}
      {...props}
    >
      {items.map((item, index) => (
        <div
          // Los hijos conservan sus claves; el índice sólo identifica este
          // envoltorio de presentación y no representa estado de dominio.
          key={index}
          data-masonry-item
          className="absolute top-0 left-0 w-full"
        >
          {item}
        </div>
      ))}
    </div>
  )
}
