'use client'

import { CheckIcon, ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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

export type Option = { value: string; label: string }
export type OptionGroup = { label: string; options: Array<Option> }

type Props = {
  options: Array<Option | OptionGroup>
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
  disabled?: boolean
}

const Filtro: React.FC<Props> = ({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar…',
  className,
  ariaLabel,
  disabled,
}) => {
  const [open, setOpen] = useState(false)

  const label = (() => {
    if (value === null) return placeholder
    for (const o of options) {
      if ('options' in o && Array.isArray(o.options)) {
        const found = o.options.find((opt) => opt.value === value)
        if (found) return found.label
      } else if ('value' in o && o.value === value) {
        return o.label
      }
    }
    return placeholder
  })()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn('w-full min-w-0 justify-between', className)}
              aria-label={ariaLabel ?? 'Filtro combobox'}
              disabled={disabled}
            >
              <span className="truncate">{label}</span>
              <ChevronDown className="shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="p-0">
        <Command>
          <CommandInput placeholder="Buscar…" className="h-9" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {options.map((optOrGroup) => {
              // If this item is a group (has `options`), render a CommandGroup with heading
              if (
                'options' in optOrGroup &&
                Array.isArray(optOrGroup.options)
              ) {
                const grp = optOrGroup
                return (
                  <CommandGroup key={grp.label} heading={grp.label}>
                    {grp.options.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={(currentValue) => {
                          onChange(currentValue)
                          setOpen(false)
                        }}
                      >
                        {opt.label}
                        <CheckIcon
                          className={cn(
                            'ml-auto',
                            value === opt.value ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              }

              // Otherwise render a single-item group (no heading)
              const opt = optOrGroup as Option
              return (
                <CommandGroup key={opt.value}>
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={(currentValue) => {
                      onChange(currentValue)
                      setOpen(false)
                    }}
                  >
                    {opt.label}
                    <CheckIcon
                      className={cn(
                        'ml-auto',
                        value === opt.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default Filtro
