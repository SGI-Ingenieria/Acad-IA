import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import {
  notificaciones_marcar_leida,
  notificaciones_mias_list,
} from '../api/notifications.api'
import { mk, qk } from '../query/keys'
import { supabaseBrowser } from '../supabase/client'

import type { Notificacion, UUID } from '../types/domain'

import { optimisticMutation } from '@/lib/optimistic'

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
          // El eco de la propia escritura optimista se ignora: la invalidación
          // de onSettled ya reconcilia al asentarse la mutación.
          if (qc.isMutating({ mutationKey: mk.notificacionLeer() }) > 0) return
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
    ...optimisticMutation<Notificacion, UUID>({
      queryClient: qc,
      mutationKey: mk.notificacionLeer(),
      scope: (notificacionId) => notificacionId,
      writes: () => [
        {
          key: qk.notificaciones(),
          exact: true,
          updater: (current: any, notificacionId) =>
            Array.isArray(current)
              ? current.map((n: any) =>
                  n.id === notificacionId
                    ? { ...n, leida: true, leida_en: new Date().toISOString() }
                    : n,
                )
              : current,
        },
      ],
      reconcile: (leida, _notificacionId, client) => {
        client.setQueryData(qk.notificaciones(), (current: any) =>
          Array.isArray(current)
            ? current.map((n: any) =>
                n.id === leida.id ? { ...n, ...leida } : n,
              )
            : current,
        )
      },
      errorMessage: 'No se pudo marcar la notificación como leída.',
    }),
  })
}
