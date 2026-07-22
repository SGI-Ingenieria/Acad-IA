import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import {
  ai_generate_plan,
  plan_registro_oficial_upsert,
  plans_clone_from_existing,
  plans_create_manual,
  plans_delete,
  plans_generate_document,
  plans_import_from_files,
  plans_persist_from_ai,
  plans_restore_history_value,
  plans_transition_state,
  plans_update_fields,
  plans_update_map,
} from '../api/plans.api'
import { lineas_delete } from '../api/subjects.api'
import { mk, qk } from '../query/keys'
import {
  catalogosOptions,
  planAsignaturasOptions,
  planDocumentoOptions,
  planHistorialOptions,
  planLineasOptions,
  planOptions,
  planRegistroOficialOptions,
  planesEstadosDisponiblesOptions,
  planesListOptions,
  registrosOficialesOptions,
} from '../query/queryOptions'
import { freshChannel } from '../realtime/freshChannel'
import { supabaseBrowser } from '../supabase/client'

import type {
  PlanListFilters,
  PlanMapOperation,
  PlanRegistroOficialInput,
  PlansCreateManualInput,
  PlansRestoreHistoryValueInput,
  PlansUpdateFieldsPatch,
} from '../api/plans.api'
import type { UUID } from '../types/domain'

import { optimisticMutation } from '@/lib/optimistic'

export function usePlanes(filters: PlanListFilters) {
  return useQuery(planesListOptions(filters))
}

export function usePlanesEstadosDisponibles(
  filters: Pick<
    PlanListFilters,
    'facultadId' | 'carreraId' | 'nivelFilter' | 'catalogMode'
  >,
) {
  return useQuery(planesEstadosDisponiblesOptions(filters))
}

export function usePlan(planId: UUID | null | undefined) {
  return useQuery({
    ...planOptions(planId as UUID),
    enabled: Boolean(planId),
  })
}

export function usePlanLineas(planId: UUID | null | undefined) {
  return useQuery({
    ...planLineasOptions(planId as UUID),
    enabled: Boolean(planId),
  })
}

export function usePlanAsignaturas(planId: UUID | null | undefined) {
  const qc = useQueryClient()

  const query = useQuery({
    ...planAsignaturasOptions(planId as UUID),
    enabled: Boolean(planId),
  })

  useEffect(() => {
    if (!planId) return

    const supabase = supabaseBrowser()

    const channel = freshChannel(supabase, `plan-asignaturas-${planId}`)

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'asignaturas',
        filter: `plan_estudio_id=eq.${planId}`,
      },
      (payload) => {
        // Con una reorganización optimista en vuelo (mapa u operación sobre
        // una asignatura), el eco Realtime de la propia escritura pisaría el
        // estado optimista con datos aún parciales; la invalidación de
        // onSettled reconcilia al terminar.
        if (
          qc.isMutating({ mutationKey: mk.planMapa() }) > 0 ||
          qc.isMutating({ mutationKey: mk.asignaturaUpdate() }) > 0
        ) {
          return
        }

        const eventType = payload.eventType

        if (eventType === 'DELETE') {
          const oldRow: any = payload.old
          const deletedId = oldRow?.id
          if (!deletedId) return

          qc.setQueryData(qk.planAsignaturas(planId), (prev: any) => {
            if (!Array.isArray(prev)) return prev
            return prev.filter((a: any) => String(a?.id) !== String(deletedId))
          })

          return
        }

        const newRow: any = payload.new
        if (!newRow?.id) return

        qc.setQueryData(qk.planAsignaturas(planId), (prev: any) => {
          if (!Array.isArray(prev)) return prev
          const isArchived = String(newRow.estado) === 'archivada'

          const idx = prev.findIndex(
            (a: any) => String(a?.id) === String(newRow.id),
          )

          if (isArchived) {
            if (idx === -1) return prev
            return prev.filter((a: any) => String(a?.id) !== String(newRow.id))
          }

          if (idx === -1) {
            return [...prev, newRow]
          }

          const next = [...prev]
          next[idx] = { ...prev[idx], ...newRow }

          return next
        })
      },
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [planId, qc])

  return query
}

export function usePlanHistorial(
  planId: UUID | null | undefined,
  page: number,
) {
  return useQuery({
    ...planHistorialOptions(planId as UUID, page),
    enabled: Boolean(planId),
    placeholderData: (previousData) => previousData,
  })
}

export function usePlanDocumento(planId: UUID | null | undefined) {
  return useQuery({
    ...planDocumentoOptions(planId as UUID),
    enabled: Boolean(planId),
  })
}

export function usePlanRegistroOficial(planId: UUID | null | undefined) {
  return useQuery({
    ...planRegistroOficialOptions(planId as UUID),
    enabled: Boolean(planId),
  })
}

export function useRegistrosOficiales() {
  return useQuery(registrosOficialesOptions())
}

