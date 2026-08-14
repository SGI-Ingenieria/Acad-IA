import { Minus, Plus } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

type EditableNumberProps = {
  value: number | null
  onSave: (value: number | null) => void
  onEditStart?: () => void
  onEditEnd?: () => void
  min?: number
  max?: number
  step?: number
  editable?: boolean
  className?: string
  suffix?: string
  prefix?: string
  ariaLabel?: string
  /** Texto visible cuando todavía no existe un valor. */
  placeholder?: string
  /** Tamaño visual del número y de los controles. */
  size?: 'default' | 'lg'
  /** Añade un subrayado (borde inferior) al número, como campo de captura. */
  underline?: boolean
  /** Superpone los controles laterales para no reservarles espacio al estar ocultos. */
  overlayControls?: boolean
  /**
   * Oculta los pasos `+` / `−`. Se usa cuando el clic ya no incrementa —el modo
   * agente lo reasigna a la IA— para no ofrecer un control que miente. El número
   * sigue siendo un `spinbutton` enfocable.
   */
  showControls?: boolean
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  return String(value)
}

function parseNumericInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (normalized === '' || normalized === '.' || normalized === '-') return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function clampValue(value: number, min?: number, max?: number): number {
  let next = value
  if (typeof min === 'number') next = Math.max(next, min)
  if (typeof max === 'number') next = Math.min(next, max)
  return next
}

