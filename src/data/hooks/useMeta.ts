import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  carreras_archive,
  carreras_create,
  carreras_update,
  carreras_list,
  facultades_archive,
  facultades_create,
  facultades_update,
  estados_plan_list,
  estructuras_asignatura_create,
  estructuras_asignatura_delete,
  estructuras_asignatura_list,
  estructuras_asignatura_update,
  estructuras_plan_create,
  estructuras_plan_delete,
  estructuras_plan_list,
  estructuras_plan_update,
  facultades_list,
} from '../api/meta.api'
import { qk } from '../query/keys'

import type { Tables } from '@/types/supabase'

type FacultadPayload = {
  nombre: string
  nombre_corto?: string | null
  color?: string | null
  icono?: string | null
}

type CarreraPayload = {
  facultad_id: string
  nombre: string
  nombre_corto?: string | null
  clave_sep?: string | null
  nivel?: Tables<'carreras'>['nivel']
}

type FacultadUpdatePayload = {
  facultadId: string
  input: FacultadPayload
}

type CarreraUpdatePayload = {
  carreraId: string
  input: CarreraPayload
}

export function useFacultades() {
  return useQuery({
    queryKey: qk.facultades(),
    queryFn: facultades_list,
    staleTime: 5 * 60_000,
  })
}

export function useCarreras(params?: { facultadId?: string | null }) {
  return useQuery({
    queryKey: qk.carreras(params?.facultadId ?? null),
    queryFn: () => carreras_list(params),
    staleTime: 5 * 60_000,
  })
}

export function useEstructurasPlan(params?: { nivel?: string | null }) {
  return useQuery({
    queryKey: qk.estructurasPlanList(params?.nivel ?? null),
    queryFn: () => estructuras_plan_list(params),
    staleTime: 10 * 60_000,
  })
}

export function useEstructurasAsignatura() {
  return useQuery({
    queryKey: qk.estructurasAsignatura(),
    queryFn: estructuras_asignatura_list,
    staleTime: 10 * 60_000,
  })
}

export function useEstadosPlan() {
  return useQuery({
    queryKey: qk.estadosPlan(),
    queryFn: estados_plan_list,
    staleTime: 10 * 60_000,
  })
}

export function useEstructurasPlanCrud() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qk.estructurasPlanList(null) })

  const create = useMutation({
    mutationFn: estructuras_plan_create,
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof estructuras_plan_update>[1] }) =>
      estructuras_plan_update(id, input),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: estructuras_plan_delete,
    onSuccess: invalidate,
  })

  return { create, update, remove }
}

export function useEstructurasAsignaturaCrud() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qk.estructurasAsignatura() })

  const create = useMutation({
    mutationFn: estructuras_asignatura_create,
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof estructuras_asignatura_update>[1] }) =>
      estructuras_asignatura_update(id, input),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: estructuras_asignatura_delete,
    onSuccess: invalidate,
  })

  return { create, update, remove }
}

export function useFacultadesCrud() {
  const queryClient = useQueryClient()

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.facultades() }),
      queryClient.invalidateQueries({ queryKey: qk.carreras() }),
    ])
  }

  const createFacultad = useMutation({
    mutationFn: facultades_create,
    onSuccess: invalidate,
  })

  const updateFacultad = useMutation({
    mutationFn: ({ facultadId, input }: FacultadUpdatePayload) =>
      facultades_update(facultadId, input),
    onSuccess: invalidate,
  })

  const archiveFacultad = useMutation({
    mutationFn: facultades_archive,
    onSuccess: invalidate,
  })

  return { createFacultad, updateFacultad, archiveFacultad }
}

export function useCarrerasCrud() {
  const queryClient = useQueryClient()

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.facultades() }),
      queryClient.invalidateQueries({ queryKey: qk.carreras() }),
    ])
  }

  const createCarrera = useMutation({
    mutationFn: carreras_create,
    onSuccess: invalidate,
  })

  const updateCarrera = useMutation({
    mutationFn: ({ carreraId, input }: CarreraUpdatePayload) =>
      carreras_update(carreraId, input),
    onSuccess: invalidate,
  })

  const archiveCarrera = useMutation({
    mutationFn: carreras_archive,
    onSuccess: invalidate,
  })

  return { createCarrera, updateCarrera, archiveCarrera }
}
