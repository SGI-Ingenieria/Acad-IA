import type { Paged } from '../types/domain'

/**
 * Calcula el siguiente offset a partir de lo ya acumulado, no del número de
 * páginas. Así sigue siendo correcto si una última página llega incompleta.
 */
export function siguienteOffset<T>(
  ultimaPagina: Paged<T>,
  paginas: Array<Paged<T>>,
): number | undefined {
  const cargados = paginas.reduce(
    (total, pagina) => total + pagina.data.length,
    0,
  )

  if (
    ultimaPagina.data.length === 0 ||
    (ultimaPagina.count !== null && cargados >= ultimaPagina.count)
  ) {
    return undefined
  }

  return cargados
}

export function extraerPaginas<T>(resultado: unknown): Array<Paged<T>> {
  if (!resultado || typeof resultado !== 'object') return []

  const posiblePagina = resultado as Partial<Paged<T>>
  if (Array.isArray(posiblePagina.data)) {
    return [posiblePagina as Paged<T>]
  }

  const posiblesPaginas = (resultado as { pages?: unknown }).pages
  if (!Array.isArray(posiblesPaginas)) return []

  return posiblesPaginas.filter((pagina): pagina is Paged<T> =>
    Boolean(
      pagina &&
      typeof pagina === 'object' &&
      Array.isArray((pagina as Partial<Paged<T>>).data),
    ),
  )
}
