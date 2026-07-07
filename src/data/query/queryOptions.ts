import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { paquetes_list } from '../api/paquetes.api'
import {
  getCatalogos,
  plan_asignaturas_list,
  plan_lineas_list,
  plan_registro_oficial_get,
  plans_estados_disponibles,
  plans_get,
  plans_get_document,
  plans_history,
  plans_list,
  registros_oficiales_list,
} from '../api/plans.api'
import {
  recursos_jobs_list,
  recursos_list,
  recursos_scores_list,
} from '../api/recursos.api'
import {
  asignaturas_asignables_list,
  responsables_list,
} from '../api/responsables.api'
import {
  subjects_archived_list,
  subjects_bibliografia_list,
  subjects_catalog_search,
  subjects_get,
  subjects_get_document,
  subjects_history,
} from '../api/subjects.api'
import {
  getUsuarioRelaciones,
  getUsuariosCatalogos,
  listUsuarios,
} from '../api/usuarios.api'

import { qk } from './keys'

import type { PlanListFilters } from '../api/plans.api'
import type { CatalogoAsignaturasFilters } from '../api/subjects.api'
import type { UUID } from '../types/domain'

export const catalogosOptions = () =>
  queryOptions({
    queryKey: qk.estructurasPlan(),
    queryFn: getCatalogos,
    staleTime: 1000 * 60 * 60,
  })

export const planesListOptions = (filters: PlanListFilters) =>
  queryOptions({
    queryKey: qk.planesList(filters),
    queryFn: () => plans_list(filters),
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  })

/**
 * Estados presentes entre los planes accesibles (para el filtro de estado).
 * No depende del estado seleccionado ni de la página, sólo del alcance.
 */
export const planesEstadosDisponiblesOptions = (
  filters: Pick<
    PlanListFilters,
    'facultadId' | 'carreraId' | 'nivelFilter' | 'catalogMode'
  >,
) =>
  queryOptions({
    queryKey: qk.planesEstadosDisponibles(filters),
    queryFn: () => plans_estados_disponibles(filters),
    staleTime: 1000 * 60 * 5,
  })

/**
 * No reintentar cuando el recurso no existe (PGRST116 = 0 filas): así el
 * componente puede mostrar el "no encontrado" de inmediato en vez de quedarse
 * en estado de carga durante los reintentos.
 */
const noRetryOnNotFound = (failureCount: number, error: unknown) => {
  if ((error as { code?: string } | null)?.code === 'PGRST116') return false
  return failureCount < 2
}

export const planOptions = (planId: UUID) =>
  queryOptions({
    queryKey: qk.plan(planId),
    queryFn: () => plans_get(planId),
    retry: noRetryOnNotFound,
  })

export const planAsignaturasOptions = (planId: UUID) =>
  queryOptions({
    queryKey: qk.planAsignaturas(planId),
    queryFn: () => plan_asignaturas_list(planId),
  })

export const planLineasOptions = (planId: UUID) =>
  queryOptions({
    queryKey: qk.planLineas(planId),
    queryFn: () => plan_lineas_list(planId),
  })

export const planHistorialOptions = (planId: UUID, page: number) =>
  queryOptions({
    queryKey: [...qk.planHistorial(planId), page] as const,
    queryFn: () => plans_history(planId, page),
  })

export const planDocumentoOptions = (planId: UUID) =>
  queryOptions({
    queryKey: qk.planDocumento(planId),
    queryFn: () => plans_get_document(planId),
    staleTime: 30_000,
  })

export const planRegistroOficialOptions = (planId: UUID) =>
  queryOptions({
    queryKey: qk.planRegistroOficial(planId),
    queryFn: () => plan_registro_oficial_get(planId),
    staleTime: 30_000,
  })

export const registrosOficialesOptions = () =>
  queryOptions({
    queryKey: qk.registrosOficiales(),
    queryFn: registros_oficiales_list,
    staleTime: 30_000,
  })

export const catalogoAsignaturasOptions = (
  filters: CatalogoAsignaturasFilters,
) =>
  queryOptions({
    queryKey: qk.catalogoAsignaturas(filters),
    queryFn: () => subjects_catalog_search(filters),
    staleTime: 1000 * 60 * 2,
    placeholderData: keepPreviousData,
  })

export const subjectOptions = (subjectId: UUID) =>
  queryOptions({
    queryKey: qk.asignatura(subjectId),
    queryFn: () => subjects_get(subjectId),
    retry: noRetryOnNotFound,
  })

export const subjectBibliografiaOptions = (subjectId: UUID) =>
  queryOptions({
    queryKey: qk.asignaturaBibliografia(subjectId),
    queryFn: () => subjects_bibliografia_list(subjectId),
  })

export const subjectHistorialOptions = (subjectId: UUID) =>
  queryOptions({
    queryKey: qk.asignaturaHistorial(subjectId),
    queryFn: () => subjects_history(subjectId),
  })

export const subjectDocumentoOptions = (subjectId: UUID) =>
  queryOptions({
    queryKey: qk.asignaturaDocumento(subjectId),
    queryFn: () => subjects_get_document(subjectId),
    staleTime: 30_000,
  })

export const archivedSubjectsOptions = (planId: UUID) =>
  queryOptions({
    queryKey: qk.asignaturasArchivadas(planId),
    queryFn: () => subjects_archived_list(planId),
  })

export const usuariosOptions = () =>
  queryOptions({
    queryKey: qk.usuarios(),
    queryFn: listUsuarios,
    staleTime: 0,
  })

export const usuariosCatalogosOptions = () =>
  queryOptions({
    queryKey: qk.usuariosCatalogos(),
    queryFn: getUsuariosCatalogos,
    staleTime: 1000 * 60 * 10,
  })

export const usuarioRelacionesOptions = (id: string) =>
  queryOptions({
    queryKey: qk.usuarioRelaciones(id),
    queryFn: () => getUsuarioRelaciones(id),
    staleTime: 1000 * 60,
  })

export const responsablesAsignaturaOptions = (asignaturaId: string) =>
  queryOptions({
    queryKey: qk.responsablesAsignatura(asignaturaId),
    queryFn: () => responsables_list(asignaturaId),
  })

export const asignaturasAsignablesOptions = () =>
  queryOptions({
    queryKey: qk.asignaturasAsignables(),
    queryFn: asignaturas_asignables_list,
    staleTime: 1000 * 60 * 5,
  })

export const asignaturaRecursosOptions = (asignaturaId: UUID) =>
  queryOptions({
    queryKey: qk.asignaturaRecursos(asignaturaId),
    queryFn: () => recursos_list(asignaturaId),
  })

export const asignaturaLearningScoresOptions = (asignaturaId: UUID) =>
  queryOptions({
    queryKey: qk.asignaturaLearningScores(asignaturaId),
    queryFn: () => recursos_scores_list(asignaturaId),
  })

export const asignaturaLearningJobsOptions = (asignaturaId: UUID) =>
  queryOptions({
    queryKey: qk.asignaturaLearningJobs(asignaturaId),
    queryFn: () => recursos_jobs_list(asignaturaId),
  })

export const asignaturaPaquetesOptions = (asignaturaId: UUID) =>
  queryOptions({
    queryKey: qk.asignaturaPaquetes(asignaturaId),
    queryFn: () => paquetes_list(asignaturaId),
  })