export function useCatalogosPlanes() {
  return useQuery(catalogosOptions())
}

/* ------------------ Mutations ------------------ */

export function useCreatePlanManual() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: PlansCreateManualInput) => plans_create_manual(input),
    // El wizard notifica éxito/fracaso con sus propios toasts.
    meta: { errorMessage: false },
    onSuccess: (plan) => {
      qc.invalidateQueries({ queryKey: qk.planesListRoot() })
      qc.setQueryData(qk.plan(plan.id), plan)
    },
  })
}

export function useGeneratePlanAI() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ai_generate_plan,
    // Flujo durable de IA: el wizard y el watcher gestionan los avisos.
    meta: { errorMessage: false },
    onSuccess: (data) => {
      if (data.plan) {
        qc.invalidateQueries({ queryKey: qk.planesListRoot() })
      }
    },
  })
}

// Funcion obsoleta porque ahora el plan se persiste directamente en useGeneratePlanAI
export function usePersistPlanFromAI() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: { jsonPlan: any }) => plans_persist_from_ai(payload),
    meta: {
      errorMessage: 'No se pudo guardar el plan generado por IA.',
      retryable: false,
    },
    onSuccess: (plan) => {
      qc.invalidateQueries({ queryKey: qk.planesListRoot() })
      qc.setQueryData(qk.plan(plan.id), plan)
    },
  })
}

export function useClonePlan() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: plans_clone_from_existing,
    // El wizard notifica éxito/fracaso con sus propios toasts.
    meta: { errorMessage: false },
    onSuccess: (plan) => {
      qc.invalidateQueries({ queryKey: qk.planesListRoot() })
      qc.setQueryData(qk.plan(plan.id), plan)
    },
  })
}

export function useImportPlanFromFiles() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: plans_import_from_files,
    meta: {
      errorMessage: 'No se pudo importar el plan desde los archivos.',
      retryable: false,
    },
    onSuccess: (plan) => {
      qc.invalidateQueries({ queryKey: qk.planesListRoot() })
      qc.setQueryData(qk.plan(plan.id), plan)
    },
  })
}

export function useUpdatePlanFields() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: {
      planId: UUID
      patch: PlansUpdateFieldsPatch
      adminOverrideReason?: string | null
    }) =>
      plans_update_fields(vars.planId, vars.patch, vars.adminOverrideReason),
    ...optimisticMutation<
      Awaited<ReturnType<typeof plans_update_fields>>,
      {
        planId: UUID
        patch: PlansUpdateFieldsPatch
        adminOverrideReason?: string | null
      }
    >({
      queryClient: qc,
      mutationKey: mk.planFields(),
      scope: (vars) => vars.planId,
      writes: (vars) => [
        {
          key: qk.plan(vars.planId),
          exact: true,
          updater: (current: any, v) => {
            if (!current) return current
            return {
              ...current,
              ...v.patch,
              datos: v.patch.datos
                ? {
                    ...(current.datos ?? {}),
                    ...(v.patch.datos as Record<string, unknown>),
                  }
                : current.datos,
            }
          },
        },
      ],
      // Write-through de la respuesta del servidor antes de invalidar.
      reconcile: (updated, _vars, client) => {
        client.setQueryData(qk.plan(updated.id), updated)
      },
      invalidateOnSettle: (vars) => [
        qk.planesListRoot(),
        qk.planHistorial(vars.planId),
      ],
      errorMessage: 'No se pudieron guardar los cambios del plan.',
    }),
  })
}

export function useUpdatePlanMapa() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: { planId: UUID; ops: Array<PlanMapOperation> }) =>
      plans_update_map(vars.planId, vars.ops),
    ...optimisticMutation<
      { ok: true },
      { planId: UUID; ops: Array<PlanMapOperation> }
    >({
      queryClient: qc,
      mutationKey: mk.planMapa(),
      scope: (vars) => vars.planId,
      writes: (vars) => [
        {
          key: qk.planAsignaturas(vars.planId),
          exact: true,
          // Solo optimizamos MOVEs simples; el resto se reconcilia al settle.
          updater: (prev: any, v) => {
            const moves = v.ops.filter((x) => x.op === 'MOVE_ASIGNATURA')
            if (!prev || !Array.isArray(prev) || moves.length === 0) return prev
            return prev.map((a: any) => {
              const m = moves.find((x) => x.asignaturaId === a.id)
              if (!m) return a
              return {
                ...a,
                numero_ciclo: m.numero_ciclo,
                linea_plan_id: m.linea_plan_id,
                orden_celda: m.orden_celda ?? a.orden_celda,
              }
            })
          },
        },
      ],
      invalidateOnSettle: (vars) => [qk.planHistorial(vars.planId)],
      errorMessage: 'No se pudo reorganizar el mapa.',
    }),
  })
}

