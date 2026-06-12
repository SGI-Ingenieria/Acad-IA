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

import { notify } from '@/lib/toast'

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
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Parameters<typeof estructuras_plan_update>[1]
    }) => estructuras_plan_update(id, input),
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
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Parameters<typeof estructuras_asignatura_update>[1]
    }) => estructuras_asignatura_update(id, input),
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

  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.facultades() }),
      queryClient.invalidateQueries({ queryKey: qk.carreras() }),
    ])

  const createFacultad = useMutation({
    mutationFn: facultades_create,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: qk.facultades() })
      const previous = queryClient.getQueryData<Array<Tables<'facultades'>>>(
        qk.facultades(),
      )
      const tempId = `temp-${Date.now()}`
      const optimisticRow = {
        id: tempId,
        nombre: input.nombre,
        nombre_corto: input.nombre_corto ?? null,
        color: input.color ?? null,
        icono: input.icono ?? null,
        activa: true,
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
        __optimistic: true,
      } as unknown as Tables<'facultades'>

      if (previous) {
        queryClient.setQueryData<Array<Tables<'facultades'>>>(qk.facultades(), [
          optimisticRow,
          ...previous,
        ])
      }
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk.facultades(), context.previous)
      }
      notify.error(err, { description: 'No se pudo crear la facultad.' })
    },
    onSettled: () => {
      void invalidateAll()
    },
  })

  const updateFacultad = useMutation({
    mutationFn: ({ facultadId, input }: FacultadUpdatePayload) =>
      facultades_update(facultadId, input),
    onMutate: async ({ facultadId, input }) => {
      await queryClient.cancelQueries({ queryKey: qk.facultades() })
      const previous = queryClient.getQueryData<Array<Tables<'facultades'>>>(
        qk.facultades(),
      )
      if (previous) {
        queryClient.setQueryData<Array<Tables<'facultades'>>>(
          qk.facultades(),
          previous.map((f) =>
            f.id === facultadId
              ? {
                  ...f,
                  nombre: input.nombre,
                  nombre_corto: input.nombre_corto ?? null,
                  color: input.color ?? null,
                  icono: input.icono ?? null,
                  actualizado_en: new Date().toISOString(),
                }
              : f,
          ),
        )
      }
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk.facultades(), context.previous)
      }
      notify.error(err, { description: 'No se pudo actualizar la facultad.' })
    },
    onSettled: () => {
      void invalidateAll()
    },
  })

  const archiveFacultad = useMutation({
    mutationFn: facultades_archive,
    onMutate: async (facultadId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: qk.facultades() }),
        queryClient.cancelQueries({ queryKey: qk.carreras() }),
      ])
      const prevFacultades = queryClient.getQueryData<
        Array<Tables<'facultades'>>
      >(qk.facultades())
      const prevCarreras = queryClient.getQueriesData<
        Array<Tables<'carreras'>>
      >({ queryKey: ['carreras'] })

      if (prevFacultades) {
        queryClient.setQueryData<Array<Tables<'facultades'>>>(
          qk.facultades(),
          prevFacultades.map((f) =>
            f.id === facultadId ? { ...f, activa: false } : f,
          ),
        )
      }
      for (const [key, data] of prevCarreras) {
        if (!Array.isArray(data)) continue
        queryClient.setQueryData<Array<Tables<'carreras'>>>(
          key,
          data.map((c) =>
            c.facultad_id === facultadId ? { ...c, activa: false } : c,
          ),
        )
      }
      return { prevFacultades, prevCarreras }
    },
    onError: (err, _vars, context) => {
      if (context?.prevFacultades) {
        queryClient.setQueryData(qk.facultades(), context.prevFacultades)
      }
      if (context?.prevCarreras) {
        for (const [key, data] of context.prevCarreras) {
          queryClient.setQueryData(key, data)
        }
      }
      notify.error(err, { description: 'No se pudo archivar la facultad.' })
    },
    onSettled: () => {
      void invalidateAll()
    },
  })

  return { createFacultad, updateFacultad, archiveFacultad }
}

