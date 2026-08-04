import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  recursos_delete,
  recursos_generar,
  recursos_job_status,
  recursos_recalcular_scores,
  recursos_update,
} from '../api/recursos.api'
import { mk, qk } from '../query/keys'
import {
  asignaturaLearningJobsOptions,
  asignaturaLearningScoresOptions,
  asignaturaRecursosOptions,
} from '../query/queryOptions'

import type { AIGenerationReferences } from '../api/aiGenerationReferences'
import type {
  H5PTipo,
  H5PDificultad,
  RecursoTipo,
  RecursosReasoningEffort,
} from '../api/recursos.api'
import type { UUID } from '../types/domain'
import type { Tables } from '@/types/supabase'

import { optimisticMutation } from '@/lib/optimistic'
import { notify } from '@/lib/toast'

export function useAsignaturaRecursos(asignaturaId: UUID | null | undefined) {
  return useQuery({
    ...asignaturaRecursosOptions(asignaturaId as UUID),
    enabled: Boolean(asignaturaId),
  })
}

export function useAsignaturaLearningScores(
  asignaturaId: UUID | null | undefined,
) {
  return useQuery({
    ...asignaturaLearningScoresOptions(asignaturaId as UUID),
    enabled: Boolean(asignaturaId),
  })
}

export function useAsignaturaLearningJobs(
  asignaturaId: UUID | null | undefined,
) {
  return useQuery({
    ...asignaturaLearningJobsOptions(asignaturaId as UUID),
    enabled: Boolean(asignaturaId),
  })
}

/* ------------------ Mutations ------------------ */

export function useGenerarRecursos() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: {
      asignaturaId: UUID
      unidadId?: string | null
      temaId?: string | null
      tipos: Array<RecursoTipo>
      instruccionesAdicionalesIA?: string
      model?: string
      references?: AIGenerationReferences
      reasoningEffort?: RecursosReasoningEffort
      webSearchEnabled?: boolean
      h5pTypes?: Array<H5PTipo>
      h5pDifficulty?: H5PDificultad
    }) =>
      recursos_generar(
        vars.asignaturaId,
        vars.unidadId,
        vars.temaId,
        vars.tipos,
        vars.instruccionesAdicionalesIA,
        vars.model,
        vars.references,
        vars.reasoningEffort,
        vars.webSearchEnabled,
        vars.h5pTypes,
        vars.h5pDifficulty,
      ),
    // Generación de IA durable en el servidor: sin optimismo y sin reintento
    // automático desde el toast (repetirla lanzaría un segundo job).
    meta: {
      errorMessage: 'No se pudieron generar los contenidos.',
      retryable: false,
    },
    onSuccess: () => {
      notify.success('Generación iniciada.')
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({
        queryKey: qk.asignaturaRecursos(vars.asignaturaId),
      })
      qc.invalidateQueries({
        queryKey: qk.asignaturaLearningScores(vars.asignaturaId),
      })
      qc.invalidateQueries({
        queryKey: qk.asignaturaLearningJobs(vars.asignaturaId),
      })
    },
  })
}

export function useSincronizarLearningJob(asignaturaId: UUID) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (jobId: UUID) => recursos_job_status(jobId),
    retry: false,
    // Refresco de estado en background: el propio onSuccess mapea el desenlace
    // del job a toasts específicos y un fallo del refresh no debe interrumpir.
    meta: { errorMessage: false },
    onSuccess: (data) => {
      qc.invalidateQueries({
        queryKey: qk.asignaturaLearningJobs(asignaturaId),
      })

      if (data.job.estado === 'completed' || data.job.estado === 'failed') {
        qc.invalidateQueries({
          queryKey: qk.asignaturaRecursos(asignaturaId),
        })
        qc.invalidateQueries({
          queryKey: qk.asignaturaLearningScores(asignaturaId),
        })

        if (data.job.estado === 'completed') {
          notify.success('Contenido generado.')
        } else {
          notify.error(data.job.error ?? 'La generación no pudo completarse.', {
            description: 'Puedes volver a intentarlo.',
          })
        }
      }
    },
    onError: (err) => {
      console.warn('[useSincronizarLearningJob] status refresh failed', err)
      qc.invalidateQueries({
        queryKey: qk.asignaturaLearningJobs(asignaturaId),
      })
    },
  })
}

type ActualizarRecursoVars = {
  recursoId: UUID
  patch: Partial<Tables<'learning_objects'>>
}

export function useActualizarRecurso(asignaturaId: UUID) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: ActualizarRecursoVars) =>
      recursos_update(vars.recursoId, vars.patch),
    ...optimisticMutation<
      Awaited<ReturnType<typeof recursos_update>>,
      ActualizarRecursoVars
    >({
      queryClient: qc,
      mutationKey: mk.recursoUpdate(),
      // El write afecta a la lista completa de recursos de la asignatura:
      // ediciones de recursos hermanos difieren la invalidación a la última.
      scope: () => asignaturaId,
      writes: () => [
        {
          key: qk.asignaturaRecursos(asignaturaId),
          exact: true,
          updater: (current: any, v) =>
            Array.isArray(current)
              ? current.map((r: any) =>
                  r.id === v.recursoId ? { ...r, ...v.patch } : r,
                )
              : current,
        },
      ],
      // Write-through de la fila del servidor antes de invalidar.
      reconcile: (updated, _vars, client) => {
        client.setQueryData(
          qk.asignaturaRecursos(asignaturaId),
          (current: any) =>
            Array.isArray(current)
              ? current.map((r: any) => (r.id === updated.id ? updated : r))
              : current,
        )
      },
      invalidateOnSettle: () => [qk.asignaturaLearningScores(asignaturaId)],
      errorMessage: 'No se pudo actualizar el contenido.',
    }),
  })
}

export function useEliminarRecurso(asignaturaId: UUID) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: recursos_delete,
    ...optimisticMutation<void, UUID>({
      queryClient: qc,
      mutationKey: mk.recursoDelete(),
      scope: () => asignaturaId,
      writes: () => [
        {
          key: qk.asignaturaRecursos(asignaturaId),
          exact: true,
          updater: (current: any, recursoId) =>
            Array.isArray(current)
              ? current.filter((r: any) => r.id !== recursoId)
              : current,
        },
      ],
      invalidateOnSettle: () => [qk.asignaturaLearningScores(asignaturaId)],
      errorMessage: 'No se pudo eliminar el contenido.',
    }),
  })
}

export function useRecalcularLearningScores() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: recursos_recalcular_scores,
    // Recálculo en el servidor (RPC idempotente): sin optimismo, pending
    // visible y seguro de reintentar desde el toast global.
    meta: {
      errorMessage: 'No se pudieron actualizar los indicadores internos.',
    },
    onSuccess: (_data, asignaturaId) => {
      qc.invalidateQueries({
        queryKey: qk.asignaturaLearningScores(asignaturaId),
      })
    },
  })
}
