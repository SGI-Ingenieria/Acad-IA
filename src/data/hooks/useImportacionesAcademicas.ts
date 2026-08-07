import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  importaciones_actualizar_rol,
  importaciones_analizar,
  importaciones_aplicar,
  importaciones_aplicar_programas,
  importaciones_cancelar,
  importaciones_crear,
  importaciones_obtener,
  importaciones_vincular_archivo,
  planes_obtener_linaje,
} from '../api/importaciones.api'
import { qk } from '../query/keys'

export function useImportacionAcademica(importacionId?: string | null) {
  return useQuery({
    queryKey: qk.importacionAcademica(importacionId ?? ''),
    queryFn: () => importaciones_obtener(importacionId as string),
    enabled: Boolean(importacionId),
  })
}

export function useCrearImportacionAcademica() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importaciones_crear,
    onSuccess: (importacion) => {
      queryClient.setQueryData(qk.importacionAcademica(importacion.id), {
        ...importacion,
        importacion_archivos: [],
      })
    },
  })
}

export function useVincularArchivoImportacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importaciones_vincular_archivo,
    onSuccess: (archivo) => {
      queryClient.invalidateQueries({
        queryKey: qk.importacionAcademica(archivo.importacion_id),
      })
    },
  })
}

export function useActualizarRolArchivoImportacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importaciones_actualizar_rol,
    onSuccess: (archivo) => {
      queryClient.invalidateQueries({
        queryKey: qk.importacionAcademica(archivo.importacion_id),
      })
    },
  })
}

export function useAnalizarImportacionAcademica() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importaciones_analizar,
    onSuccess: (importacion) => {
      queryClient.setQueryData(
        qk.importacionAcademica(importacion.id),
        importacion,
      )
    },
  })
}

export function useAplicarImportacionAcademica() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importaciones_aplicar,
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: qk.planesListRoot() })
      queryClient.invalidateQueries({
        queryKey: qk.importacionAcademica(resultado.importacion_id),
      })
    },
  })
}

export function useAplicarImportacionProgramas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importaciones_aplicar_programas,
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: qk.planesListRoot() })
      queryClient.invalidateQueries({ queryKey: qk.asignaturasRoot() })
      queryClient.invalidateQueries({
        queryKey: qk.importacionAcademica(resultado.importacion_id),
      })
    },
  })
}

export function useCancelarImportacionAcademica() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importaciones_cancelar,
    onSuccess: (importacion) => {
      queryClient.setQueryData(
        qk.importacionAcademica(importacion.id),
        importacion,
      )
    },
  })
}

export function useLinajePlan(planId?: string | null) {
  return useQuery({
    queryKey: qk.planLinaje(planId ?? ''),
    queryFn: () => planes_obtener_linaje(planId as string),
    enabled: Boolean(planId),
  })
}
