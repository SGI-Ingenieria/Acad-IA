import { useMutation } from '@tanstack/react-query'

import { buscarBibliografia } from '../api/repositories.api'

export function useBuscarBibliografia() {
  return useMutation({
    mutationFn: buscarBibliografia,
    // Búsqueda idempotente: segura de reintentar.
    meta: { errorMessage: 'No se pudo buscar la bibliografía.' },
  })
}
