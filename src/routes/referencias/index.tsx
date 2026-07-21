import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'

import type { ReferenceLibraryScope } from '@/components/referencias/ReferenceLibrary'
import type { OrdenBiblioteca } from '@/data/api/documentos.api'
import type { ReferenciasSearch } from '@/types/search'

import { ReferenceLibrary } from '@/components/referencias/ReferenceLibrary'
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
    vista: search.vista === 'curriculum' ? 'curriculum' : 'personal',
    q: typeof search.q === 'string' ? search.q.slice(0, 200) : '',
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

export const Route = createFileRoute('/referencias/')({
  validateSearch: parseReferenciasSearch,
  search: {
    middlewares: [stripSearchParams(defaultReferenciasSearch)],
  },
  loaderDeps: ({ search }) => search,
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
    <ReferenceLibrary
      scope={search.vista}
      query={search.q}
      sort={search.orden}
      activeCollectionId={search.coleccion || null}
      onScopeChange={(scope: ReferenceLibraryScope) => {
        if (scope === 'chat') return
        void navigate({
          search: (previous) => ({
            ...previous,
            vista: scope,
            coleccion: '',
          }),
          resetScroll: false,
        })
      }}
      onQueryChange={(q) => {
        void navigate({
          search: (previous) => ({ ...previous, q }),
          replace: true,
          resetScroll: false,
        })
      }}
      onSortChange={(orden) => {
        void navigate({
          search: (previous) => ({ ...previous, orden }),
          resetScroll: false,
        })
      }}
      onActiveCollectionIdChange={(collectionId, reason) => {
        void navigate({
          search: (previous) => ({
            ...previous,
            coleccion: collectionId ?? '',
          }),
          replace: reason === 'invalid',
          resetScroll: false,
        })
      }}
    />
  )
}
