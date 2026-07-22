import { Menu } from 'lucide-react'
import { useState } from 'react'

import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ContextualMenuOption = {
  id: string
  label: string
  icon: LucideIcon
  badge?: number
  hidden?: boolean
  disabled?: boolean
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
    <Tooltip>
      <Popover open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              className={cn(
                'fixed right-5 bottom-5 z-40 h-14 w-14 rounded-full shadow-xl',
                'transition-transform hover:scale-105 active:scale-95',
              )}
              aria-label="Acciones disponibles"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">Acciones disponibles</TooltipContent>
        <PopoverContent
          side="top"
          align="end"
          className="w-64 p-2"
          sideOffset={12}
        >
          <div className="grid gap-1">
            {visibleOptions.map((option) => {
              const Icon = option.icon
              return (
                <Button
                  key={option.id}
                  variant="ghost"
                  disabled={option.disabled}
                  className="justify-start gap-3 px-3"
                  onClick={() => {
                    onSelect(option.id)
                    setOpen(false)
                  }}
                >
                  <Icon className="text-muted-foreground h-4 w-4" />
                  <span className="flex-1 text-left text-sm">
                    {option.label}
                  </span>
                  {option.badge ? (
                    <span className="bg-destructive flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white">
                      {option.badge > 99 ? '99+' : option.badge}
                    </span>
                  ) : null}
                </Button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </Tooltip>
  )
}
