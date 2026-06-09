import { plans_get_maybe } from '../api/plans.api'
import { subjects_get_maybe } from '../api/subjects.api'
import { qk } from '../query/keys'
import { supabaseBrowser } from '../supabase/client'

import type { QueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { notify } from '@/lib/toast'

const TIMEOUT_MS = 6 * 60 * 1000
const STORAGE_KEY = 'acadia.ai-generations.v1'
const MAX_AGE_MS = 15 * 60 * 1000 // No reanudamos algo iniciado hace más de 15 min

type NavigateFn = (path: string, opts?: { showConfetti?: boolean }) => void

type WatchHandle = {
  cancel: () => void
}

type PersistedEntry =
  | {
      kind: 'plan'
      planId: string
      planName?: string
      startedAt: number
    }
  | {
      kind: 'subject'
      subjectId: string
      planId: string
      subjectName?: string
      startedAt: number
    }

const activeChannels = new Map<string, RealtimeChannel>()
const activeTimeouts = new Map<string, number>()

const safeReadStore = (): Array<PersistedEntry> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Array<PersistedEntry>) : []
  } catch {
    return []
  }
}

const safeWriteStore = (entries: Array<PersistedEntry>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* noop — storage full or disabled */
  }
}

const persistEntry = (entry: PersistedEntry) => {
  const current = safeReadStore()
  const id = entry.kind === 'plan' ? entry.planId : entry.subjectId
  const filtered = current.filter((e) => {
    if (e.kind !== entry.kind) return true
    const otherId = e.kind === 'plan' ? e.planId : e.subjectId
    return otherId !== id
  })
  safeWriteStore([...filtered, entry])
}

const removePersistedEntry = (kind: 'plan' | 'subject', id: string) => {
  const current = safeReadStore()
  const filtered = current.filter((e) => {
    if (e.kind !== kind) return true
    const otherId = e.kind === 'plan' ? e.planId : e.subjectId
    return otherId !== id
  })
  safeWriteStore(filtered)
}

const cleanup = (toastId: string) => {
  const ch = activeChannels.get(toastId)
  if (ch) {
    activeChannels.delete(toastId)
    try {
      supabaseBrowser().removeChannel(ch)
    } catch {
      /* noop */
    }
  }
  const t = activeTimeouts.get(toastId)
  if (t) {
    window.clearTimeout(t)
    activeTimeouts.delete(toastId)
  }
}

type WatchPlanOptions = {
  planId: string
  planName?: string
  queryClient: QueryClient
  navigate: NavigateFn
  /** Cuándo se inició la generación (epoch ms). Solo se usa al reanudar. */
  startedAt?: number
}

/**
 * Suscribe a `planes_estudio` por realtime y maneja el ciclo completo del
 * toast (loading → success/error). Es independiente del árbol de React y
 * persiste en localStorage para sobrevivir refreshes.
 */
export function watchPlanGeneration(opts: WatchPlanOptions): WatchHandle {
  const { planId, planName, queryClient, navigate } = opts
  const toastId = `plan-gen:${planId}`
  const startedAt = opts.startedAt ?? Date.now()

  // Si ya hay un watcher activo para este plan, no duplicamos.
  if (activeChannels.has(toastId)) {
    return { cancel: () => {} }
  }

  persistEntry({ kind: 'plan', planId, planName, startedAt })

  notify.loading(
    planName
      ? `Generando plan "${planName}"...`
      : 'Generando plan de estudios...',
    {
      id: toastId,
      description: 'Esto puede tomar unos minutos.',
      duration: Infinity,
    },
  )

  const finish = (kind: 'success' | 'error', message: string) => {
    cleanup(toastId)
    removePersistedEntry('plan', planId)
    queryClient.invalidateQueries({ queryKey: ['planes', 'list'] })
    if (kind === 'success') {
      notify.success(message, {
        id: toastId,
        description: '',
        duration: 10_000,
        action: {
          label: 'Ver plan',
          onClick: () =>
            navigate(`/planes/${planId}`, { showConfetti: true }),
        },
      })
    } else {
      notify.error(message, {
        id: toastId,
        description: '',
        duration: 8_000,
      })
    }
  }

  const check = async () => {
    if (!activeChannels.has(toastId)) return
    const plan = await plans_get_maybe(planId as any).catch(() => null)
    if (!plan) return

    const clave = String(plan.estados_plan?.clave ?? '').toUpperCase()
    if (clave.startsWith('GENERANDO')) return

    if (clave.startsWith('BORRADOR')) {
      finish('success', planName ? `Plan "${planName}" generado` : 'Plan generado')
      return
    }
    if (clave.startsWith('FALLIDO')) {
      finish('error', 'La generación del plan falló. Intenta de nuevo.')
    }
  }

  queryClient.invalidateQueries({ queryKey: ['planes', 'list'] })

  const supabase = supabaseBrowser()
  const channel = supabase.channel(`planes-status-${planId}`)
  activeChannels.set(toastId, channel)

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'planes_estudio',
      filter: `id=eq.${planId}`,
    },
    () => {
      void check()
    },
  )

  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      if (!activeChannels.has(toastId)) return
      finish(
        'error',
        'Se perdió la conexión con el servidor. Recarga para ver el estado.',
      )
    }
  })

  // Timeout relativo al inicio real (no al momento de reanudar) para que un
  // refresh tardío no extienda el deadline indefinidamente.
  const remainingMs = Math.max(1000, TIMEOUT_MS - (Date.now() - startedAt))
  const timeout = window.setTimeout(() => {
    if (!activeChannels.has(toastId)) return
    finish(
      'error',
      'La generación está tardando demasiado. Recarga la página en unos minutos para ver el estado.',
    )
  }, remainingMs)
  activeTimeouts.set(toastId, timeout)

  void check()

  return {
    cancel: () => {
      cleanup(toastId)
      removePersistedEntry('plan', planId)
      notify.dismiss(toastId)
    },
  }
}

