import { Menu, X } from 'lucide-react'
import { useRef, useState } from 'react'

import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  animateControlIcon,
  getOrganicMotion,
  gsap,
  useGSAP,
} from '@/lib/animations'
import { cn } from '@/lib/utils'

export type ContextualMenuOption = {
  id: string
  label: string
  icon: LucideIcon
  badge?: number
  hidden?: boolean
  disabled?: boolean
}

function ContextualActionGrid({
  options,
  onSelect,
}: {
  options: Array<ContextualMenuOption>
  onSelect: (id: string) => void
}) {
  const gridRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (!gridRef.current || !getOrganicMotion()) return

      const cards = gridRef.current.querySelectorAll('[data-action-card]')
      gsap.fromTo(
        cards,
        { autoAlpha: 0, y: 18, scale: 0.9, rotateX: -8 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          duration: 0.46,
          ease: 'back.out(1.35)',
          stagger: 0.075,
          clearProps: 'opacity,transform,visibility',
        },
      )
    },
    { scope: gridRef },
  )

  return (
    <div ref={gridRef} className="grid grid-cols-2 gap-2 perspective-distant">
      {options.map((option) => {
        const Icon = option.icon
        return (
          <Button
            key={option.id}
            data-action-card
            variant="ghost"
            disabled={option.disabled}
            className={cn(
              'group relative h-30 items-start justify-start overflow-hidden rounded-lg border p-4 text-left',
              'bg-background hover:border-primary/50 hover:bg-primary/5',
              'transition-[color,background-color,border-color]',
            )}
            onPointerEnter={(event) =>
              animateControlIcon(event.currentTarget, true)
            }
            onPointerLeave={(event) =>
              animateControlIcon(event.currentTarget, false)
            }
            onFocus={(event) => animateControlIcon(event.currentTarget, true)}
            onBlur={(event) => animateControlIcon(event.currentTarget, false)}
            onClick={() => onSelect(option.id)}
          >
            <span className="flex h-full min-w-0 flex-col justify-between">
              <span className="bg-muted group-hover:bg-primary/10 flex size-10 items-center justify-center rounded-lg transition-colors">
                <Icon
                  data-motion-icon
                  className="text-muted-foreground group-hover:text-primary size-6 transition-colors"
                />
              </span>
              <span className="text-sm leading-snug font-medium whitespace-normal">
                {option.label}
              </span>
            </span>
            {option.badge ? (
              <span className="bg-destructive absolute top-3 right-3 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white">
                {option.badge > 99 ? '99+' : option.badge}
              </span>
            ) : null}
          </Button>
        )
      })}
    </div>
  )
}

export function ContextualActionsMenu({
  options,
  onSelect,
  hidden,
}: {
  options: Array<ContextualMenuOption>
  onSelect: (id: string) => void
  hidden?: boolean
}) {
  const [open, setOpen] = useState(false)
  if (hidden) return null

  const visibleOptions = options.filter((option) => !option.hidden)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className={cn(
            'fixed right-5 bottom-5 z-40 h-14 w-14 rounded-full p-0 shadow-xl',
            'transition-[box-shadow] hover:shadow-2xl',
          )}
          aria-label={open ? 'Cerrar acciones' : 'Abrir acciones disponibles'}
          aria-expanded={open}
          onPointerEnter={(event) =>
            animateControlIcon(event.currentTarget, true)
          }
          onPointerLeave={(event) =>
            animateControlIcon(event.currentTarget, false)
          }
          onFocus={(event) => animateControlIcon(event.currentTarget, true)}
          onBlur={(event) => animateControlIcon(event.currentTarget, false)}
        >
          {/* Centrado con `inset-0 m-auto` (no `-translate-...`): el motor de
              animación escribe un `transform` inline en el icono y sobrescribiría
              el centrado por translate, dejándolo desplazado hacia la esquina. */}
          <Menu
            data-motion-icon
            className={cn(
              'absolute inset-0 m-auto size-6 transition-opacity',
              open && 'opacity-0',
            )}
          />
          <X
            data-motion-icon
            className={cn(
              'absolute inset-0 m-auto size-6 transition-opacity',
              !open && 'opacity-0',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-84 p-3"
        sideOffset={12}
      >
        <ContextualActionGrid
          options={visibleOptions}
          onSelect={(id) => {
            onSelect(id)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
