import { useEffect } from 'react'

import type { RefObject } from 'react'

/**
 * Marcatextos de comentarios: pinta rangos [from, until) —offsets sobre el
 * `textContent` del contenedor, los mismos que captura `useTextSelection` y
 * guarda `ComentarioReferencia`— envolviendo los nodos de texto en `<mark>`.
 *
 * No modifica el texto (solo lo envuelve), así los offsets de otros rangos
 * siguen siendo válidos y el desmontaje restaura el DOM original.
 */

export type CommentHighlight = {
  id: string
  from: number
  until: number
}

const MARK_ATTR = 'data-comment-mark'

const MARK_CLASS =
  'cursor-pointer rounded-[2px] bg-primary/15 text-inherit transition-colors hover:bg-primary/25'

function clearHighlights(container: HTMLElement) {
  for (const mark of container.querySelectorAll(`mark[${MARK_ATTR}]`)) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
  }
  container.normalize()
}

function wrapRange(
  container: HTMLElement,
  highlight: CommentHighlight,
  onClick?: (id: string) => void,
) {
  // Recolectamos primero los tramos por nodo; partir nodos durante el
  // recorrido invalidaría el TreeWalker.
  const segments: Array<{ node: Text; start: number; end: number }> = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let offset = 0
  let current: Node | null

  while ((current = walker.nextNode())) {
    const text = current as Text
    const length = text.data.length
    const nodeStart = offset
    const nodeEnd = offset + length
    offset = nodeEnd

    const start = Math.max(highlight.from, nodeStart)
    const end = Math.min(highlight.until, nodeEnd)
    if (start >= end) continue

    segments.push({
      node: text,
      start: start - nodeStart,
      end: end - nodeStart,
    })
  }

  for (const segment of segments) {
    let target = segment.node
    if (segment.start > 0) target = target.splitText(segment.start)
    if (segment.end - segment.start < target.data.length) {
      target.splitText(segment.end - segment.start)
    }

    const mark = document.createElement('mark')
    mark.setAttribute(MARK_ATTR, highlight.id)
    mark.className = MARK_CLASS
    if (onClick) {
      mark.addEventListener('click', () => onClick(highlight.id))
    }
    target.parentNode?.insertBefore(mark, target)
    mark.appendChild(target)
  }
}

/**
 * Aplica los marcatextos sobre el contenido ya renderizado. `contentKey` debe
 * cambiar cuando el HTML del contenedor cambie (p. ej. el propio HTML) para
 * re-aplicar las marcas tras un re-render.
 */
export function useCommentHighlights(
  containerRef: RefObject<HTMLElement | null>,
  highlights: Array<CommentHighlight>,
  contentKey: string,
  onClick?: (id: string) => void,
) {
  const highlightsKey = highlights
    .map((h) => `${h.id}:${h.from}-${h.until}`)
    .join('|')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    clearHighlights(container)
    for (const highlight of highlights) {
      wrapRange(container, highlight, onClick)
    }

    return () => clearHighlights(container)
    // highlightsKey/contentKey representan a highlights y al HTML renderizado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, highlightsKey, contentKey, onClick])
}
