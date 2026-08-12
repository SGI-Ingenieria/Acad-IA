import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  carreras_archive,
  carreras_create,
  carreras_update,
  carreras_list,
  facultades_archive,
  facultades_create,
  facultades_update,
  lineas_sugeridas_archive,
  lineas_sugeridas_create,
  lineas_sugeridas_list,
  lineas_sugeridas_update,
  estados_plan_list,
  estructuras_asignatura_create,
  estructuras_asignatura_delete,
  estructuras_asignatura_list,
  estructuras_asignatura_update,
  estructuras_plan_create,
  estructuras_plan_list,
  estructuras_plan_retire,
  estructuras_plan_retire_action,
  estructuras_plan_update,
  facultades_list,
  normalizarDefaultsCiclos,
  paquetes_curriculares_create,
  paquetes_curriculares_create_version,
  paquetes_curriculares_publish,
  paquetes_curriculares_validate,
} from '../api/meta.api'
import { mk, qk } from '../query/keys'

import type { DefaultsCiclosCarrera } from '../api/meta.api'
import type { Tables } from '@/types/supabase'

import { isTempId, makeTempId, optimisticMutation } from '@/lib/optimistic'

type FacultadPayload = {
  nombre: string
  nombre_corto?: string | null
  prefijo?: string | null
  color?: string | null
  icono?: string | null
}

type CarreraPayload = {
  facultad_id: string
  nombre: string
  nombre_corto?: string | null
  clave_sep?: string | null
  nivel?: Tables<'carreras'>['nivel']
} & DefaultsCiclosCarrera

type FacultadUpdatePayload = {
  facultadId: string
  input: FacultadPayload
}

type CarreraUpdatePayload = {
  carreraId: string
  input: CarreraPayload
}

type EstructuraPlanUpdateVars = {
  id: string
  input: Parameters<typeof estructuras_plan_update>[1]
}

type EstructuraAsignaturaUpdateVars = {
  id: string
  input: Parameters<typeof estructuras_asignatura_update>[1]
}

/** Campos definidos del input, sin `propagationOperations` (solo backend). */
const estructuraPatch = (input: {
  propagationOperations?: unknown
  [key: string]: unknown
}) => {
  const { propagationOperations: _ops, ...rest } = input
  return Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  )
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

export function useEstructuraPlanRetiro(estructuraId?: string | null) {
  return useQuery({
    queryKey: qk.estructuraPlanRetiro(estructuraId ?? ''),
    queryFn: () => estructuras_plan_retire_action(estructuraId!),
    enabled: Boolean(estructuraId),
    staleTime: 30_000,
  })
}

