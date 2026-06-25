import {
  openai_response_cancel,
  openai_response_status,
} from '../api/openaiResponses.api'
import { plans_get_maybe } from '../api/plans.api'
import { subjects_get_maybe } from '../api/subjects.api'
import { qk } from '../query/keys'
import { supabaseBrowser } from '../supabase/client'

import type { RealtimeChannel } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'

import { notify } from '@/lib/toast'

const TIMEOUT_MS = 15 * 60 * 1000
const STORAGE_KEY = 'acadia.ai-generations.v1'
const CANCELLED_DRAFT_KEY = 'acadia.ai-generation.cancelled-draft.v1'
const MAX_AGE_MS = 15 * 60 * 1000 // No reanudamos algo iniciado hace más de 15 min
const FAST_POLL_MS = 5 * 1000
const SLOW_POLL_MS = 15 * 1000
const FAST_POLL_WINDOW_MS = 60 * 1000

type NavigateFn = (path: string, opts?: { showConfetti?: boolean }) => void

type WatchHandle = {
  cancel: () => void
}

type GenerationDraft = {
  wizard: unknown
}

type PersistedEntry =
  | {
      kind: 'plan'
      planId: string
      planName?: string
      responseId?: string
      draft?: GenerationDraft
      startedAt: number
    }
  | {
      kind: 'subject'
      subjectId: string
      planId: string
      subjectName?: string
      responseId?: string
      draft?: GenerationDraft
      startedAt: number
    }

const activeChannels = new Map<string, RealtimeChannel>()
const activeTimeouts = new Map<string, number>()
const activePolls = new Map<string, number>()

export function serializeGenerationDraft<T>(draft: T): T {
  return JSON.parse(
    JSON.stringify(draft, (_key, value) => {
      if (typeof File !== 'undefined' && value instanceof File) {
        return {
          name: value.name,
          size: value.size,
          type: value.type,
          lastModified: value.lastModified,
        }
      }
      return value
    }),
  ) as T
}

export function consumeCancelledGenerationDraft<T>(
  kind: 'plan' | 'subject',
  matches?: (entry: PersistedEntry) => boolean,
): T | null {
  try {
    const raw = localStorage.getItem(CANCELLED_DRAFT_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as PersistedEntry
    if (entry.kind !== kind) return null
    if (matches && !matches(entry)) return null
    localStorage.removeItem(CANCELLED_DRAFT_KEY)
    return (entry.draft?.wizard ?? null) as T | null
  } catch {
    return null
  }
}

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

const stashCancelledDraft = (entry: PersistedEntry) => {
  try {
    localStorage.setItem(CANCELLED_DRAFT_KEY, JSON.stringify(entry))
  } catch {
    /* noop */
  }
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
  const poll = activePolls.get(toastId)
  if (poll) {
    window.clearTimeout(poll)
    activePolls.delete(toastId)
  }
}

const schedulePolling = (
  toastId: string,
  startedAt: number,
  poll: () => Promise<void>,
) => {
  if (activePolls.has(toastId)) return

  const tick = () => {
    if (!activeChannels.has(toastId)) return

    void poll()
      .catch((error) => {
        console.warn('[watchAIGeneration] OpenAI polling failed:', error)
      })
      .finally(() => {
        if (!activeChannels.has(toastId)) return
        const elapsed = Date.now() - startedAt
        const delay =
          elapsed < FAST_POLL_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS
        const timer = window.setTimeout(tick, delay)
        activePolls.set(toastId, timer)
      })
  }

  const timer = window.setTimeout(tick, FAST_POLL_MS)
  activePolls.set(toastId, timer)
}

type WatchPlanOptions = {
  planId: string
  planName?: string
  responseId?: string
  draft?: GenerationDraft
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
  const { planId, planName, queryClient, navigate, responseId, draft } = opts
  const toastId = `plan-gen:${planId}`
  const startedAt = opts.startedAt ?? Date.now()
  const persistedEntry: PersistedEntry = {
    kind: 'plan',
    planId,
    planName,
    responseId,
    draft,
    startedAt,
  }

  // Si ya hay un watcher activo para este plan, no duplicamos.
  if (activeChannels.has(toastId)) {
    return { cancel: () => {} }
  }

  persistEntry(persistedEntry)

  const cancelGeneration = async () => {
    if (!responseId) return

    notify.loading('Cancelando generación del plan...', {
      id: toastId,
      description: '',
      duration: Infinity,
    })

    try {
      await openai_response_cancel({
        kind: 'plan',
        entityId: planId,
        responseId,
      })
      cleanup(toastId)
      removePersistedEntry('plan', planId)
      if (draft) stashCancelledDraft(persistedEntry)
      queryClient.invalidateQueries({ queryKey: ['planes', 'list'] })
      notify.success('Generación cancelada', {
        id: toastId,
        description: 'Se restauraron los datos capturados.',
        duration: 6_000,
      })
      navigate('/planes/nuevo')
    } catch (error) {
      notify.error(error, {
        id: toastId,
        description: 'No se pudo cancelar la generación.',
        duration: 8_000,
      })
    }
  }

  notify.loading(
    planName
      ? `Generando plan "${planName}"...`
      : 'Generando plan de estudios...',
    {
      id: toastId,
      description: 'Esto puede tomar unos minutos.',
      duration: Infinity,
      action: responseId
        ? {
            label: 'Cancelar',
            onClick: () => {
              void cancelGeneration()
            },
          }
        : undefined,
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
          onClick: () => navigate(`/planes/${planId}`, { showConfetti: true }),
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
      finish(
        'success',
        planName ? `Plan "${planName}" generado` : 'Plan generado',
      )
      return
    }
    if (clave.startsWith('FALLIDO')) {
      finish('error', 'La generación del plan falló. Intenta de nuevo.')
    }
  }

  const pollOpenAI = async () => {
    if (!responseId || !activeChannels.has(toastId)) return
    const result = await openai_response_status({
      kind: 'plan',
      entityId: planId,
      responseId,
    })
    if (result.applied || result.status === 'completed') {
      await check()
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
      if (!responseId) {
        finish(
          'error',
          'Se perdió la conexión con el servidor. Recarga para ver el estado.',
        )
      }
    }
  })

  if (responseId) {
    schedulePolling(toastId, startedAt, pollOpenAI)
  }

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
  responseId?: string
  draft?: GenerationDraft
  queryClient: QueryClient
  navigate: NavigateFn
  startedAt?: number
}

