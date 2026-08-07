import * as React from 'react'

import { cn } from '@/lib/utils'

type EditableTextProps = {
  value: string
  onSave: (value: string) => void
  onCancel?: () => void
  onEditStart?: () => void
  onEditEnd?: () => void
  editable?: boolean
  className?: string
  placeholder?: string
  maxLength?: number
  multiline?: boolean
  ariaLabel?: string
}

function stripHtmlToText(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent
}

function EditableText({
  value,
  onSave,
  onCancel,
  onEditStart,
  onEditEnd,
  editable = true,
  className,
  placeholder,
  maxLength,
  multiline = false,
  ariaLabel,
}: EditableTextProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const cancelNextBlurRef = React.useRef(false)

  // Sincroniza el contenido visible cuando no estamos editando.
  React.useEffect(() => {
    if (isEditing || !ref.current) return
    const current = ref.current.textContent
    if (current !== value) {
      ref.current.textContent = value
    }
  }, [value, isEditing])

  const commit = React.useCallback(() => {
    if (!ref.current) return
    const trimmed = ref.current.textContent.trim()
    setIsEditing(false)
    if (trimmed !== value) onSave(trimmed)
    else ref.current.textContent = value
  }, [onSave, value])

  const cancel = React.useCallback(() => {
    setIsEditing(false)
    if (ref.current) ref.current.textContent = value
    onCancel?.()
    onEditEnd?.()
  }, [onCancel, onEditEnd, value])

  const handleFocus = React.useCallback(() => {
    if (!editable || isEditing) return
    setIsEditing(true)
    onEditStart?.()
    // Asegura que el borrador inicie con el valor actual
    if (ref.current) ref.current.textContent = value
  }, [editable, isEditing, onEditStart, value])

  const handleBlur = React.useCallback(() => {
    if (cancelNextBlurRef.current) {
      cancelNextBlurRef.current = false
      return
    }
    if (!isEditing) return
    commit()
    onEditEnd?.()
  }, [isEditing, commit, onEditEnd])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (!isEditing) return
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault()
        e.currentTarget.blur()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelNextBlurRef.current = true
        cancel()
        e.currentTarget.blur()
        return
      }
    },
    [isEditing, multiline, cancel],
  )

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLSpanElement>) => {
      if (!isEditing) return
      e.preventDefault()
      const text = stripHtmlToText(e.clipboardData.getData('text/plain'))
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        if (ref.current) {
          const next = maxLength ? text.slice(0, maxLength) : text
          ref.current.textContent = next
        }
        return
      }
      const range = selection.getRangeAt(0)
      range.deleteContents()
      const node = document.createTextNode(text)
      range.insertNode(node)
      range.setStartAfter(node)
      range.setEndAfter(node)
      selection.removeAllRanges()
      selection.addRange(range)
      if (maxLength && ref.current && ref.current.textContent) {
        ref.current.textContent = ref.current.textContent.slice(0, maxLength)
      }
      // Dispara un input manual para mantener consistencia si fuera necesario
      e.currentTarget.dispatchEvent(new Event('input', { bubbles: true }))
    },
    [isEditing, maxLength],
  )

  const handleInput = React.useCallback(
    (e: React.FormEvent<HTMLSpanElement>) => {
      const target = e.currentTarget
      if (
        maxLength &&
        target.textContent &&
        target.textContent.length > maxLength
      ) {
        target.textContent = target.textContent.slice(0, maxLength)
      }
    },
    [maxLength],
  )

  const isEmpty = !value

  return (
    <span
      ref={ref}
      role="textbox"
      tabIndex={editable ? 0 : undefined}
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      contentEditable={editable}
      suppressContentEditableWarning
      spellCheck={false}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onInput={handleInput}
      className={cn(
        'px-micro py-micro rounded-sm transition-all duration-200 outline-none',
        editable ? 'cursor-text' : 'cursor-default caret-transparent',
        !isEditing &&
          editable &&
          'hover:bg-accent/40 focus-visible:bg-accent/40',
        isEmpty &&
          !isEditing &&
          'text-muted-foreground/70 italic before:pointer-events-none before:content-[attr(data-placeholder)]',
        className,
      )}
    >
      {value}
    </span>
  )
}

export { EditableText }
export type { EditableTextProps }
