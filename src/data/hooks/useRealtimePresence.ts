import { useEffect, useMemo, useRef, useState } from 'react'

import { supabaseBrowser } from '../supabase/client'

import { useMeProfile } from './useAuth'

import { getInitials } from '@/lib/initials'

export interface PresenceUser {
  user_id: string
  nombre_completo: string
  iniciales: string
  asignatura_activa: {
    id: string
    nombre: string
    clave: string
  } | null
  online_at: string
}

interface TrackPayload {
  user_id: string
  nombre_completo: string
  iniciales: string
  asignatura_activa: PresenceUser['asignatura_activa']
  online_at: string
}

function samePresenceState(
  a: Record<string, Array<PresenceUser>>,
  b: Record<string, Array<PresenceUser>>,
) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false

  for (const key of aKeys) {
    const aItems = a[key] ?? []
    const bItems = b[key] ?? []
    if (aItems.length !== bItems.length) return false

    for (let i = 0; i < aItems.length; i += 1) {
      const left = aItems[i]
      const right = bItems[i]
      if (
        left.user_id !== right.user_id ||
        left.nombre_completo !== right.nombre_completo ||
        left.iniciales !== right.iniciales ||
        left.online_at !== right.online_at ||
        left.asignatura_activa?.id !== right.asignatura_activa?.id ||
        left.asignatura_activa?.nombre !== right.asignatura_activa?.nombre ||
        left.asignatura_activa?.clave !== right.asignatura_activa?.clave
      ) {
        return false
      }
    }
  }

  return true
}

/**
 * Hook de Supabase Realtime Presence para mostrar usuarios conectados
 * a un mismo plan de estudios y opcionalmente a una asignatura específica.
 *
 * @param planId — ID del plan de estudios (obligatorio)
 * @param asignaturaId — ID de la asignatura (opcional; si se pasa, filtra)
 * @param asignaturaInfo — Datos de la asignatura para enviar al hacer track
 */
export function useRealtimePresence(
  planId: string | undefined,
  asignaturaId?: string,
  asignaturaInfo?: { nombre: string; clave: string },
) {
  const { data: me } = useMeProfile()
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [presenceState, setPresenceState] = useState<
    Record<string, Array<PresenceUser>>
  >({})

  const meRef = useRef(me)
  meRef.current = me
  const asignaturaNombre = asignaturaInfo?.nombre ?? ''
  const asignaturaClave = asignaturaInfo?.clave ?? ''
  const hasAsignaturaInfo = Boolean(asignaturaInfo)

  // Memoizar los parámetros de asignatura para evitar re-track innecesarios
  const asignaturaPayload = useMemo(() => {
    if (!asignaturaId || !hasAsignaturaInfo) return null
    return {
      id: asignaturaId,
      nombre: asignaturaNombre,
      clave: asignaturaClave,
    }
  }, [asignaturaId, hasAsignaturaInfo, asignaturaNombre, asignaturaClave])

  useEffect(() => {
    // Gate en `me?.id`: el perfil llega de forma asíncrona (react-query), así
    // que en el primer render aún es undefined. Sin `me?.id` en las deps el
    // efecto no se volvería a ejecutar al cargar el perfil y nunca haría
    // `subscribe`/`track`, dejando la presencia vacía.
    if (!planId || !meRef.current) return

    const channelName = `presence:plan:${planId}`
    const channel = supabase.channel(channelName, {
      config: { presence: { key: meRef.current.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<TrackPayload>()
        const mapped: Record<string, Array<PresenceUser>> = {}
        for (const [key, presences] of Object.entries(state)) {
          mapped[key] = presences
            .filter((p): p is typeof p & TrackPayload => !!p.user_id)
            .map((p) => ({
              user_id: p.user_id,
              nombre_completo: p.nombre_completo,
              iniciales: p.iniciales,
              asignatura_activa: p.asignatura_activa ?? null,
              online_at: p.online_at,
            }))
        }
        setPresenceState((prev) =>
          samePresenceState(prev, mapped) ? prev : mapped,
        )
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const user = meRef.current
          if (!user) return
          await channel.track({
            user_id: user.id,
            nombre_completo: user.nombre_completo,
            iniciales: getInitials(user.nombre_completo),
            asignatura_activa: asignaturaPayload,
            online_at: new Date().toISOString(),
          })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Presence] ${status} en canal ${channelName}`)
        }
      })

    return () => {
      void channel.unsubscribe().catch(() => {
        // noop
      })
    }
  }, [planId, supabase, asignaturaPayload, me?.id])

  // Deduplicar por user_id (un usuario con múltiples tabs solo aparece una vez)
  // Preferimos la presencia más reciente o la que tenga asignatura activa
  const allUsers = useMemo(() => {
    const deduped = new Map<string, PresenceUser>()
    for (const presences of Object.values(presenceState)) {
      for (const p of presences) {
        const existing = deduped.get(p.user_id)
        if (!existing) {
          deduped.set(p.user_id, p)
        } else if (p.asignatura_activa && !existing.asignatura_activa) {
          // Si la nueva tiene asignatura más específica, gana
          deduped.set(p.user_id, p)
        } else if (p.online_at > existing.online_at) {
          deduped.set(p.user_id, p)
        }
      }
    }
    return Array.from(deduped.values())
  }, [presenceState])

  // Filtrar por asignatura si se proporcionó
  const planViewers = allUsers
  const subjectViewers = useMemo(() => {
    if (!asignaturaId) return []
    return allUsers.filter((u) => u.asignatura_activa?.id === asignaturaId)
  }, [allUsers, asignaturaId])

  return {
    /** Todos los usuarios conectados al plan */
    planViewers,
    /** Usuarios conectados específicamente a esta asignatura */
    subjectViewers,
    /** Número total de usuarios conectados al plan */
    totalCount: planViewers.length,
    /** Número de usuarios en esta asignatura (si aplica) */
    subjectCount: subjectViewers.length,
    /** Estado crudo de presencia (para debugging) */
    presenceState,
  }
}
