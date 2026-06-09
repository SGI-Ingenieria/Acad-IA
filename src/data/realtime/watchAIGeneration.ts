import { plans_get_maybe } from '../api/plans.api'
import { subjects_get_maybe } from '../api/subjects.api'
import { qk } from '../query/keys'
import { supabaseBrowser } from '../supabase/client'

import type { QueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { notify } from '@/lib/toast'

const TIMEOUT_MS = 6 * 60 * 1000

type NavigateFn = (path: string, opts?: { showConfetti?: boolean }) => void

type WatchHandle = {
  cancel: () => void
}

const activeChannels = new Map<string, RealtimeChannel>()
const activeTimeouts = new Map<string, number>()

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
}

/**
 * Suscribe a `planes_estudio` por realtime y maneja el ciclo completo del
 * toast (loading → success/error). Es independiente del árbol de React: una
 * vez disparada, sobrevive a la navegación entre rutas.
 */
export function watchPlanGeneration(opts: WatchPlanOptions): WatchHandle {
  const { planId, planName, queryClient, navigate } = opts
  const toastId = `plan-gen:${planId}`

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
    queryClient.invalidateQueries({ queryKey: ['planes', 'list'] })
    if (kind === 'success') {
      notify.success(message, {
        id: toastId,
        duration: 10_000,
        action: {
          label: 'Ver plan',
          onClick: () =>
            navigate(`/planes/${planId}`, { showConfetti: true }),
        },
      })
    } else {
      notify.error(message, { id: toastId, duration: 8_000 })
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

  const timeout = window.setTimeout(() => {
    if (!activeChannels.has(toastId)) return
    finish(
      'error',
      'La generación está tardando demasiado. Recarga la página en unos minutos para ver el estado.',
    )
  }, TIMEOUT_MS)
  activeTimeouts.set(toastId, timeout)

  void check()

  return {
    cancel: () => {
      cleanup(toastId)
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
}

export function watchSubjectGeneration(opts: WatchSubjectOptions): WatchHandle {
  const { subjectId, planId, subjectName, queryClient, navigate } = opts
  const toastId = `subject-gen:${subjectId}`

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
    queryClient.invalidateQueries({ queryKey: qk.planAsignaturas(planId as any) })
    if (kind === 'success') {
      notify.success(message, {
        id: toastId,
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
      notify.error(message, { id: toastId, duration: 8_000 })
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

    // borrador / activo / cualquier otro estado finalizado → éxito
    finish(
      'success',
      subjectName ? `Asignatura "${subjectName}" generada` : 'Asignatura generada',
    )
  }

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

  const timeout = window.setTimeout(() => {
    if (!activeChannels.has(toastId)) return
    finish(
      'error',
      'La generación está tardando demasiado. Recarga la página en unos minutos para ver el estado.',
    )
  }, TIMEOUT_MS)
  activeTimeouts.set(toastId, timeout)

  void check()

  return {
    cancel: () => {
      cleanup(toastId)
      notify.dismiss(toastId)
    },
  }
}