export function useEstructurasAsignatura(params?: {
  estructuraPlanId?: string | null
}) {
  return useQuery({
    queryKey: qk.estructurasAsignatura(params?.estructuraPlanId ?? null),
    queryFn: () => estructuras_asignatura_list(params),
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

  const create = useMutation({
    mutationFn: estructuras_plan_create,
    // La fila nace con defaults del servidor (id, definición normalizada):
    // sin optimismo; pending visible + toast global en error.
    meta: {
      errorMessage: 'No se pudo crear la estructura de plan.',
      retryable: false,
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.estructurasPlanListRoot(),
        }),
        queryClient.invalidateQueries({ queryKey: qk.estructurasPlan() }),
        queryClient.invalidateQueries({
          queryKey: qk.estructuraPlanRetiroRoot(),
        }),
      ]),
  })

  const update = useMutation({
    mutationFn: ({ id, input }: EstructuraPlanUpdateVars) =>
      estructuras_plan_update(id, input),
    ...optimisticMutation<Tables<'estructuras_plan'>, EstructuraPlanUpdateVars>(
      {
        queryClient,
        mutationKey: mk.estructuraPlanSave(),
        scope: (vars) => vars.id,
        writes: () => [
          {
            key: qk.estructurasPlanListRoot(),
            updater: (current: any, v) =>
              Array.isArray(current)
                ? current.map((item: any) =>
                    item.id === v.id
                      ? {
                          ...item,
                          ...estructuraPatch(v.input),
                          actualizado_en: new Date().toISOString(),
                        }
                      : item,
                  )
                : current,
          },
        ],
        // Write-through de la fila del servidor antes de invalidar (la RPC de
        // definición puede propagar cambios que el patch local no conoce).
        reconcile: (updated, _vars, client) => {
          client.setQueriesData(
            { queryKey: qk.estructurasPlanListRoot() },
            (current: any) =>
              Array.isArray(current)
                ? current.map((item: any) =>
                    item.id === updated.id ? { ...item, ...updated } : item,
                  )
                : current,
          )
          client.setQueryData(qk.estructurasPlan(), (current: any) => {
            if (!current?.estructurasPlan) return current
            return {
              ...current,
              estructurasPlan: current.estructurasPlan.map((item: any) =>
                item.id === updated.id ? { ...item, ...updated } : item,
              ),
            }
          })
        },
        invalidateOnSettle: () => [qk.estructurasPlan()],
        errorMessage: 'No se pudo guardar la estructura de plan.',
      },
    ),
  })

  const retire = useMutation({
    mutationFn: estructuras_plan_retire,
    mutationKey: mk.estructuraPlanSave(),
    meta: {
      errorMessage: 'No se pudo retirar el paquete curricular.',
      retryable: false,
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.estructurasPlanListRoot(),
        }),
        queryClient.invalidateQueries({ queryKey: qk.estructurasPlan() }),
        queryClient.invalidateQueries({
          queryKey: qk.estructuraPlanRetiroRoot(),
        }),
      ]),
  })

  return { create, update, retire }
}

export function usePaquetesCurricularesCrud() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: qk.estructurasPlanListRoot(),
      }),
      queryClient.invalidateQueries({
        queryKey: qk.estructuraPlanRetiroRoot(),
      }),
    ])

  const create = useMutation({
    mutationFn: paquetes_curriculares_create,
    onSuccess: invalidate,
  })
  const createVersion = useMutation({
    mutationFn: paquetes_curriculares_create_version,
    onSuccess: invalidate,
  })
  const publish = useMutation({
    mutationFn: paquetes_curriculares_publish,
    onSuccess: invalidate,
  })
  const validate = useMutation({ mutationFn: paquetes_curriculares_validate })

  return { create, createVersion, publish, validate }
}

export function useEstructurasAsignaturaCrud() {
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: estructuras_asignatura_create,
    // Forma con defaults del servidor: sin optimismo.
    meta: {
      errorMessage: 'No se pudo crear la estructura de asignatura.',
      retryable: false,
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: qk.estructurasAsignaturaRoot(),
      }),
  })

  const update = useMutation({
    mutationFn: ({ id, input }: EstructuraAsignaturaUpdateVars) =>
      estructuras_asignatura_update(id, input),
    ...optimisticMutation<
      Tables<'estructuras_asignatura'>,
      EstructuraAsignaturaUpdateVars
    >({
      queryClient,
      mutationKey: mk.estructuraAsignaturaSave(),
      scope: (vars) => vars.id,
      writes: () => [
        {
          key: qk.estructurasAsignaturaRoot(),
          updater: (current: any, v) =>
            Array.isArray(current)
              ? current.map((item: any) =>
                  item.id === v.id
                    ? {
                        ...item,
                        ...estructuraPatch(v.input),
                        actualizado_en: new Date().toISOString(),
                      }
                    : item,
                )
              : current,
        },
      ],
      // Write-through de la fila del servidor antes de invalidar.
      reconcile: (updated, _vars, client) => {
        client.setQueriesData(
          { queryKey: qk.estructurasAsignaturaRoot() },
          (current: any) =>
            Array.isArray(current)
              ? current.map((item: any) =>
                  item.id === updated.id ? { ...item, ...updated } : item,
                )
              : current,
        )
      },
      errorMessage: 'No se pudo guardar la estructura de asignatura.',
    }),
  })

  const remove = useMutation({
    mutationFn: estructuras_asignatura_delete,
    ...optimisticMutation<void, string>({
      queryClient,
      mutationKey: mk.estructuraAsignaturaSave(),
      scope: (id) => id,
      writes: () => [
        {
          key: qk.estructurasAsignaturaRoot(),
          updater: (current: any, id) =>
            Array.isArray(current)
              ? current.filter((item: any) => item.id !== id)
              : current,
        },
      ],
      errorMessage: 'No se pudo eliminar la estructura de asignatura.',
    }),
  })

  return { create, update, remove }
}

