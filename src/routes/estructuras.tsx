import { createFileRoute } from '@tanstack/react-router'

import { EstructurasPage } from '@/features/estructuras/EstructurasPage'

type EstructurasSearch = {
  id?: string
  tab?: string
}

function parseSearch(search: Record<string, unknown>): EstructurasSearch {
  return {
    id: typeof search.id === 'string' ? search.id : undefined,
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }
}

export const Route = createFileRoute('/estructuras')({
  validateSearch: parseSearch,
  component: EstructurasPage,
})
