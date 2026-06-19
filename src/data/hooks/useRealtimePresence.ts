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
  const supabase = supabaseBrowser()
  const [presenceState, setPresenceState] = useState<
    Record<string, Array<PresenceUser>>
  >({})
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const meRef = useRef(me)
  meRef.current = me

  // Memoizar los parámetros de asignatura para evitar re-track innecesarios
  const asignaturaPayload = useMemo(() => {
    if (!asignaturaId || !asignaturaInfo) return null
    return {
      id: asignaturaId,
      nombre: asignaturaInfo.nombre,
      clave: asignaturaInfo.clave,
    }
  }, [asignaturaId, asignaturaInfo])

  useEffect(() => {
    if (!planId || !meRef.current) return

    const channelName = `presence:plan:${planId}`
    const channel = supabase.channel(channelName)
    channelRef.current = channel

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
        setPresenceState(mapped)
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
          } as TrackPayload)
        }
      })

    return () => {
      channel.unsubscribe().catch(() => {
        // noop
      })
    }
  }, [planId, supabase, asignaturaPayload])

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
