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
}: EditableNumberProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const cancelNextBlurRef = React.useRef(false)

  const isDecimal = step % 1 !== 0

  // Sincroniza la representación visible con el valor prop cuando no editamos.
  React.useEffect(() => {
    if (isEditing || !ref.current) return
    const text = `${prefix}${formatNumber(value)}${suffix}`
    if (ref.current.textContent !== text) {
      ref.current.textContent = text
    }
  }, [isEditing, value, prefix, suffix])

  const persist = React.useCallback(
    (raw: string) => {
      const parsed = parseNumericInput(raw)
      if (parsed === null) {
        setIsEditing(false)
        onEditEnd?.()
        if (ref.current) {
          ref.current.textContent = `${prefix}${formatNumber(value)}${suffix}`
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
    [isDecimal, max, min, onEditEnd, onSave, prefix, suffix, value],
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
      ref.current.textContent = `${prefix}${formatNumber(value)}${suffix}`
    }
  }, [onEditEnd, prefix, suffix, value])

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
      onSave(next)
    },
    [editable, isDecimal, max, min, onSave, step, value],
  )

  const decrementDisabled =
    !editable || (typeof min === 'number' && value !== null && value <= min)
  const incrementDisabled =
    !editable || (typeof max === 'number' && value !== null && value >= max)

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

  const displayText = `${prefix}${formatNumber(value)}${suffix}`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md transition-all duration-200',
        editable ? 'hover:bg-accent/40' : '',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Disminuir"
        disabled={decrementDisabled}
        onClick={() => moveBy(-1)}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all',
          'text-muted-foreground hover:bg-accent hover:text-foreground',
          'disabled:pointer-events-none disabled:opacity-30',
        )}
      >
        <Minus className="h-3 w-3" />
      </button>

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
          'min-w-[1ch] rounded-sm px-1 py-0.5 text-center tabular-nums transition-all duration-200 outline-none select-none',
          editable ? 'cursor-text' : 'cursor-default [caret-color:transparent]',
          isEditing && [
            'border-primary/60 bg-accent/20 border-b shadow-sm',
            'focus-visible:border-primary focus-visible:bg-accent/30',
          ],
        )}
      >
        {displayText}
      </span>

      <button
        type="button"
        aria-label="Aumentar"
        disabled={incrementDisabled}
        onClick={() => moveBy(1)}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all',
          'text-muted-foreground hover:bg-accent hover:text-foreground',
          'disabled:pointer-events-none disabled:opacity-30',
        )}
      >
        <Plus className="h-3 w-3" />
      </button>
    </span>
  )
}

export { EditableNumber }
export type { EditableNumberProps }
