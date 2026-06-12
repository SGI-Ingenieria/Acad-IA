import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '../query/keys'
import {
  notificaciones_marcar_leida,
  notificaciones_mias_list,
} from '../api/notifications.api'
import { supabaseBrowser } from '../supabase/client'

export function useMisNotificaciones() {
  return useQuery({
    queryKey: qk.notificaciones(),
    queryFn: notificaciones_mias_list,
    staleTime: 10_000,
  })
}

/** 🔥 Opcional: realtime (si tienes Realtime habilitado) */
export function useRealtimeNotificaciones(enable = true) {
  const supabase = supabaseBrowser()
  const qc = useQueryClient()

  useEffect(() => {
    if (!enable) return

    const channel = supabase
      .channel('rt-notificaciones')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notificaciones' },
        () => {
          qc.invalidateQueries({ queryKey: qk.notificaciones() })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enable, supabase, qc])
}

export function useMarcarNotificacionLeida() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: notificaciones_marcar_leida,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.notificaciones() })
    },
  })
}