type WatchSubjectOptions = {
  subjectId: string
  planId: string
  subjectName?: string
  queryClient: QueryClient
  navigate: NavigateFn
  startedAt?: number
}

export function watchSubjectGeneration(opts: WatchSubjectOptions): WatchHandle {
  const { subjectId, planId, subjectName, queryClient, navigate } = opts
  const toastId = `subject-gen:${subjectId}`
  const startedAt = opts.startedAt ?? Date.now()

  if (activeChannels.has(toastId)) {
    return { cancel: () => {} }
  }

  persistEntry({
    kind: 'subject',
    subjectId,
    planId,
    subjectName,
    startedAt,
  })

  notify.loading(
    subjectName
      ? `Generando asignatura "${subjectName}"...`
      : 'Generando asignatura...',
    {
      id: toastId,
      description: 'Esto puede tomar unos minutos.',
      duration: Infinity,
    },
  )

  const finish = (kind: 'success' | 'error', message: string) => {
    cleanup(toastId)
    removePersistedEntry('subject', subjectId)
    queryClient.invalidateQueries({ queryKey: qk.planAsignaturas(planId as any) })
    if (kind === 'success') {
      notify.success(message, {
        id: toastId,
        description: '',
        duration: 10_000,
        action: {
          label: 'Ver asignatura',
          onClick: () =>
            navigate(`/planes/${planId}/asignaturas/${subjectId}`, {
              showConfetti: true,
            }),
        },
      })
    } else {
      notify.error(message, {
        id: toastId,
        description: '',
        duration: 8_000,
      })
    }
  }

  const check = async () => {
    if (!activeChannels.has(toastId)) return
    const subject = await subjects_get_maybe(subjectId as any).catch(
      () => null,
    )
    if (!subject) return

    const estado = String((subject as any).estado ?? '').toLowerCase()
    if (estado === 'generando') return

    if (estado === 'fallido') {
      finish('error', 'La generación de la asignatura falló. Intenta de nuevo.')
      return
    }

    finish(
      'success',
      subjectName ? `Asignatura "${subjectName}" generada` : 'Asignatura generada',
    )
  }

  queryClient.invalidateQueries({ queryKey: qk.planAsignaturas(planId as any) })

  const supabase = supabaseBrowser()
  const channel = supabase.channel(`asignaturas-status-${subjectId}`)
  activeChannels.set(toastId, channel)

  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'asignaturas',
      filter: `id=eq.${subjectId}`,
    },
    () => {
      void check()
    },
  )

  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      if (!activeChannels.has(toastId)) return
      finish(
        'error',
        'Se perdió la conexión con el servidor. Recarga para ver el estado.',
      )
    }
  })

  const remainingMs = Math.max(1000, TIMEOUT_MS - (Date.now() - startedAt))
  const timeout = window.setTimeout(() => {
    if (!activeChannels.has(toastId)) return
    finish(
      'error',
      'La generación está tardando demasiado. Recarga la página en unos minutos para ver el estado.',
    )
  }, remainingMs)
  activeTimeouts.set(toastId, timeout)

  void check()

  return {
    cancel: () => {
      cleanup(toastId)
      removePersistedEntry('subject', subjectId)
      notify.dismiss(toastId)
    },
  }
}

/**
 * Reanuda cualquier generación que estaba en curso antes del último refresh.
 * Llamar UNA sola vez al boot de la app (por ejemplo, en un componente
 * montado en el árbol del router).
 */
export function resumePersistedGenerations(opts: {
  queryClient: QueryClient
  navigate: NavigateFn
}) {
  const entries = safeReadStore()
  if (entries.length === 0) return

  const now = Date.now()
  const fresh: Array<PersistedEntry> = []

  for (const entry of entries) {
    const age = now - entry.startedAt
    if (age > MAX_AGE_MS) continue
    fresh.push(entry)

    if (entry.kind === 'plan') {
      watchPlanGeneration({
        planId: entry.planId,
        planName: entry.planName,
        queryClient: opts.queryClient,
        navigate: opts.navigate,
        startedAt: entry.startedAt,
      })
    } else {
      watchSubjectGeneration({
        subjectId: entry.subjectId,
        planId: entry.planId,
        subjectName: entry.subjectName,
        queryClient: opts.queryClient,
        navigate: opts.navigate,
        startedAt: entry.startedAt,
      })
    }
  }

  // Limpia entradas obsoletas (>15 min).
  if (fresh.length !== entries.length) {
    safeWriteStore(fresh)
  }
}
