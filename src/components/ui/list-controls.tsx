import { ArrowDownWideNarrow, ListFilter } from 'lucide-react'
import { useState } from 'react'

import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ListSortOption<T extends string> = {
  value: T
  label: string
}

export function ListToolbar({
  search,
  actions,
  view,
  className,
}: {
  search: ReactNode
  actions?: ReactNode
  view?: ReactNode
  className?: string
}) {
  return (
    <div
      data-list-toolbar
      className={cn(
        'flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{search}</div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
      {view ? (
        <div className="flex shrink-0 items-center gap-1">{view}</div>
      ) : null}
    </div>
  )
}

export function ListSortMenu<T extends string>({
  value,
  defaultValue,
  options,
  onValueChange,
  label = 'Ordenar resultados',
}: {
  value: T
  defaultValue: T
  options: Array<ListSortOption<T>>
  onValueChange: (value: T) => void
  label?: string
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={label}
              className={cn(
                'relative shrink-0',
                value !== defaultValue &&
                  'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
              )}
            >
              <ArrowDownWideNarrow className="size-4" />
              {value !== defaultValue ? (
                <span className="bg-primary absolute -top-1 -right-1 size-2 rounded-full" />
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onValueChange(next as T)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ListFiltersDialog<T>({
  title,
  value,
  defaultValue,
  activeCount,
  onApply,
  children,
  label = 'Filtrar resultados',
}: {
  title: string
  description?: string
  value: T
  defaultValue: T
  activeCount: number
  onApply: (value: T, options: { resetAll: boolean }) => void
  children: (
    value: T,
    setValue: (updater: T | ((previous: T) => T)) => void,
  ) => ReactNode
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [resetAll, setResetAll] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(value)
      setResetAll(false)
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={label}
              className={cn(
                'relative shrink-0',
                activeCount > 0 &&
                  'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
              )}
            >
              <ListFilter className="size-4" />
              {activeCount > 0 ? (
                <span className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
                  {activeCount}
                </span>
              ) : null}
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>

      <DialogContent className="grid max-h-[min(44rem,calc(100dvh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0">
        <DialogHeader className="border-border border-b px-6 py-5 pr-12">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="min-h-0">
          <div className="space-y-6 px-6 py-5">{children(draft, setDraft)}</div>
        </ScrollArea>

        <DialogFooter className="border-border border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(defaultValue)
              setResetAll(true)
            }}
          >
            Borrar todo
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(draft, { resetAll })
              setOpen(false)
            }}
          >
            Aplicar filtros
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ListFilterSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-foreground text-sm font-semibold">{title}</legend>
      {description ? (
        <p className="text-muted-foreground text-xs">{description}</p>
      ) : null}
      {children}
    </fieldset>
  )
}
