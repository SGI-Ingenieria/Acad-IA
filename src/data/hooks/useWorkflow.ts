import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  comentario_asignatura_create,
  comentario_plan_create,
  comentario_plan_set_resuelto,
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
  permisos_list,
  rol_create,
  rol_delete,
  rol_permiso_set,
  rol_update,
  roles_list,
  roles_permisos_list,
  subjects_transition_state,
  transicion_create,
  transicion_delete,
  transiciones_list,
  transiciones_permitidas,
} from '../api/workflow.api'
import { mk, qk } from '../query/keys'

import type {
  ComentarioAsignatura,
  ComentarioPlan,
  Experto,
  PlanExperto,
  UUID,
} from '../types/domain'

import { isTempId, makeTempId, optimisticMutation } from '@/lib/optimistic'
import { notify } from '@/lib/toast'

/**
 * Prefijo `['planes', planId, 'comentarios']` de `qk.comentariosPlan`: cubre
 * todas las variantes (`{ asignaturaId }`) en una sola escritura por prefijo.
 */
const comentariosPlanPrefix = (planId: UUID) =>
  qk.comentariosPlan(planId).slice(0, 3)

/** Perfil propio en caché para componer el autor de un comentario optimista. */
function autorOptimista(qc: ReturnType<typeof useQueryClient>) {
  const me = qc.getQueryData<{
    id: string
    nombre_completo: string | null
  } | null>(qk.meProfile())
  return me ? { id: me.id, nombre_completo: me.nombre_completo } : null
}

// ── Transiciones permitidas (panel de transición del plan) ─────────────────────
export function useTransicionesPermitidas(planId: UUID | null | undefined) {
  return useQuery({
    queryKey: qk.transicionesPermitidas(planId ?? ''),
    queryFn: () => transiciones_permitidas(planId as UUID),
    enabled: Boolean(planId),
    staleTime: 60_000,
  })
}

// ── Comentarios del plan ───────────────────────────────────────────────────────
export function useComentariosPlan(
  planId: UUID | null | undefined,
  asignaturaId?: UUID | null | undefined,
) {
  return useQuery({
    queryKey: qk.comentariosPlan(planId ?? '', asignaturaId),
    queryFn: () =>
      comentarios_plan_list({
        planId: planId as UUID,
        asignaturaId,
      }),
    enabled: Boolean(planId),
  })
}

export function useCrearComentarioPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: comentario_plan_create,
    ...optimisticMutation<
      ComentarioPlan,
      Parameters<typeof comentario_plan_create>[0]
    >({
      queryClient: qc,
      mutationKey: mk.comentarioCrear(),
      scope: (vars) => vars.planId,
      writes: (vars) => {
        // Una sola fila temporal compartida por todas las variantes del
        // prefijo, para que `reconcile` la sustituya en todas a la vez.
        const temp = {
          id: makeTempId(),
          plan_estudio_id: vars.planId,
          estado_id: vars.estadoId ?? null,
          asignatura_id: vars.asignaturaId ?? null,
          comentario_padre_id: vars.comentarioPadreId ?? null,
          autor_id: null,
          categoria: vars.categoria ?? 'INTERNO',
          cuerpo: vars.cuerpo.trim(),
          resuelto: false,
          referencia: vars.referencia ?? null,
          creado_en: new Date().toISOString(),
          autor: autorOptimista(qc),
          adjuntos: [],
        }
        return [
          {
            key: comentariosPlanPrefix(vars.planId),
            updater: (current: unknown) =>
              Array.isArray(current) ? [...current, temp] : current,
          },
        ]
      },
      reconcile: (creado, vars, client) => {
        client.setQueriesData(
          { queryKey: comentariosPlanPrefix(vars.planId) },
          (current: unknown) =>
            Array.isArray(current)
              ? current.map((row: any) => (isTempId(row?.id) ? creado : row))
              : current,
        )
      },
      errorMessage: 'No se pudo guardar el comentario.',
    }),
  })
}

export function useToggleResueltoComentarioPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ids: UUID | Array<UUID>
      resuelto: boolean
      planId: UUID
      asignaturaId?: UUID | null
    }) => {
      await comentario_plan_set_resuelto(input.ids, input.resuelto)
      return input
    },
    ...optimisticMutation<
      unknown,
      {
        ids: UUID | Array<UUID>
        resuelto: boolean
        planId: UUID
        asignaturaId?: UUID | null
      }
    >({
      queryClient: qc,
      mutationKey: mk.comentarioResuelto(),
      scope: (vars) => vars.planId,
      writes: (vars) => {
        const ids = new Set(Array.isArray(vars.ids) ? vars.ids : [vars.ids])
        return [
          {
            key: comentariosPlanPrefix(vars.planId),
            updater: (current: unknown) =>
              Array.isArray(current)
                ? current.map((row: any) =>
                    ids.has(row?.id)
                      ? { ...row, resuelto: vars.resuelto }
                      : row,
                  )
                : current,
          },
        ]
      },
      errorMessage: 'No se pudo actualizar el estado del comentario.',
    }),
  })
}