export function useFacultadesCrud() {
  const queryClient = useQueryClient()

  const createFacultad = useMutation({
    mutationFn: facultades_create,
    ...optimisticMutation<Tables<'facultades'>, FacultadPayload>({
      queryClient,
      mutationKey: mk.facultadSave(),
      scope: () => 'create',
      writes: () => [
        {
          key: qk.facultades(),
          exact: true,
          updater: (current: any, input) =>
            Array.isArray(current)
              ? [
                  {
                    id: makeTempId(),
                    nombre: input.nombre,
                    nombre_corto: input.nombre_corto ?? null,
                    prefijo: input.prefijo ?? null,
                    color: input.color ?? null,
                    icono: input.icono ?? null,
                    activa: true,
                    creado_en: new Date().toISOString(),
                    actualizado_en: new Date().toISOString(),
                  },
                  ...current,
                ]
              : current,
        },
      ],
      reconcile: (creada, _input, client) => {
        client.setQueryData(qk.facultades(), (current: any) =>
          Array.isArray(current)
            ? current.map((f: any) => (isTempId(f.id) ? creada : f))
            : current,
        )
      },
      invalidateOnSettle: () => [qk.facultades(), qk.carrerasRoot()],
      errorMessage: 'No se pudo crear la facultad.',
    }),
  })

  const updateFacultad = useMutation({
    mutationFn: ({ facultadId, input }: FacultadUpdatePayload) =>
      facultades_update(facultadId, input),
    ...optimisticMutation<Tables<'facultades'>, FacultadUpdatePayload>({
      queryClient,
      mutationKey: mk.facultadSave(),
      scope: (vars) => vars.facultadId,
      writes: () => [
        {
          key: qk.facultades(),
          exact: true,
          updater: (current: any, v) =>
            Array.isArray(current)
              ? current.map((f: any) =>
                  f.id === v.facultadId
                    ? {
                        ...f,
                        nombre: v.input.nombre,
                        nombre_corto: v.input.nombre_corto ?? null,
                        prefijo: v.input.prefijo ?? null,
                        color: v.input.color ?? null,
                        icono: v.input.icono ?? null,
                        actualizado_en: new Date().toISOString(),
                      }
                    : f,
                )
              : current,
        },
      ],
      reconcile: (updated, _vars, client) => {
        client.setQueryData(qk.facultades(), (current: any) =>
          Array.isArray(current)
            ? current.map((f: any) =>
                f.id === updated.id ? { ...f, ...updated } : f,
              )
            : current,
        )
      },
      // Las carreras embeben datos de su facultad (nombre, color, prefijo…).
      invalidateOnSettle: () => [qk.facultades(), qk.carrerasRoot()],
      errorMessage: 'No se pudo actualizar la facultad.',
    }),
  })

  const archiveFacultad = useMutation({
    mutationFn: facultades_archive,
    ...optimisticMutation<{ id: string }, string>({
      queryClient,
      mutationKey: mk.facultadArchive(),
      scope: (facultadId) => facultadId,
      writes: () => [
        {
          key: qk.facultades(),
          exact: true,
          updater: (current: any, facultadId) =>
            Array.isArray(current)
              ? current.map((f: any) =>
                  f.id === facultadId ? { ...f, activa: false } : f,
                )
              : current,
        },
        {
          // El backend archiva en cascada las carreras de la facultad.
          key: qk.carrerasRoot(),
          updater: (current: any, facultadId) =>
            Array.isArray(current)
              ? current.map((c: any) =>
                  c.facultad_id === facultadId ? { ...c, activa: false } : c,
                )
              : current,
        },
      ],
      invalidateOnSettle: () => [qk.facultades(), qk.carrerasRoot()],
      errorMessage: 'No se pudo archivar la facultad.',
    }),
  })

  return { createFacultad, updateFacultad, archiveFacultad }
}

