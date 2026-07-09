import { useCallback, useSyncExternalStore } from 'react'

import type { ComentarioPlan } from '@/data/types/domain'

/**
 * Estado de "leído" de los comentarios, persistido en localStorage por destino
 * (plan o asignatura). Guardamos la fecha ISO del último comentario visto; los
 * comentarios más nuevos que esa marca —y que no escribió el propio usuario—
 * cuentan como no leídos.
 *
 * Es reactivo entre componentes (burbuja y panel) vía un evento propio, para
 * que al abrir el panel y marcar como leído la burbuja se actualice al instante.
 */

const CHANGE_EVENT = 'acad-ia:comments-seen-change'

function keyFor(planId: string, asignaturaId?: string | null): string {
  return `acad-ia:comments-seen:${planId}:${asignaturaId ?? 'plan'}`
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

function readLastSeen(key: string): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(key) ?? ''
}

export function useCommentsRead(
  planId: string,
  asignaturaId?: string | null,
): {
  lastSeen: string
  markAllRead: (comentarios: Array<ComentarioPlan>) => void
} {
  const key = keyFor(planId, asignaturaId)

  const lastSeen = useSyncExternalStore(
    subscribe,
    () => readLastSeen(key),
    () => '',
  )

  const markAllRead = useCallback(
    (comentarios: Array<ComentarioPlan>) => {
      if (comentarios.length === 0) return
      const latest = comentarios.reduce(
        (max, c) => (c.creado_en > max ? c.creado_en : max),
        '',
      )
      if (!latest || latest === readLastSeen(key)) return
      window.localStorage.setItem(key, latest)
      window.dispatchEvent(new Event(CHANGE_EVENT))
    },
    [key],
  )

  return { lastSeen, markAllRead }
}

/** Cuenta los comentarios no leídos (más nuevos que la marca y de otros autores). */
export function countUnread(
  comentarios: Array<ComentarioPlan>,
  lastSeen: string,
  currentUserId: string | null,
): number {
  return comentarios.filter(
    (c) =>
      c.autor_id !== currentUserId &&
      (lastSeen === '' || c.creado_en > lastSeen),
  ).length
}