// ── Comentarios de la asignatura ────────────────────────────────────────────────
export function useComentariosAsignatura(
  asignaturaId: UUID | null | undefined,
) {
  return useQuery({
    queryKey: qk.comentariosAsignatura(asignaturaId ?? ''),
    queryFn: () => comentarios_asignatura_list(asignaturaId as UUID),
    enabled: Boolean(asignaturaId),
  })
}

export function useCrearComentarioAsignatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: comentario_asignatura_create,
    ...optimisticMutation<
      ComentarioAsignatura,
      Parameters<typeof comentario_asignatura_create>[0]
    >({
      queryClient: qc,
      mutationKey: mk.comentarioCrear(),
      scope: (vars) => vars.asignaturaId,
      writes: (vars) => {
        const temp = {
          id: makeTempId(),
          asignatura_id: vars.asignaturaId,
          comentario_padre_id: vars.comentarioPadreId ?? null,
          autor_id: null,
          categoria: vars.categoria ?? 'INTERNO',
          cuerpo: vars.cuerpo.trim(),
          resuelto: false,
          creado_en: new Date().toISOString(),
          autor: autorOptimista(qc),
        }
        return [
          {
            key: qk.comentariosAsignatura(vars.asignaturaId),
            exact: true,
            updater: (current: unknown) =>
              Array.isArray(current) ? [...current, temp] : current,
          },
        ]
      },
      reconcile: (creado, vars, client) => {
        client.setQueryData(
          qk.comentariosAsignatura(vars.asignaturaId),
          (current: unknown) =>
            Array.isArray(current)
              ? current.map((row: any) => (isTempId(row?.id) ? creado : row))
              : current,
        )
      },
      errorMessage: 'No se pudo guardar el comentario.',
    }),
  })
}

// ── Transición de estado de la asignatura (flujo PR) ─────────────────────────────
export function useTransitionSubjectEstado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: subjects_transition_state,
    // Transición de workflow: el servidor valida permisos y puede transformar
    // el resultado — sin optimismo (pending visible + toast global).
    meta: {
      errorMessage: 'No se pudo cambiar el estado de la asignatura.',
      retryable: false,
    },
    onSuccess: (_ok, vars) => {
      qc.invalidateQueries({ queryKey: qk.asignatura(vars.asignaturaId) })
      qc.invalidateQueries({
        queryKey: qk.asignaturaHistorial(vars.asignaturaId),
      })
      qc.invalidateQueries({
        queryKey: qk.comentariosAsignatura(vars.asignaturaId),
      })
      // El estado se muestra en la tabla de asignaturas del plan.
      qc.invalidateQueries({ queryKey: qk.planesRoot() })
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
  const optimistic = optimisticMutation<
    Experto,
    Parameters<typeof experto_create>[0]
  >({
    queryClient: qc,
    mutationKey: mk.expertoSave(),
    writes: (vars) => {
      const temp = {
        id: makeTempId(),
        nombre: vars.nombre.trim(),
        institucion: vars.institucion?.trim() || null,
        contacto: vars.contacto?.trim() || null,
        tipo: vars.tipo ?? 'EXPERTO',
        usuario_id: vars.usuarioId ?? null,
        creado_por: autorOptimista(qc)?.id ?? null,
        creado_en: new Date().toISOString(),
      }
      return [
        {
          key: qk.expertos(),
          exact: true,
          // La lista del servidor viene ordenada por nombre.
          updater: (current: unknown) =>
            Array.isArray(current)
              ? [...current, temp].sort((a: any, b: any) =>
                  String(a?.nombre ?? '').localeCompare(
                    String(b?.nombre ?? ''),
                  ),
                )
              : current,
        },
      ]
    },
    reconcile: (creado, _vars, client) => {
      client.setQueryData(qk.expertos(), (current: unknown) =>
        Array.isArray(current)
          ? current.map((row: any) => (isTempId(row?.id) ? creado : row))
          : current,
      )
    },
    errorMessage: 'No se pudo registrar el experto.',
  })

  return useMutation({
    mutationFn: experto_create,
    ...optimistic,
    // Encadena el reconcile del helper y conserva el toast de éxito.
    onSuccess: (creado, vars, onMutateResult, context) => {
      optimistic.onSuccess?.(creado, vars, onMutateResult, context)
      notify.success('Experto registrado.')
    },
  })
}

export function useEliminarExperto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: experto_delete,
    ...optimisticMutation<void, UUID>({
      queryClient: qc,
      mutationKey: mk.expertoSave(),
      scope: (id) => id,
      writes: (id) => [
        {
          key: qk.expertos(),
          exact: true,
          updater: (current: unknown) =>
            Array.isArray(current)
              ? current.filter((row: any) => row?.id !== id)
              : current,
        },
      ],
      errorMessage: 'No se pudo eliminar el experto.',
    }),
  })
}

