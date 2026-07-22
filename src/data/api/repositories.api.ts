// Búsqueda bibliográfica institucional (edge `biblioteca`). Los antiguos
// repositorios/vector stores manuales fueron retirados: el retrieval de
// referencias vive en la biblioteca documental (`documentos.api.ts`).
import { invokeEdge } from '../supabase/invokeEdge'

const EDGE = {
  biblioteca: 'biblioteca',
} as const

export type BibliotecaSearchParams = {
  titulo: string
  autor?: string
  isbn?: string
}

export type BibliotecaItem = {
  id: string
  titulo: string
  descripcion?: string
  autor?: string
  editorial?: string
  anio?: number | string
  isbn?: string
}

export type BibliotecaSearchResult = {
  results: Array<BibliotecaItem>
}

export async function buscarBibliografia(
  payload: BibliotecaSearchParams,
): Promise<BibliotecaSearchResult> {
  return invokeEdge<BibliotecaSearchResult>(EDGE.biblioteca, payload, {
    headers: { 'Content-Type': 'application/json' },
  })
}