export function useCarrerasCrud() {
  const queryClient = useQueryClient()

  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.facultades() }),
      queryClient.invalidateQueries({ queryKey: qk.carreras() }),
    ])

  const createCarrera = useMutation({
    mutationFn: carreras_create,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['carreras'] })
      const prevAll = queryClient.getQueriesData<Array<Tables<'carreras'>>>({
        queryKey: ['carreras'],
      })
      const tempId = `temp-${Date.now()}`
      const optimisticRow = {
        id: tempId,
        facultad_id: input.facultad_id,
        nombre: input.nombre,
        nombre_corto: input.nombre_corto ?? null,
        clave_sep: input.clave_sep ?? null,
        nivel: input.nivel ?? null,
        activa: true,
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
        __optimistic: true,
      } as unknown as Tables<'carreras'>

      for (const [key, data] of prevAll) {
        if (!Array.isArray(data)) continue
        queryClient.setQueryData<Array<Tables<'carreras'>>>(key, [
          optimisticRow,
          ...data,
        ])
      }
      return { prevAll }
    },
    onError: (err, _vars, context) => {
      if (context?.prevAll) {
        for (const [key, data] of context.prevAll) {
          queryClient.setQueryData(key, data)
        }
      }
      notify.error(err, { description: 'No se pudo crear la carrera.' })
    },
    onSettled: () => {
      void invalidateAll()
    },
  })

  const updateCarrera = useMutation({
    mutationFn: ({ carreraId, input }: CarreraUpdatePayload) =>
      carreras_update(carreraId, input),
    onMutate: async ({ carreraId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['carreras'] })
      const prevAll = queryClient.getQueriesData<Array<Tables<'carreras'>>>({
        queryKey: ['carreras'],
      })
      for (const [key, data] of prevAll) {
        if (!Array.isArray(data)) continue
        queryClient.setQueryData<Array<Tables<'carreras'>>>(
          key,
          data.map((c) =>
            c.id === carreraId
              ? {
                  ...c,
                  facultad_id: input.facultad_id,
                  nombre: input.nombre,
                  nombre_corto: input.nombre_corto ?? null,
                  clave_sep: input.clave_sep ?? null,
                  nivel: input.nivel ?? c.nivel,
                  actualizado_en: new Date().toISOString(),
                }
              : c,
          ),
        )
      }
      return { prevAll }
    },
    onError: (err, _vars, context) => {
      if (context?.prevAll) {
        for (const [key, data] of context.prevAll) {
          queryClient.setQueryData(key, data)
        }
      }
      notify.error(err, { description: 'No se pudo actualizar la carrera.' })
    },
    onSettled: () => {
      void invalidateAll()
    },
  })

  const archiveCarrera = useMutation({
    mutationFn: carreras_archive,
    onMutate: async (carreraId) => {
      await queryClient.cancelQueries({ queryKey: ['carreras'] })
      const prevAll = queryClient.getQueriesData<Array<Tables<'carreras'>>>({
        queryKey: ['carreras'],
      })
      for (const [key, data] of prevAll) {
        if (!Array.isArray(data)) continue
        queryClient.setQueryData<Array<Tables<'carreras'>>>(
          key,
          data.map((c) => (c.id === carreraId ? { ...c, activa: false } : c)),
        )
      }
      return { prevAll }
    },
    onError: (err, _vars, context) => {
      if (context?.prevAll) {
        for (const [key, data] of context.prevAll) {
          queryClient.setQueryData(key, data)
        }
      }
      notify.error(err, { description: 'No se pudo archivar la carrera.' })
    },
    onSettled: () => {
      void invalidateAll()
    },
  })

  return { createCarrera, updateCarrera, archiveCarrera }
}