export function useCarrerasCrud() {
  const queryClient = useQueryClient()

  const createCarrera = useMutation({
    mutationFn: carreras_create,
    ...optimisticMutation<Tables<'carreras'>, CarreraPayload>({
      queryClient,
      mutationKey: mk.carreraSave(),
      scope: () => 'create',
      writes: () => [
        {
          // Por prefijo: hay variantes de la lista filtradas por facultad.
          key: qk.carrerasRoot(),
          updater: (current: any, input) =>
            Array.isArray(current)
              ? [
                  {
                    id: makeTempId(),
                    facultad_id: input.facultad_id,
                    nombre: input.nombre,
                    nombre_corto: input.nombre_corto ?? null,
                    clave_sep: input.clave_sep ?? null,
                    nivel: input.nivel ?? 'Otro',
                    ...normalizarDefaultsCiclos(input),
                    activa: true,
                    creado_en: new Date().toISOString(),
                    actualizado_en: new Date().toISOString(),
                  },
                  ...current,
                ]
              : current,
        },
      ],
      reconcile: (creada, _input, client) => {
        client.setQueriesData(
          { queryKey: qk.carrerasRoot() },
          (current: any) =>
            Array.isArray(current)
              ? current.map((c: any) => (isTempId(c.id) ? creada : c))
              : current,
        )
      },
      invalidateOnSettle: () => [qk.facultades(), qk.carrerasRoot()],
      errorMessage: 'No se pudo crear la carrera.',
    }),
  })

  const updateCarrera = useMutation({
    mutationFn: ({ carreraId, input }: CarreraUpdatePayload) =>
      carreras_update(carreraId, input),
    ...optimisticMutation<Tables<'carreras'>, CarreraUpdatePayload>({
      queryClient,
      mutationKey: mk.carreraSave(),
      scope: (vars) => vars.carreraId,
      writes: () => [
        {
          key: qk.carrerasRoot(),
          updater: (current: any, v) =>
            Array.isArray(current)
              ? current.map((c: any) =>
                  c.id === v.carreraId
                    ? {
                        ...c,
                        facultad_id: v.input.facultad_id,
                        nombre: v.input.nombre,
                        nombre_corto: v.input.nombre_corto ?? null,
                        clave_sep: v.input.clave_sep ?? null,
                        nivel: v.input.nivel ?? c.nivel,
                        ...normalizarDefaultsCiclos(v.input),
                        actualizado_en: new Date().toISOString(),
                      }
                    : c,
                )
              : current,
        },
      ],
      reconcile: (updated, _vars, client) => {
        client.setQueriesData(
          { queryKey: qk.carrerasRoot() },
          (current: any) =>
            Array.isArray(current)
              ? current.map((c: any) =>
                  c.id === updated.id ? { ...c, ...updated } : c,
                )
              : current,
        )
      },
      invalidateOnSettle: () => [qk.facultades(), qk.carrerasRoot()],
      errorMessage: 'No se pudo actualizar la carrera.',
    }),
  })

  const archiveCarrera = useMutation({
    mutationFn: carreras_archive,
    ...optimisticMutation<{ id: string }, string>({
      queryClient,
      mutationKey: mk.carreraArchive(),
      scope: (carreraId) => carreraId,
      writes: () => [
        {
          key: qk.carrerasRoot(),
          updater: (current: any, carreraId) =>
            Array.isArray(current)
              ? current.map((c: any) =>
                  c.id === carreraId ? { ...c, activa: false } : c,
                )
              : current,
        },
      ],
      invalidateOnSettle: () => [qk.facultades(), qk.carrerasRoot()],
      errorMessage: 'No se pudo archivar la carrera.',
    }),
  })

  return { createCarrera, updateCarrera, archiveCarrera }
}

