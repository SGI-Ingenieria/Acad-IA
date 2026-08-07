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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  viewClassName,
  className,
}: {
  search: ReactNode
  actions?: ReactNode
  view?: ReactNode
  viewClassName?: string
  className?: string
}) {
  return (
    <div
      data-list-toolbar
      className={cn(
        'gap-relacionado flex min-w-0 flex-col sm:flex-row sm:items-center',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{search}</div>
      {actions ? (
        <div className="gap-relacionado flex shrink-0 items-center">
          {actions}
        </div>
      ) : null}
      {view ? (
        <div
          className={cn('gap-micro flex shrink-0 items-center', viewClassName)}
        >
          {view}
        </div>
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
    /* `modal={false}` no es cosmético: este menú se usa dentro de paneles que
       ya son capas modales (el historial vive en un Sheet). Un menú modal deja
       `pointer-events: none` en el `body` mientras está abierto, así que el
       clic que lo cierra se resuelve contra el `body` —fuera del panel— y el
       Sheet lo interpreta como "clic fuera" y se cierra también. Sin modal no
       hay bloqueo de punteros y el clic llega a su elemento real. */
    <DropdownMenu modal={false}>
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
                <span className="bg-primary text-primary-foreground px-micro absolute -top-2 -right-2 flex min-h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums">
                  {activeCount}
                </span>
              ) : null}
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>

      <DialogContent
        spacing="flush"
        className="grid max-h-[min(44rem,calc(100dvh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto]"
      >
        <DialogHeader className="border-border px-seccion py-seccion pr-pagina border-b">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="min-h-0">
          <div className="space-y-seccion px-seccion py-seccion">
            {children(draft, setDraft)}
          </div>
        </ScrollArea>

        <DialogFooter className="border-border px-seccion py-grupo border-t">
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

export function ListFiltersPopover<T>({
  title,
  value,
  defaultValue,
  activeCount,
  onApply,
  children,
  label = 'Filtrar resultados',
}: {
  title: string
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
    <Popover modal={false} open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
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
                <span className="bg-primary text-primary-foreground px-micro absolute -top-2 -right-2 flex min-h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums">
                  {activeCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        sideOffset={8}
        spacing="flush"
        className="grid max-h-[min(34rem,calc(100dvh-2rem))] w-[min(20rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden"
      >
        <div className="border-border px-grupo py-grupo border-b">
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
        </div>

        <ScrollArea className="min-h-0">
          <div className="space-y-seccion px-grupo py-grupo">
            {children(draft, setDraft)}
          </div>
        </ScrollArea>

        <div className="border-border gap-relacionado px-grupo py-control flex items-center justify-end border-t">
          <Button
            type="button"
            size="sm"
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
            size="sm"
            onClick={() => {
              onApply(draft, { resetAll })
              setOpen(false)
            }}
          >
            Aplicar filtros
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
    <fieldset className="space-y-control">
      <legend className="text-foreground text-sm font-semibold">{title}</legend>
      {description ? (
        <p className="text-muted-foreground text-xs">{description}</p>
      ) : null}
      {children}
    </fieldset>
  )
}
