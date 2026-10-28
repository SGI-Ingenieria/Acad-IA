import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import {
  gruposElectivosGestionar,
  gruposElectivosListar,
} from '../api/gruposElectivos.api'
import { mk, qk } from '../query/keys'
import { freshChannel } from '../realtime/freshChannel'
import { supabaseBrowser } from '../supabase/client'

import type {
  GrupoElectivoPlan,
  OperacionGrupoElectivo,
} from '../api/gruposElectivos.api'
import type { Asignatura } from '../types/domain'

import { notify } from '@/lib/toast'

export function useGruposElectivos(planId: string) {
  const qc = useQueryClient()
  useEffect(() => {
    const cliente = supabaseBrowser()
    const refrescar = () => {
      if (qc.isMutating({ mutationKey: mk.gruposElectivos(planId) })) return
      void Promise.all([
        qc.invalidateQueries({ queryKey: qk.gruposElectivos(planId) }),
        qc.invalidateQueries({ queryKey: qk.planAsignaturas(planId) }),
        qc.invalidateQueries({ queryKey: qk.planHistorial(planId) }),
        qc.invalidateQueries({ queryKey: qk.planDocumento(planId) }),
      ])
    }
    const canal = freshChannel(cliente, `grupos-electivos-${planId}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'grupos_electivos_plan' },
        refrescar,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'grupos_electivos_plan',
          filter: `plan_estudio_id=eq.${planId}`,
        },
        refrescar,
      )
      .subscribe()

    return () => {
      void cliente.removeChannel(canal)
    }
  }, [planId, qc])
  return useQuery({
    queryKey: qk.gruposElectivos(planId),
    queryFn: () => gruposElectivosListar(planId),
  })
}

export function useGestionarGrupoElectivo(planId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: mk.gruposElectivos(planId),
    scope: { id: `grupos-electivos-${planId}` },
    mutationFn: gruposElectivosGestionar,
    onMutate: async (input: OperacionGrupoElectivo) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: qk.gruposElectivos(planId) }),
        qc.cancelQueries({ queryKey: qk.planAsignaturas(planId) }),
      ])
      const grupos = qc.getQueryData<Array<GrupoElectivoPlan>>(
        qk.gruposElectivos(planId),
      )
      const materias = qc.getQueryData<Array<Asignatura>>(
        qk.planAsignaturas(planId),
      )
      // Los retiros de relaciones requieren resultado autoritativo y confirmación.
      if (
        input.datos.confirmar_retiro_relaciones ||
        input.operacion === 'crear' ||
        input.operacion === 'eliminar'
      )
        return { grupos, materias }
      const grupo = grupos?.find((g) => g.id === input.grupoId)
      if (!grupo) return { grupos, materias }
      qc.setQueryData<Array<GrupoElectivoPlan>>(
        qk.gruposElectivos(planId),
        (prev) =>
          prev?.map((g) =>
            g.id === grupo.id
              ? {
                  ...g,
                  ...(input.operacion === 'editar' ||
                  input.operacion === 'mover'
                    ? {
                        nombre: input.datos.nombre ?? g.nombre,
                        numero_ciclo:
                          input.datos.numero_ciclo ?? g.numero_ciclo,
                        linea_plan_id:
                          input.datos.linea_plan_id ?? g.linea_plan_id,
                        prerrequisito_grupo_id:
                          input.datos.prerrequisito_grupo_id === undefined
                            ? g.prerrequisito_grupo_id
                            : input.datos.prerrequisito_grupo_id,
                      }
                    : {}),
                  revision: g.revision + 1,
                }
              : g,
          ),
      )
      qc.setQueryData<Array<Asignatura>>(qk.planAsignaturas(planId), (prev) =>
        prev?.map((a) => {
          if (
            input.operacion === 'retirar' &&
            a.id === input.datos.asignatura_id
          )
            return {
              ...a,
              grupo_electivo_id: null,
              numero_ciclo: null,
              linea_plan_id: null,
            }
          if (
            input.operacion === 'incorporar' &&
            a.id === input.datos.asignatura_id
          )
            return {
              ...a,
              grupo_electivo_id: grupo.id,
              numero_ciclo: grupo.numero_ciclo,
              linea_plan_id: grupo.linea_plan_id,
            }
          if (input.operacion === 'mover' && a.grupo_electivo_id === grupo.id)
            return {
              ...a,
              numero_ciclo: input.datos.numero_ciclo ?? grupo.numero_ciclo,
              linea_plan_id: input.datos.linea_plan_id ?? grupo.linea_plan_id,
            }
          return a
        }),
      )
      return { grupos, materias }
    },
    onError: (error, _input, snapshot) => {
      if (snapshot?.grupos)
        qc.setQueryData(qk.gruposElectivos(planId), snapshot.grupos)
      if (snapshot?.materias)
        qc.setQueryData(qk.planAsignaturas(planId), snapshot.materias)
      notify.error(error.message)
    },
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.gruposElectivos(planId) }),
        qc.invalidateQueries({ queryKey: qk.planAsignaturas(planId) }),
        qc.invalidateQueries({ queryKey: qk.asignaturasRoot() }),
        qc.invalidateQueries({ queryKey: qk.plan(planId) }),
        qc.invalidateQueries({ queryKey: qk.planesListRoot() }),
        qc.invalidateQueries({ queryKey: qk.planHistorial(planId) }),
        qc.invalidateQueries({ queryKey: qk.planDocumento(planId) }),
      ])
    },
  })
}