export function useTransitionPlanEstado() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: plans_transition_state,
    // Transición de workflow: el servidor valida permisos y puede transformar
    // el resultado — sin optimismo (pending visible + toast global).
    meta: {
      errorMessage: 'No se pudo cambiar el estado del plan.',
      retryable: false,
    },
    onSuccess: (_ok, vars) => {
      qc.invalidateQueries({ queryKey: qk.plan(vars.planId) })
      qc.invalidateQueries({ queryKey: qk.planHistorial(vars.planId) })
      qc.invalidateQueries({ queryKey: qk.planRegistroOficial(vars.planId) })
      qc.invalidateQueries({ queryKey: qk.registrosOficiales() })
      qc.invalidateQueries({ queryKey: qk.comentariosPlan(vars.planId) })
      qc.invalidateQueries({ queryKey: qk.transicionesPermitidas(vars.planId) })
      qc.invalidateQueries({ queryKey: qk.planesListRoot() })
    },
  })
}

export function useUpsertPlanRegistroOficial() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: { planId: UUID; registro: PlanRegistroOficialInput }) =>
      plan_registro_oficial_upsert(vars),
    // Dato con implicaciones oficiales: sin optimismo, pero el upsert es
    // idempotente y seguro de reintentar.
    meta: { errorMessage: 'No se pudo guardar el registro oficial.' },
    onSuccess: (registro, vars) => {
      qc.setQueryData(qk.planRegistroOficial(vars.planId), registro)
      qc.invalidateQueries({ queryKey: qk.registrosOficiales() })
      qc.invalidateQueries({ queryKey: qk.planHistorial(vars.planId) })
    },
  })
}

export function useRestorePlanHistoryValue() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: PlansRestoreHistoryValueInput) =>
      plans_restore_history_value(input),
    // El resultado lo computa el servidor a partir del historial: sin optimismo.
    meta: { errorMessage: 'No se pudo restaurar esa versión del plan.' },
    onSuccess: (updated) => {
      qc.setQueryData(qk.plan(updated.id), updated)
      qc.invalidateQueries({ queryKey: qk.planHistorial(updated.id) })
      qc.invalidateQueries({ queryKey: qk.planesListRoot() })
    },
  })
}

export function useDeletePlanEstudio() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (planId: UUID) => plans_delete(planId),
    ...optimisticMutation<unknown, UUID>({
      queryClient: qc,
      mutationKey: mk.planDelete(),
      scope: (planId) => planId,
      writes: () => [
        {
          // Desaparece al instante de TODAS las variantes filtradas de la lista.
          key: qk.planesListRoot(),
          updater: (current: any, id) => {
            if (!current || !Array.isArray(current.data)) return current
            const data = current.data.filter((p: any) => p.id !== id)
            if (data.length === current.data.length) return current
            return {
              ...current,
              data,
              count:
                typeof current.count === 'number'
                  ? current.count - 1
                  : current.count,
            }
          },
        },
      ],
      reconcile: (_ok, planId, client) => {
        client.removeQueries({ queryKey: qk.plan(planId) })
        client.removeQueries({ queryKey: qk.planMaybe(planId) })
        client.removeQueries({ queryKey: qk.planAsignaturas(planId) })
        client.removeQueries({ queryKey: qk.planLineas(planId) })
        client.removeQueries({ queryKey: qk.planHistorial(planId) })
        client.removeQueries({ queryKey: qk.planDocumento(planId) })
        client.removeQueries({ queryKey: qk.planRegistroOficial(planId) })
      },
      invalidateOnSettle: () => [qk.registrosOficiales()],
      errorMessage: 'No se pudo eliminar el plan.',
    }),
  })
}

export function useGeneratePlanDocumento() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (planId: UUID) => plans_generate_document(planId),
    // El documento lo produce el servidor: pending visible, sin optimismo.
    meta: { errorMessage: 'No se pudo generar el documento.' },
    onSuccess: (_doc, planId) => {
      qc.invalidateQueries({ queryKey: qk.planDocumento(planId) })
      qc.invalidateQueries({ queryKey: qk.planHistorial(planId) })
    },
  })
}

export function useDeleteLinea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      lineaId: string
      planId: UUID
      adminOverrideReason?: string | null
    }) => lineas_delete(input.lineaId, input.adminOverrideReason),
    ...optimisticMutation<
      unknown,
      { lineaId: string; planId: UUID; adminOverrideReason?: string | null }
    >({
      queryClient: qc,
      mutationKey: mk.lineaDelete(),
      scope: (vars) => vars.planId,
      writes: (vars) => [
        {
          key: qk.planLineas(vars.planId),
          exact: true,
          updater: (current: any, v) =>
            Array.isArray(current)
              ? current.filter((l: any) => l.id !== v.lineaId)
              : current,
        },
      ],
      invalidateOnSettle: (vars) => [
        qk.planAsignaturas(vars.planId),
        qk.planHistorial(vars.planId),
      ],
      errorMessage: 'No se pudo eliminar la línea.',
    }),
  })
}
