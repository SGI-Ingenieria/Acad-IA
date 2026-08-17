import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { ClearRecentScope } from '@/data/api/observability.api'

import {
  clearRecentObservability,
  getObservabilitySnapshot,
  getPublicConnectivityStatus,
  runOpenAIBackgroundTest,
  runOpenAIForegroundTest,
} from '@/data/api/observability.api'
import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'

export function usePublicConnectivityStatus() {
  return useQuery({
    queryKey: qk.observabilityPublic(),
    queryFn: getPublicConnectivityStatus,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useObservabilitySnapshot() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = supabaseBrowser()
    const channel = supabase
      .channel('observability-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'observability_webhook_events',
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: qk.observabilitySnapshot(),
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'observability_test_runs',
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: qk.observabilitySnapshot(),
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  return useQuery({
    queryKey: qk.observabilitySnapshot(),
    queryFn: getObservabilitySnapshot,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useOpenAIForegroundTest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: runOpenAIForegroundTest,
    // Prueba de diagnóstico idempotente: segura de reintentar.
    meta: { errorMessage: 'No se pudo ejecutar la prueba inmediata.' },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.observabilitySnapshot() })
    },
  })
}

export function useOpenAIBackgroundTest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: runOpenAIBackgroundTest,
    // Prueba de diagnóstico idempotente: segura de reintentar.
    meta: {
      errorMessage: 'No se pudo iniciar la prueba en segundo plano.',
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.observabilitySnapshot() })
    },
  })
}

export function useClearRecentObservability() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (scope: ClearRecentScope) => clearRecentObservability(scope),
    // Limpieza idempotente: segura de reintentar.
    meta: {
      errorMessage:
        'No se pudieron limpiar los datos recientes de observabilidad.',
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.observabilitySnapshot() })
    },
  })
}
