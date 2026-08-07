import { useEffect, useRef } from 'react'

import type { AIChatField } from '@/components/ia/AIChatWorkspace'

import {
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
  useGSAP,
} from '@/lib/animations'
import { cn } from '@/lib/utils'

export function FieldSuggestions({
  ref,
  query,
  fields,
  highlightedIndex,
  onHighlight,
  onSelect,
}: {
  ref?: React.RefObject<HTMLDivElement | null>
  query: string
  fields: Array<AIChatField>
  highlightedIndex: number
  onHighlight: (index: number) => void
  onSelect: (field: AIChatField) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!getOrganicMotion()) return
    const el = ref?.current
    if (!el) return

    gsap.fromTo(
      el,
      { y: 6, opacity: 0, scale: 0.99 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: organicDuration.quick,
        ease: organicEase,
      },
    )
  })

  useEffect(() => {
    const item = listRef.current?.querySelector('[data-highlighted]')
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  return (
    <div
      ref={ref}
      className="border-border bg-popover mb-relacionado absolute bottom-full z-20 w-full overflow-hidden rounded-xl border-[0.5px] shadow-md"
    >
      <div ref={listRef} className="p-micro max-h-64 overflow-y-auto">
        {fields.length > 0 ? (
          fields.map((field, index) => {
            const isHighlighted = index === highlightedIndex
            return (
              <button
                key={field.key}
                type="button"
                data-highlighted={isHighlighted ? 'true' : undefined}
                onPointerDown={(event) => {
                  event.preventDefault()
                  onSelect(field)
                }}
                onMouseEnter={() => onHighlight(index)}
                className={cn(
                  'gap-relacionado px-control py-relacionado flex w-full items-center justify-between rounded-lg text-left text-sm',
                  isHighlighted
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground',
                )}
              >
                <span className="truncate">{field.label}</span>
                {isHighlighted && (
                  <span className="shrink-0 font-mono text-[10px] opacity-50">
                    TAB
                  </span>
                )}
              </button>
            )
          })
        ) : (
          <div className="text-muted-foreground p-control text-center text-xs">
            No hay coincidencias{query ? ` para "${query}"` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