export function watchSubjectGeneration(opts: WatchSubjectOptions): WatchHandle {
  const {
    subjectId,
    planId,
    subjectName,
    responseId,
    draft,
    queryClient,
    navigate,
  } = opts
  const toastId = `subject-gen:${subjectId}`
  const startedAt = opts.startedAt ?? Date.now()
  const persistedEntry: PersistedEntry = {
    kind: 'subject',
    subjectId,
    planId,
    subjectName,
    responseId,
    draft,
    startedAt,
  }

  if (activeChannels.has(toastId)) {
    return { cancel: () => {} }
  }

  persistEntry(persistedEntry)

  const cancelGeneration = async () => {
    if (!responseId) return

    notify.loading('Cancelando generación de la asignatura...', {
      id: toastId,
      description: '',
      duration: Infinity,
    })

    try {
      await openai_response_cancel({
        kind: 'subject',
        entityId: subjectId,
        responseId,
      })
      cleanup(toastId)
      removePersistedEntry('subject', subjectId)
      if (draft) stashCancelledDraft(persistedEntry)
      queryClient.invalidateQueries({
        queryKey: qk.planAsignaturas(planId as any),
      })
      notify.success('Generación cancelada', {
        id: toastId,
        description: 'Se restauraron los datos capturados.',
        duration: 6_000,
      })
      navigate(`/planes/${planId}/asignaturas/nueva`)
    } catch (error) {
      notify.error(error, {
        id: toastId,
        description: 'No se pudo cancelar la generación.',
        duration: 8_000,
      })
    }
  }

  notify.loading(
    subjectName
      ? `Generando asignatura "${subjectName}"...`
      : 'Generando asignatura...',
    {
      id: toastId,
      description: 'Esto puede tomar unos minutos.',
      duration: Infinity,
      action: responseId
        ? {
            label: 'Cancelar',
            onClick: () => {
              void cancelGeneration()
            },
          }
        : undefined,
    },
  )

  const finish = (kind: 'success' | 'error', message: string) => {
    cleanup(toastId)
    removePersistedEntry('subject', subjectId)
    queryClient.invalidateQueries({
      queryKey: qk.planAsignaturas(planId as any),
    })
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
    const subject = await subjects_get_maybe(subjectId as any).catch(() => null)
    if (!subject) return

    const estado = String((subject as any).estado ?? '').toLowerCase()
    if (estado === 'generando') return

    if (estado === 'fallido') {
      finish('error', 'La generación de la asignatura falló. Intenta de nuevo.')
      return
    }

    finish(
      'success',
      subjectName
        ? `Asignatura "${subjectName}" generada`
        : 'Asignatura generada',
    )
  }

  const pollOpenAI = async () => {
    if (!responseId || !activeChannels.has(toastId)) return
    const result = await openai_response_status({
      kind: 'subject',
      entityId: subjectId,
      responseId,
    })
    if (result.applied || result.status === 'completed') {
      await check()
    }
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
      if (!responseId) {
        finish(
          'error',
          'Se perdió la conexión con el servidor. Recarga para ver el estado.',
        )
      }
    }
  })

  if (responseId) {
    schedulePolling(toastId, startedAt, pollOpenAI)
  }

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
        responseId: entry.responseId,
        draft: entry.draft,
        queryClient: opts.queryClient,
        navigate: opts.navigate,
        startedAt: entry.startedAt,
      })
    } else {
      watchSubjectGeneration({
        subjectId: entry.subjectId,
        planId: entry.planId,
        subjectName: entry.subjectName,
        responseId: entry.responseId,
        draft: entry.draft,
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