export function usePlanExpertos(planId: UUID | null | undefined) {
  return useQuery({
    queryKey: qk.planExpertos(planId ?? ''),
    queryFn: () => plan_expertos_list(planId as UUID),
    enabled: Boolean(planId),
  })
}

export function useAgregarPlanExperto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: plan_experto_add,
    ...optimisticMutation<{ id: UUID }, { planId: UUID; expertoId: UUID }>({
      queryClient: qc,
      mutationKey: mk.planExpertoLink(),
      scope: (vars) => vars.planId,
      writes: (vars) => {
        // El experto embebido sale del catálogo en caché; si no está, la fila
        // temporal viaja sin datos y el settle la completa con el refetch.
        const catalogo = qc.getQueryData<Array<Experto>>(qk.expertos())
        const temp = {
          id: makeTempId(),
          plan_estudio_id: vars.planId,
          experto_id: vars.expertoId,
          creado_en: new Date().toISOString(),
          expertos: catalogo?.find((e) => e.id === vars.expertoId) ?? null,
        }
        return [
          {
            key: qk.planExpertos(vars.planId),
            exact: true,
            updater: (current: unknown) =>
              Array.isArray(current) ? [...current, temp] : current,
          },
        ]
      },
      reconcile: (creado, vars, client) => {
        client.setQueryData(qk.planExpertos(vars.planId), (current: unknown) =>
          Array.isArray(current)
            ? current.map((row: PlanExperto) =>
                isTempId(row.id) ? { ...row, id: creado.id } : row,
              )
            : current,
        )
      },
      errorMessage: 'No se pudo invitar al experto.',
    }),
  })
}

export function useQuitarPlanExperto(planId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: plan_experto_remove,
    ...optimisticMutation<void, UUID>({
      queryClient: qc,
      mutationKey: mk.planExpertoLink(),
      scope: () => planId,
      writes: (id) => [
        {
          key: qk.planExpertos(planId),
          exact: true,
          updater: (current: unknown) =>
            Array.isArray(current)
              ? current.filter((row: PlanExperto) => row.id !== id)
              : current,
        },
      ],
      errorMessage: 'No se pudo quitar al experto.',
    }),
  })
}

// ── Administración del state machine ─────────────────────────────────────────────
export function useRoles() {
  return useQuery({
    queryKey: qk.roles(),
    queryFn: roles_list,
    staleTime: 10 * 60_000,
  })
}

export function usePermisos() {
  return useQuery({
    queryKey: qk.permisos(),
    queryFn: permisos_list,
    staleTime: 10 * 60_000,
  })
}

export function useRolesPermisos() {
  return useQuery({
    queryKey: qk.rolesPermisos(),
    queryFn: roles_permisos_list,
    staleTime: 60_000,
  })
}

export function useRolesCrud() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.roles() })
    qc.invalidateQueries({ queryKey: qk.rolesPermisos() })
    qc.invalidateQueries({ queryKey: qk.effectiveAuthz() })
  }

  const create = useMutation({
    mutationFn: rol_create,
    // Insert no idempotente (clave única): sin "Reintentar" automático.
    meta: { errorMessage: 'No se pudo crear el rol.', retryable: false },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: UUID
      input: Parameters<typeof rol_update>[1]
    }) => rol_update(id, input),
    meta: { errorMessage: 'No se pudo actualizar el rol.' },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: rol_delete,
    meta: { errorMessage: 'No se pudo eliminar el rol.' },
    onSuccess: invalidate,
  })

  return { create, update, remove }
}

export function useRolPermisoCrud() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: rol_permiso_set,
    // Upsert/delete idempotente: seguro de reintentar.
    meta: { errorMessage: 'No se pudo actualizar el permiso.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rolesPermisos() })
      qc.invalidateQueries({ queryKey: qk.effectiveAuthz() })
    },
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
    qc.invalidateQueries({ queryKey: qk.transicionesPermitidasRoot() })
  }

  const create = useMutation({
    mutationFn: transicion_create,
    // Insert no idempotente: repetirlo podría duplicar la transición.
    meta: {
      errorMessage: 'No se pudo crear la transición.',
      retryable: false,
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: transicion_delete,
    meta: { errorMessage: 'No se pudo eliminar la transición.' },
    onSuccess: invalidate,
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
    // Insert no idempotente (clave única): sin "Reintentar" automático.
    meta: { errorMessage: 'No se pudo crear el estado.', retryable: false },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: UUID
      input: Parameters<typeof estado_plan_update>[1]
    }) => estado_plan_update(id, input),
    meta: { errorMessage: 'No se pudo actualizar el estado.' },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: estado_plan_delete,
    meta: { errorMessage: 'No se pudo eliminar el estado.' },
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
