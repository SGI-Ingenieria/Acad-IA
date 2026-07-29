import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { buscarBibliografia } from '../api/repositories.api'
import { buscar_bibliografia } from '../api/subjects.api'
import { qk } from '../query/keys'

import type { BibliotecaSearchParams } from '../api/repositories.api'
import type { BuscarBibliografiaRequest } from '../api/subjects.api'

export function useBuscarBibliografia() {
  return useMutation({
    mutationFn: buscarBibliografia,
    // Búsqueda idempotente: segura de reintentar.
    meta: { errorMessage: 'No se pudo buscar la bibliografía.' },
  })
}

export function useBusquedaBibliografiaInstitucional(
  params: BibliotecaSearchParams | null,
) {
  return useQuery({
    queryKey: qk.busquedaBibliografiaInstitucional(params),
    queryFn: () => buscarBibliografia(params as BibliotecaSearchParams),
    enabled: Boolean(params),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}

export function useBusquedaBibliografiaEnLinea(
  params: BuscarBibliografiaRequest | null,
) {
  return useQuery({
    queryKey: qk.busquedaBibliografiaEnLinea(params),
    queryFn: () => buscar_bibliografia(params as BuscarBibliografiaRequest),
    enabled: Boolean(params),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}
