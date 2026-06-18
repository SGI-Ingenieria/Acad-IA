import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  comentario_asignatura_create,
  comentario_plan_create,
  comentarios_asignatura_list,
  comentarios_plan_list,
  estado_plan_create,
  estado_plan_delete,
  estado_plan_update,
  experto_create,
  experto_delete,
  expertos_list,
  plan_experto_add,
  plan_experto_remove,
  plan_expertos_list,
  roles_list,
  subjects_transition_state,
  transicion_create,
  transicion_delete,
  transiciones_list,
  transiciones_permitidas,
} from '../api/workflow.api'
import { qk } from '../query/keys'

import type { UUID } from '../types/domain'

import { notify } from '@/lib/toast'

// ── Transiciones permitidas (panel de transición del plan) ─────────────────────
export function useTransicionesPermitidas(planId: UUID | null | undefined) {
  return useQuery({
    queryKey: qk.transicionesPermitidas((planId ?? '')),
    queryFn: () => transiciones_permitidas(planId as UUID),
    enabled: Boolean(planId),
    staleTime: 60_000,
  })
}

// ── Comentarios del plan ───────────────────────────────────────────────────────
export function useComentariosPlan(planId: UUID | null | undefined) {
  return useQuery({
    queryKey: qk.comentariosPlan((planId ?? '')),
    queryFn: () => comentarios_plan_list(planId as UUID),
    enabled: Boolean(planId),
  })
}

export function useCrearComentarioPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: comentario_plan_create,
    onSuccess: (_c, vars) => {
      qc.invalidateQueries({ queryKey: qk.comentariosPlan(vars.planId) })
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo guardar el comentario.' })
    },
  })
}

// ── Comentarios de la asignatura ────────────────────────────────────────────────
export function useComentariosAsignatura(
  asignaturaId: UUID | null | undefined,
) {
  return useQuery({
    queryKey: qk.comentariosAsignatura((asignaturaId ?? '')),
    queryFn: () => comentarios_asignatura_list(asignaturaId as UUID),
    enabled: Boolean(asignaturaId),
  })
}

export function useCrearComentarioAsignatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: comentario_asignatura_create,
    onSuccess: (_c, vars) => {
      qc.invalidateQueries({
        queryKey: qk.comentariosAsignatura(vars.asignaturaId),
      })
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo guardar el comentario.' })
    },
  })
}

// ── Transición de estado de la asignatura (flujo PR) ─────────────────────────────
export function useTransitionSubjectEstado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: subjects_transition_state,
    onSuccess: (_ok, vars) => {
      qc.invalidateQueries({ queryKey: qk.asignatura(vars.asignaturaId) })
      qc.invalidateQueries({
        queryKey: qk.asignaturaHistorial(vars.asignaturaId),
      })
      qc.invalidateQueries({
        queryKey: qk.comentariosAsignatura(vars.asignaturaId),
      })
      // El estado se muestra en la tabla de asignaturas del plan.
      qc.invalidateQueries({ queryKey: ['planes'] })
    },
    onError: (err) => {
      notify.error(err, {
        description: 'No se pudo cambiar el estado de la asignatura.',
      })
    },
  })
}

// ── Expertos y sedes ─────────────────────────────────────────────────────────────
export function useExpertos() {
  return useQuery({
    queryKey: qk.expertos(),
    queryFn: expertos_list,
    staleTime: 60_000,
  })
}

export function useCrearExperto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: experto_create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.expertos() })
      notify.success('Experto registrado.')
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo registrar el experto.' })
    },
  })
}

export function useEliminarExperto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: experto_delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.expertos() })
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo eliminar el experto.' })
    },
  })
}

export function usePlanExpertos(planId: UUID | null | undefined) {
  return useQuery({
    queryKey: qk.planExpertos((planId ?? '')),
    queryFn: () => plan_expertos_list(planId as UUID),
    enabled: Boolean(planId),
  })
}

export function useAgregarPlanExperto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: plan_experto_add,
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: qk.planExpertos(vars.planId) })
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo invitar al experto.' })
    },
  })
}

export function useQuitarPlanExperto(planId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: plan_experto_remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.planExpertos(planId) })
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo quitar al experto.' })
    },
  })
}

// ── Administración del state machine ─────────────────────────────────────────────
export function useRoles() {
  return useQuery({
    queryKey: ['meta', 'roles'] as const,
    queryFn: roles_list,
    staleTime: 10 * 60_000,
  })
}

export function useTransiciones() {
  return useQuery({
    queryKey: qk.transiciones(),
    queryFn: transiciones_list,
    staleTime: 60_000,
  })
}

export function useTransicionesCrud() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.transiciones() })
    qc.invalidateQueries({ queryKey: ['flujo', 'transicionesPermitidas'] })
  }

  const create = useMutation({
    mutationFn: transicion_create,
    onSuccess: invalidate,
    onError: (err) =>
      notify.error(err, { description: 'No se pudo crear la transición.' }),
  })

  const remove = useMutation({
    mutationFn: transicion_delete,
    onSuccess: invalidate,
    onError: (err) =>
      notify.error(err, { description: 'No se pudo eliminar la transición.' }),
  })

  return { create, remove }
}

export function useEstadosPlanCrud() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.estadosPlan() })
    qc.invalidateQueries({ queryKey: qk.transiciones() })
  }

  const create = useMutation({
    mutationFn: estado_plan_create,
    onSuccess: invalidate,
    onError: (err) =>
      notify.error(err, { description: 'No se pudo crear el estado.' }),
  })

  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: UUID
      input: Parameters<typeof estado_plan_update>[1]
    }) => estado_plan_update(id, input),
    onSuccess: invalidate,
    onError: (err) =>
      notify.error(err, { description: 'No se pudo actualizar el estado.' }),
  })

  const remove = useMutation({
    mutationFn: estado_plan_delete,
    onSuccess: invalidate,
    onError: (err) =>
      notify.error(err, { description: 'No se pudo eliminar el estado.' }),
  })

  return { create, update, remove }
}
