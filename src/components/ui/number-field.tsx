import { Minus, Plus } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

type NumberFieldContextValue = {
  value: number | null
  min?: number
  max?: number
  step: number
  disabled?: boolean
  inputId: string
  setValue: (value: number | null) => void
  increment: () => void
  decrement: () => void
}

const NumberFieldContext = React.createContext<NumberFieldContextValue | null>(
  null,
)

function useNumberField() {
  const context = React.useContext(NumberFieldContext)

  if (!context) {
    throw new Error('NumberField components must be used inside NumberField')
  }

  return context
}

function clampValue(value: number, min?: number, max?: number) {
  let nextValue = value

  if (typeof min === 'number') nextValue = Math.max(nextValue, min)
  if (typeof max === 'number') nextValue = Math.min(nextValue, max)

  return nextValue
}

function normalizeNumber(value: number, min?: number, max?: number) {
  if (!Number.isFinite(value)) return null

  return clampValue(Math.floor(Math.abs(value)), min, max)
}

function NumberField({
  value,
  defaultValue = null,
  min,
  max,
  step = 1,
  disabled,
  onValueChange,
  className,
  children,
}: {
  value?: number | null
  defaultValue?: number | null
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onValueChange?: (value: number | null) => void
  className?: string
  children: React.ReactNode
}) {
  const inputId = React.useId()
  const isControlled = value !== undefined
  const [uncontrolledValue, setUncontrolledValue] = React.useState<
    number | null
  >(() =>
    typeof defaultValue === 'number'
      ? normalizeNumber(defaultValue, min, max)
      : null,
  )

  const currentValue = isControlled ? (value ?? null) : uncontrolledValue

  const setValue = React.useCallback(
    (nextValue: number | null) => {
      const normalized =
        typeof nextValue === 'number'
          ? normalizeNumber(nextValue, min, max)
          : null

      if (!isControlled) {
        setUncontrolledValue(normalized)
      }

      onValueChange?.(normalized)
    },
    [isControlled, max, min, onValueChange],
  )

  const moveBy = React.useCallback(
    (direction: 1 | -1) => {
      if (disabled) return

      if (currentValue === null) {
        setValue(
          direction > 0
            ? typeof min === 'number'
              ? min
              : step
            : typeof max === 'number'
              ? max
              : 0,
        )
        return
      }

      setValue(currentValue + direction * step)
    },
    [currentValue, disabled, max, min, setValue, step],
  )

  return (
    <NumberFieldContext.Provider
      value={{
        value: currentValue,
        min,
        max,
        step,
        disabled,
        inputId,
        setValue,
        increment: () => moveBy(1),
        decrement: () => moveBy(-1),
      }}
    >
      <div className={cn('grid gap-1.5', className)}>{children}</div>
    </NumberFieldContext.Provider>
  )
}

function NumberFieldScrubArea({
  label,
  className,
  ...props
}: React.ComponentProps<'label'> & { label: string }) {
  const { inputId, disabled } = useNumberField()

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'text-muted-foreground cursor-ew-resize text-sm font-medium',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...props}
    >
      {label}
    </label>
  )
}

function NumberFieldGroup({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'border-input bg-background focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex h-9 w-full min-w-0 items-center overflow-hidden rounded-md border shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]',
        className,
      )}
      {...props}
    />
  )
}

const NumberFieldInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
    autoWidth?: boolean
    minDigits?: number
  }
>(function NumberFieldInput(
  { autoWidth = false, className, minDigits = 2, onKeyDown, style, ...props },
  ref,
) {
  const { value, inputId, disabled, setValue } = useNumberField()
  const digitCount = String(value ?? '').length
  const widthDigits = Math.max(minDigits, digitCount || minDigits)
  const autoWidthStyle = autoWidth
    ? {
        minWidth: `calc(${minDigits}ch + 1rem)`,
        width: `calc(${widthDigits}ch + 1rem)`,
        ...style,
      }
    : style

  return (
    <input
      ref={ref}
      id={inputId}
      type="number"
      inputMode="numeric"
      value={value ?? ''}
      disabled={disabled}
      style={autoWidthStyle}
      onKeyDown={(event) => {
        if (['.', ',', '-', 'e', 'E', '+'].includes(event.key)) {
          event.preventDefault()
        }

        onKeyDown?.(event)
      }}
      onChange={(event) => {
        const rawValue = event.target.value

        if (rawValue === '') {
          setValue(null)
          return
        }

        setValue(Number(rawValue))
      }}
      className={cn(
        'text-foreground placeholder:text-muted-foreground h-full min-w-0 bg-transparent px-2 text-center text-sm font-semibold outline-none [-moz-appearance:textfield] disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        autoWidth ? 'flex-none shrink-0' : 'flex-1',
        className,
      )}
      {...props}
    />
  )
})

function NumberFieldDecrement({
  className,
  onMouseDown,
  ...props
}: React.ComponentProps<'button'>) {
  const { value, min, disabled, decrement } = useNumberField()
  const isDisabled =
    disabled || (typeof min === 'number' && value !== null && value <= min)

  return (
    <button
      type="button"
      aria-label="Disminuir"
      disabled={isDisabled}
      onMouseDown={(event) => {
        event.preventDefault()
        onMouseDown?.(event)
      }}
      onClick={decrement}
      className={cn(
        'text-muted-foreground hover:bg-accent hover:text-foreground flex h-full w-9 shrink-0 items-center justify-center border-r transition-colors disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <Minus className="size-4" />
    </button>
  )
}

function NumberFieldIncrement({
  className,
  onMouseDown,
  ...props
}: React.ComponentProps<'button'>) {
  const { value, max, disabled, increment } = useNumberField()
  const isDisabled =
    disabled || (typeof max === 'number' && value !== null && value >= max)

  return (
    <button
      type="button"
      aria-label="Aumentar"
      disabled={isDisabled}
      onMouseDown={(event) => {
        event.preventDefault()
        onMouseDown?.(event)
      }}
      onClick={increment}
      className={cn(
        'text-muted-foreground hover:bg-accent hover:text-foreground flex h-full w-9 shrink-0 items-center justify-center border-l transition-colors disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <Plus className="size-4" />
    </button>
  )
}

export {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldScrubArea,
}
