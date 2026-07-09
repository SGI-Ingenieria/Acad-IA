import { useCallback, useEffect, useRef, useState } from 'react'

export type TextSelectionCapture = {
  text: string
  containerSelector: string
  from: number
  until: number
  rect: DOMRect
}

const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'])

function findCommentScopeContainer(node: Node | null): Element | null {
  let current: Node | null = node
  while (current && current instanceof Element) {
    if (current.hasAttribute('data-comment-scope')) {
      return current
    }
    current = current.parentElement
  }
  return null
}

function isInEditableField(node: Node | null): boolean {
  let current: Node | null = node
  while (current && current instanceof Element) {
    const tag = current.tagName
    if (IGNORED_TAGS.has(tag)) return true
    if (
      current.getAttribute('role') === 'textbox' ||
      current.getAttribute('contenteditable') === 'true'
    ) {
      return true
    }
    current = current.parentElement
  }
  return false
}

function computeSelector(element: Element): string {
  const scope = element.getAttribute('data-comment-scope')
  const key = element.getAttribute('data-comment-key')
  if (scope && key) {
    return `[data-comment-scope="${scope}"][data-comment-key="${key}"]`
  }
  if (scope) {
    return `[data-comment-scope="${scope}"]`
  }
  if (element.id) {
    return `#${element.id}`
  }
  return element.tagName.toLowerCase()
}

export function useTextSelection(enabled: boolean) {
  const [selection, setSelection] = useState<TextSelectionCapture | null>(null)
  const captureRef = useRef<TextSelectionCapture | null>(null)

  const clearSelection = useCallback(() => {
    setSelection(null)
    captureRef.current = null
  }, [])

  const handleChange = useCallback(() => {
    if (!enabled) return

    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      clearSelection()
      return
    }

    const range = sel.getRangeAt(0)
    const text = sel.toString().trim()
    if (text.length === 0) {
      clearSelection()
      return
    }

    if (isInEditableField(range.commonAncestorContainer)) {
      clearSelection()
      return
    }

    const container = findCommentScopeContainer(range.commonAncestorContainer)
    if (!container) {
      clearSelection()
      return
    }

    const containerText = container.textContent
    const startOffset = getTextOffset(
      container,
      range.startContainer,
      range.startOffset,
    )
    const endOffset = getTextOffset(
      container,
      range.endContainer,
      range.endOffset,
    )

    if (startOffset < 0 || endOffset <= startOffset) {
      clearSelection()
      return
    }

    const capture: TextSelectionCapture = {
      text,
      containerSelector: computeSelector(container),
      from: startOffset,
      until: Math.min(endOffset, containerText.length),
      rect: range.getBoundingClientRect(),
    }

    captureRef.current = capture
    setSelection(capture)
  }, [enabled, clearSelection])

  useEffect(() => {
    if (!enabled) return

    document.addEventListener('selectionchange', handleChange)
    document.addEventListener('mouseup', handleChange)
    document.addEventListener('scroll', clearSelection, true)
    window.addEventListener('resize', clearSelection)

    return () => {
      document.removeEventListener('selectionchange', handleChange)
      document.removeEventListener('mouseup', handleChange)
      document.removeEventListener('scroll', clearSelection, true)
      window.removeEventListener('resize', clearSelection)
    }
  }, [enabled, handleChange, clearSelection])

  return {
    selection,
    getLastCapture: () => captureRef.current,
    clearSelection,
  }
}

function getTextOffset(root: Element, node: Node, nodeOffset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let offset = 0
  let current: Node | null
  while ((current = walker.nextNode())) {
    if (current === node) {
      return offset + nodeOffset
    }
    offset += current.textContent?.length ?? 0
  }
  return -1
}
