import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function parseDateValue(value: string | null | undefined) {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  disabled,
  className,
  buttonClassName,
}: {
  id?: string
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  buttonClassName?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDateValue(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-between px-3 text-left font-normal',
            !selected && 'text-muted-foreground',
            buttonClassName,
          )}
        >
          <span>
            {selected
              ? format(selected, 'dd/MM/yyyy', { locale: es })
              : placeholder}
          </span>
          <CalendarIcon className="text-muted-foreground h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('w-auto p-0', className)}>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date()}
          locale={es}
          captionLayout="dropdown"
          onSelect={(date) => {
            if (!date) return
            onChange(format(date, 'yyyy-MM-dd'))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
