import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  recursos_delete,
  recursos_generar,
  recursos_job_status,
  recursos_recalcular_scores,
  recursos_update,
} from '../api/recursos.api'
import {
  asignaturaLearningJobsOptions,
  asignaturaLearningScoresOptions,
  asignaturaRecursosOptions,
} from '../query/queryOptions'

import type { RecursoTipo } from '../api/recursos.api'
import type { UUID } from '../types/domain'
import type { Tables } from '@/types/supabase'

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
    }) =>
      recursos_generar(
        vars.asignaturaId,
        vars.unidadId,
        vars.temaId,
        vars.tipos,
        vars.instruccionesAdicionalesIA,
      ),
    onSuccess: () => {
      notify.success('Generación iniciada.')
    },
    onError: (err) => {
      notify.error(err, {
        description: 'No se pudieron generar los contenidos.',
      })
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({
        queryKey: ['asignaturas', vars.asignaturaId, 'recursos'],
      })
      qc.invalidateQueries({
        queryKey: ['asignaturas', vars.asignaturaId, 'learning_scores'],
      })
      qc.invalidateQueries({
        queryKey: ['asignaturas', vars.asignaturaId, 'learning_jobs'],
      })
    },
  })
}

export function useSincronizarLearningJob(asignaturaId: UUID) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (jobId: UUID) => recursos_job_status(jobId),
    retry: false,
    onSuccess: (data) => {
      qc.invalidateQueries({
        queryKey: ['asignaturas', asignaturaId, 'learning_jobs'],
      })

      if (data.job.estado === 'completed' || data.job.estado === 'failed') {
        qc.invalidateQueries({
          queryKey: ['asignaturas', asignaturaId, 'recursos'],
        })
        qc.invalidateQueries({
          queryKey: ['asignaturas', asignaturaId, 'learning_scores'],
        })
      }
    },
    onError: (err) => {
      console.warn('[useSincronizarLearningJob] status refresh failed', err)
      qc.invalidateQueries({
        queryKey: ['asignaturas', asignaturaId, 'learning_jobs'],
      })
    },
  })
}

export function useActualizarRecurso(asignaturaId: UUID) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (vars: {
      recursoId: UUID
      patch: Partial<Tables<'learning_objects'>>
    }) => recursos_update(vars.recursoId, vars.patch),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['asignaturas', asignaturaId, 'recursos'],
      })
      qc.invalidateQueries({
        queryKey: ['asignaturas', asignaturaId, 'learning_scores'],
      })
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo actualizar el contenido.' })
    },
  })
}

export function useEliminarRecurso(asignaturaId: UUID) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: recursos_delete,
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['asignaturas', asignaturaId, 'recursos'],
      })
      qc.invalidateQueries({
        queryKey: ['asignaturas', asignaturaId, 'learning_scores'],
      })
    },
    onError: (err) => {
      notify.error(err, { description: 'No se pudo eliminar el contenido.' })
    },
  })
}

export function useRecalcularLearningScores() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: recursos_recalcular_scores,
    onSuccess: (_data, asignaturaId) => {
      qc.invalidateQueries({
        queryKey: ['asignaturas', asignaturaId, 'learning_scores'],
      })
    },
    onError: (err) => {
      notify.error(err, {
        description: 'No se pudieron actualizar los indicadores internos.',
      })
    },
  })
}