type LineaSugeridaPayload = {
  nombre: string
  area?: string | null
  color?: string | null
  orden?: number
}

type LineaSugeridaUpdatePayload = {
  id: string
  input: LineaSugeridaPayload
}

export function useLineasSugeridas(facultadId?: string | null) {
  return useQuery({
    queryKey: qk.lineasSugeridas(facultadId ?? ''),
    queryFn: () => lineas_sugeridas_list(facultadId as string),
    enabled: Boolean(facultadId),
    staleTime: 5 * 60_000,
  })
}

export function useLineasSugeridasCrud(facultadId: string) {
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: (input: LineaSugeridaPayload) =>
      lineas_sugeridas_create({ ...input, facultad_id: facultadId }),
    ...optimisticMutation<
      Tables<'lineas_curriculares_sugeridas'>,
      LineaSugeridaPayload
    >({
      queryClient,
      mutationKey: mk.lineaSugeridaSave(),
      scope: () => 'create',
      writes: () => [
        {
          key: qk.lineasSugeridas(facultadId),
          exact: true,
          updater: (current: any, input) =>
            Array.isArray(current)
              ? [
                  ...current,
                  {
                    id: makeTempId(),
                    facultad_id: facultadId,
                    nombre: input.nombre,
                    area: input.area ?? null,
                    color: input.color ?? null,
                    orden: input.orden ?? 0,
                    activa: true,
                    creado_en: new Date().toISOString(),
                    actualizado_en: new Date().toISOString(),
                  },
                ]
              : current,
        },
      ],
      reconcile: (creada, _input, client) => {
        client.setQueryData(qk.lineasSugeridas(facultadId), (current: any) =>
          Array.isArray(current)
            ? current.map((l: any) => (isTempId(l.id) ? creada : l))
            : current,
        )
      },
      errorMessage: 'No se pudo crear la línea sugerida.',
    }),
  })

  const update = useMutation({
    mutationFn: ({ id, input }: LineaSugeridaUpdatePayload) =>
      lineas_sugeridas_update(id, input),
    ...optimisticMutation<
      Tables<'lineas_curriculares_sugeridas'>,
      LineaSugeridaUpdatePayload
    >({
      queryClient,
      mutationKey: mk.lineaSugeridaSave(),
      scope: (vars) => vars.id,
      writes: () => [
        {
          key: qk.lineasSugeridas(facultadId),
          exact: true,
          updater: (current: any, v) =>
            Array.isArray(current)
              ? current.map((l: any) =>
                  l.id === v.id
                    ? {
                        ...l,
                        nombre: v.input.nombre,
                        area: v.input.area ?? null,
                        color: v.input.color ?? null,
                        ...(v.input.orden !== undefined
                          ? { orden: v.input.orden }
                          : {}),
                        actualizado_en: new Date().toISOString(),
                      }
                    : l,
                )
              : current,
        },
      ],
      reconcile: (updated, _vars, client) => {
        client.setQueryData(qk.lineasSugeridas(facultadId), (current: any) =>
          Array.isArray(current)
            ? current.map((l: any) =>
                l.id === updated.id ? { ...l, ...updated } : l,
              )
            : current,
        )
      },
      errorMessage: 'No se pudo actualizar la línea sugerida.',
    }),
  })

  const archive = useMutation({
    mutationFn: lineas_sugeridas_archive,
    ...optimisticMutation<{ id: string }, string>({
      queryClient,
      mutationKey: mk.lineaSugeridaArchive(),
      scope: (id) => id,
      writes: () => [
        {
          // La lista solo muestra líneas activas: archivar equivale a quitarla.
          key: qk.lineasSugeridas(facultadId),
          exact: true,
          updater: (current: any, id) =>
            Array.isArray(current)
              ? current.filter((l: any) => l.id !== id)
              : current,
        },
      ],
      errorMessage: 'No se pudo archivar la línea sugerida.',
    }),
  })

  return { create, update, archive }
}