function EditableNumber({
  value,
  onSave,
  onEditStart,
  onEditEnd,
  min,
  max,
  step = 1,
  editable = true,
  className,
  suffix = '',
  prefix = '',
  ariaLabel,
  placeholder = '',
  size = 'default',
  underline = false,
  overlayControls = false,
  showControls = true,
}: EditableNumberProps) {
  const isLg = size === 'lg'
  const ref = React.useRef<HTMLSpanElement>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const cancelNextBlurRef = React.useRef(false)

  const isDecimal = step % 1 !== 0

  // Sincroniza la representación visible con el valor prop cuando no editamos.
  React.useEffect(() => {
    if (isEditing || !ref.current) return
    const text =
      value === null ? placeholder : `${prefix}${formatNumber(value)}${suffix}`
    if (ref.current.textContent !== text) {
      ref.current.textContent = text
    }
  }, [isEditing, value, prefix, suffix, placeholder])

  const persist = React.useCallback(
    (raw: string) => {
      const parsed = parseNumericInput(raw)
      if (parsed === null) {
        setIsEditing(false)
        onEditEnd?.()
        if (ref.current) {
          ref.current.textContent =
            value === null
              ? placeholder
              : `${prefix}${formatNumber(value)}${suffix}`
        }
        return
      }
      const nextValue = clampValue(
        isDecimal ? Math.round(parsed * 100) / 100 : Math.round(parsed),
        min,
        max,
      )
      setIsEditing(false)
      onEditEnd?.()
      if (nextValue !== value) {
        onSave(nextValue)
      } else if (ref.current) {
        ref.current.textContent = `${prefix}${formatNumber(value)}${suffix}`
      }
    },
    [
      isDecimal,
      max,
      min,
      onEditEnd,
      onSave,
      placeholder,
      prefix,
      suffix,
      value,
    ],
  )

  const commit = React.useCallback(() => {
    if (!ref.current) return
    const raw = (ref.current.textContent || '')
      .replace(prefix, '')
      .replace(suffix, '')
    persist(raw)
  }, [persist, prefix, suffix])

  const cancel = React.useCallback(() => {
    setIsEditing(false)
    onEditEnd?.()
    if (ref.current) {
      ref.current.textContent =
        value === null
          ? placeholder
          : `${prefix}${formatNumber(value)}${suffix}`
    }
  }, [onEditEnd, placeholder, prefix, suffix, value])

  const moveBy = React.useCallback(
    (direction: 1 | -1) => {
      if (!editable) return
      let base = value
      if (base === null || !Number.isFinite(base)) {
        base =
          direction > 0
            ? typeof min === 'number'
              ? min
              : 0
            : typeof max === 'number'
              ? max
              : 0
      }
      const next = clampValue(
        isDecimal
          ? Math.round((base + direction * step) * 100) / 100
          : Math.round(base + direction * step),
        min,
        max,
      )
      if (ref.current) ref.current.textContent = formatNumber(next)
      onSave(next)
    },
    [editable, isDecimal, max, min, onSave, step, value],
  )

  const decrementDisabled =
    !editable || (typeof min === 'number' && value !== null && value <= min)
  const incrementDisabled =
    !editable || (typeof max === 'number' && value !== null && value >= max)
  const controlesActivos = showControls && editable && isEditing
  const tamanoControl = isLg ? 'h-8 w-9' : 'h-5 w-7'

  const handleFocus = React.useCallback(() => {
    if (!editable || isEditing) return
    setIsEditing(true)
    onEditStart?.()
    if (ref.current) ref.current.textContent = formatNumber(value)
  }, [editable, isEditing, onEditStart, value])

  const handleBlur = React.useCallback(() => {
    if (cancelNextBlurRef.current) {
      cancelNextBlurRef.current = false
      return
    }
    if (!isEditing) return
    commit()
  }, [isEditing, commit])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (!isEditing) return
      const allowed = [
        'Backspace',
        'ArrowLeft',
        'ArrowRight',
        'Tab',
        'Enter',
        'Escape',
        'Delete',
        'Home',
        'End',
      ]
      if (allowed.includes(e.key)) {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancelNextBlurRef.current = true
          cancel()
          e.currentTarget.blur()
        }
        return
      }
      if (/^\d$/.test(e.key)) return
      if ((e.key === '.' || e.key === ',') && isDecimal) {
        const text = e.currentTarget.textContent
        if (!text || (!text.includes('.') && !text.includes(','))) return
      }
      if (e.key === '-' && typeof min === 'number' && min < 0) {
        const text = e.currentTarget.textContent
        if (!text || text.length === 0) return
      }
      e.preventDefault()
    },
    [isEditing, isDecimal, min, cancel],
  )

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLSpanElement>) => {
      if (!isEditing) return
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain').trim()
      const numeric = text.replace(/[^\d.,-]/g, '')
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        if (ref.current) ref.current.textContent = numeric
        return
      }
      const range = selection.getRangeAt(0)
      range.deleteContents()
      const node = document.createTextNode(numeric)
      range.insertNode(node)
      range.setStartAfter(node)
      range.setEndAfter(node)
      selection.removeAllRanges()
      selection.addRange(range)
    },
    [isEditing],
  )

  const displayText =
    value === null ? placeholder : `${prefix}${formatNumber(value)}${suffix}`

  return (
    <span
      data-state={isEditing ? 'active' : 'inactive'}
      className={cn(
        'group inline-flex items-center rounded-md transition-[background-color] duration-200',
        overlayControls ? 'relative' : 'overflow-hidden',
        editable &&
          (isEditing ? 'bg-accent/40' : 'hover:bg-accent/40 cursor-pointer'),
        className,
      )}
    >
      {showControls && (
        <span
          aria-hidden={!controlesActivos}
          className={cn(
            'flex shrink-0 items-center overflow-hidden transition-[width,opacity,transform] duration-200 ease-out',
            overlayControls &&
              'mr-micro pointer-events-none absolute top-1/2 right-full z-10 -translate-x-1 -translate-y-1/2',
            !overlayControls && 'w-0',
            controlesActivos
              ? overlayControls
                ? 'pointer-events-auto translate-x-0 opacity-100'
                : `${tamanoControl} pointer-events-auto opacity-100`
              : 'pointer-events-none -translate-x-1 opacity-0',
          )}
        >
          <button
            type="button"
            aria-label="Disminuir"
            // Fuera del recorrido del tabulador: son atajos de ratón; el
            // `spinbutton` conserva el acceso por teclado.
            tabIndex={-1}
            disabled={decrementDisabled}
            onClick={() => moveBy(-1)}
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              'text-muted-foreground hover:bg-accent hover:text-foreground flex shrink-0 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30',
              tamanoControl,
            )}
          >
            <Minus className={cn(isLg ? 'h-4 w-4' : 'h-3 w-3')} />
          </button>
        </span>
      )}

      <span
        ref={ref}
        role="spinbutton"
        aria-label={ariaLabel}
        aria-valuenow={value ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        contentEditable={editable}
        suppressContentEditableWarning
        inputMode={isEditing ? 'decimal' : undefined}
        tabIndex={editable ? 0 : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={cn(
          // En reposo el control mantiene aire lateral alrededor del valor. Al
          // activarlo abre los pasos sin reservar un área invisible.
          'px-relacionado min-w-[1ch] text-center tabular-nums outline-none select-none',
          isLg ? 'py-micro text-2xl font-semibold' : 'py-micro',
          underline
            ? 'border-border/60 hover:border-primary/60 focus-within:border-primary rounded-none border-b-2'
            : 'rounded-sm',
          editable
            ? isEditing
              ? 'cursor-text'
              : 'cursor-pointer caret-transparent'
            : 'cursor-default caret-transparent',
        )}
      >
        {displayText}
      </span>

      {showControls && (
        <span
          aria-hidden={!controlesActivos}
          className={cn(
            'flex shrink-0 items-center overflow-hidden transition-[width,opacity,transform] duration-200 ease-out',
            overlayControls &&
              'ml-micro pointer-events-none absolute top-1/2 left-full z-10 translate-x-1 -translate-y-1/2',
            !overlayControls && 'w-0',
            controlesActivos
              ? overlayControls
                ? 'pointer-events-auto translate-x-0 opacity-100'
                : `${tamanoControl} pointer-events-auto opacity-100`
              : 'pointer-events-none translate-x-1 opacity-0',
          )}
        >
          <button
            type="button"
            aria-label="Aumentar"
            tabIndex={-1}
            disabled={incrementDisabled}
            onClick={() => moveBy(1)}
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              'text-muted-foreground hover:bg-accent hover:text-foreground flex shrink-0 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30',
              tamanoControl,
            )}
          >
            <Plus className={cn(isLg ? 'h-4 w-4' : 'h-3 w-3')} />
          </button>
        </span>
      )}
    </span>
  )
}

export { EditableNumber }
export type { EditableNumberProps }
