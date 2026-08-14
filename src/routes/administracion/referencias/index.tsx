import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'

import type { OrdenBiblioteca } from '@/data/api/documentos.api'
import type { ReferenciasSearch } from '@/types/search'

import { BibliotecaPage } from '@/components/referencias/BibliotecaPage'
import { documentos_biblioteca } from '@/data/api/documentos.api'
import { qk } from '@/data/query/keys'
import { defaultReferenciasSearch } from '@/types/search'

const ordenesBiblioteca = new Set<OrdenBiblioteca>([
  'updated_desc',
  'created_desc',
  'used_desc',
  'name_asc',
  'name_desc',
])

export function parseReferenciasSearch(
  search: Record<string, unknown>,
): ReferenciasSearch {
  return {
    q: typeof search.q === 'string' ? search.q.slice(0, 200) : '',
    tab:
      search.tab === 'imagenes' || search.tab === 'archivos'
        ? search.tab
        : 'todo',
    orden:
      typeof search.orden === 'string' &&
      ordenesBiblioteca.has(search.orden as OrdenBiblioteca)
        ? (search.orden as OrdenBiblioteca)
        : defaultReferenciasSearch.orden,
    coleccion:
      typeof search.coleccion === 'string'
        ? search.coleccion.slice(0, 100)
        : '',
  }
}

export const Route = createFileRoute('/administracion/referencias/')({
  validateSearch: parseReferenciasSearch,
  search: {
    middlewares: [stripSearchParams(defaultReferenciasSearch)],
  },
  loaderDeps: ({ search }) => ({ orden: search.orden }),
  loader: ({ context, deps }) => {
    const filters = { query: '', sort: deps.orden }
    void context.queryClient.prefetchQuery({
      queryKey: qk.bibliotecaReferencias(filters),
      queryFn: () => documentos_biblioteca(filters),
      staleTime: 30_000,
    })
  },
  component: ReferenciasIndex,
})

function ReferenciasIndex() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <BibliotecaPage
      search={search}
      onSearchChange={(patch, options) => {
        void navigate({
          search: (previous) => ({ ...previous, ...patch }),
          replace: options?.replace ?? false,
          resetScroll: false,
        })
      }}
    />
  )
}
