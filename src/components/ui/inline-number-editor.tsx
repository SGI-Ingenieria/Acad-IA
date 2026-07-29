import { Minus, Plus } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type InlineNumberEditorProps = {
  value: number | null
  label?: string
  min: number
  max: number
  onValueChange: (value: number) => void
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)))

/**
 * Editor numérico compacto usado en frases y resúmenes académicos. Mantiene
 * visible únicamente el valor; al enfocarlo abre los pasos −/+ y nombra el
 * dato que se está editando.
 */
export function InlineNumberEditor({
  value,
  label,
  min,
  max,
  onValueChange,
  className,
  open: controlledOpen,
  onOpenChange,
}: InlineNumberEditorProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const changeOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  const [draft, setDraft] = React.useState(value === null ? '' : String(value))

  React.useEffect(() => {
    if (!open) setDraft(value === null ? '' : String(value))
  }, [open, value])

  React.useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.select())
    return () => cancelAnimationFrame(frame)
  }, [open])

  const commit = React.useCallback(
    (raw: string) => {
      const parsed = Number(raw)
      const next = clamp(Number.isFinite(parsed) ? parsed : min, min, max)
      setDraft(String(next))
      onValueChange(next)
    },
    [max, min, onValueChange],
  )

  const move = (direction: -1 | 1) => {
    const parsed = Number(draft)
    const base = Number.isFinite(parsed) ? parsed : (value ?? min)
    const next = clamp(base + direction, min, max)
    setDraft(String(next))
    onValueChange(next)
    inputRef.current?.focus()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setDraft(value === null ? '' : String(value))
          changeOpen(true)
          return
        }
        commit(draft)
        changeOpen(false)
      }}
    >
      <PopoverTrigger asChild>
        <Input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          role="spinbutton"
          aria-label={`${label}: ${value ?? 'sin asignar'}. Editar`}
          aria-valuenow={value ?? undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          value={open ? draft : String(value ?? min)}
          maxLength={String(max).length}
          onChange={(event) => {
            if (!open) return
            const raw = event.target.value.replace(/\D/g, '')
            setDraft(raw)
            if (!raw) return
            const parsed = Number(raw)
            if (Number.isFinite(parsed)) {
              onValueChange(clamp(parsed, min, max))
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              move(-1)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              move(1)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              commit(draft)
              changeOpen(false)
              event.currentTarget.blur()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setDraft(value === null ? '' : String(value))
              changeOpen(false)
              event.currentTarget.blur()
            }
          }}
          className={cn(
            'border-border/60 hover:border-primary/70 focus-visible:border-primary h-8 w-[4ch] rounded-none border-0 border-b-2 bg-transparent px-2 py-0 text-center text-xl leading-none font-bold tabular-nums shadow-none',
            'focus-visible:ring-primary/25 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2',
            'dark:bg-transparent',
            open && 'border-primary bg-primary/5 dark:bg-primary/5',
            className,
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={6}
        className="grid w-max min-w-0 justify-items-center gap-1 p-2"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <p className="text-muted-foreground px-2 text-xs font-medium">
          {label}
        </p>
        <div
          className="flex items-center justify-center gap-1"
          role="group"
          aria-label={label}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Disminuir ${label?.toLocaleLowerCase('es-MX') || 'valor'}`}
            disabled={(value ?? min) <= min}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => move(-1)}
          >
            <Minus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Aumentar ${label?.toLocaleLowerCase('es-MX')}`}
            disabled={(value ?? min) >= max}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => move(1)}
          >
            <Plus />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
