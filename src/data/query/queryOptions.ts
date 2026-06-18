import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import {
  getCatalogos,
  plan_asignaturas_list,
  plan_lineas_list,
  plans_get,
  plans_get_document,
  plans_history,
  plans_list,
} from '../api/plans.api'
import {
  asignaturas_asignables_list,
  responsables_list,
} from '../api/responsables.api'
import {
  subjects_archived_list,
  subjects_bibliografia_list,
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
