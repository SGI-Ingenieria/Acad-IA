import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import {
  areaComunContexto,
  areaComunIndicadores,
  areaComunGuardarConfiguracion,
  areaComunIncorporar,
  areaComunPublicar,
  areaComunRetirar,
} from '../api/areaComun.api'
import { qk } from '../query/keys'
import { freshChannel } from '../realtime/freshChannel'
import { supabaseBrowser } from '../supabase/client'

import { notify } from '@/lib/toast'

export function useAreaComun(planId: string) {
  return useQuery({
    queryKey: qk.areaComun(planId),
    queryFn: () => areaComunContexto(planId),
  })
}

export function useAreaComunIndicadores(
  planId: string,
  asignaturaIds: Array<string>,
) {
  return useQuery({
    queryKey: qk.areaComunDashboard(planId, asignaturaIds),
    queryFn: () => areaComunIndicadores(asignaturaIds),
  })
}

export function useAreaComunRealtime(planId: string) {
  const qc = useQueryClient()
  useEffect(() => {
    const cliente = supabaseBrowser()
    const refrescar = () => {
      void Promise.all([
        qc.invalidateQueries({ queryKey: qk.areaComun(planId) }),
        qc.invalidateQueries({ queryKey: qk.planAsignaturas(planId) }),
        qc.invalidateQueries({ queryKey: qk.planLineas(planId) }),
        qc.invalidateQueries({ queryKey: qk.asignaturasRoot() }),
        qc.invalidateQueries({ queryKey: qk.planHistorial(planId) }),
        qc.invalidateQueries({ queryKey: qk.planDocumento(planId) }),
      ])
    }
    const canal = freshChannel(cliente, `area-comun-${planId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'area_comun_incorporaciones',
        },
        refrescar,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'area_comun_incorporaciones',
          filter: `plan_id=eq.${planId}`,
        },
        refrescar,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'area_comun_configuracion',
          filter: `plan_id=eq.${planId}`,
        },
        refrescar,
      )
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') refrescar()
      })
    return () => {
      void cliente.removeChannel(canal)
    }
  }, [planId, qc])
}

export function useAccionesAreaComun() {
  const qc = useQueryClient()
  const reconciliar = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.areaComunRoot() }),
      qc.invalidateQueries({ queryKey: qk.planesRoot() }),
      qc.invalidateQueries({ queryKey: qk.asignaturasRoot() }),
    ])
  }
  const onError = (error: Error) => notify.error(error.message)
  // La composición depende de la publicación y de reglas de carrera: no usar optimismo ciego.
  return {
    guardar: useMutation({
      mutationFn: areaComunGuardarConfiguracion,
      onSuccess: reconciliar,
      onError,
    }),
    publicar: useMutation({
      mutationFn: areaComunPublicar,
      onSuccess: reconciliar,
      onError,
    }),
    incorporar: useMutation({
      mutationFn: areaComunIncorporar,
      onSuccess: reconciliar,
      onError,
    }),
    retirar: useMutation({
      mutationFn: areaComunRetirar,
      onSuccess: reconciliar,
      onError,
    }),
  }
}
