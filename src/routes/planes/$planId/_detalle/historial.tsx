import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'

import type { PlanHistorySearch } from '@/features/planes/PlanHistoryPanel'
import type { HistorialPlanGrupo, HistorialSearch } from '@/types/search'

import { planHistorialOptions } from '@/data/query/queryOptions'
import { PlanHistoryPanel } from '@/features/planes/PlanHistoryPanel'
import { defaultHistorialSearch, HISTORIAL_PLAN_GRUPOS } from '@/types/search'

const parseGrupos = (value: unknown): Array<HistorialPlanGrupo> => {
  if (!Array.isArray(value)) return [...HISTORIAL_PLAN_GRUPOS]
  const seleccion = new Set(
    value.filter(
      (v): v is HistorialPlanGrupo =>
        typeof v === 'string' &&
        (HISTORIAL_PLAN_GRUPOS as ReadonlyArray<string>).includes(v),
    ),
  )
  return HISTORIAL_PLAN_GRUPOS.filter((grupo) => seleccion.has(grupo))
}

const parseHistorialSearch = (
  search: Record<string, unknown>,
): HistorialSearch => {
  const raw =
    typeof search.page === 'number' || typeof search.page === 'string'
      ? Number(search.page)
      : 0
  const page = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0
  return {
    page,
    grupos: parseGrupos(search.grupos),
    q: typeof search.q === 'string' ? search.q : '',
    orden: search.orden === 'antiguo' ? 'antiguo' : 'reciente',
  }
}

export const Route = createFileRoute('/planes/$planId/_detalle/historial')({
  validateSearch: parseHistorialSearch,
  search: {
    middlewares: [stripSearchParams(defaultHistorialSearch)],
  },
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ context: { queryClient }, params: { planId }, deps }) => {
    void queryClient.prefetchQuery(planHistorialOptions(planId, deps.page))
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { planId } = Route.useParams()
  const { page, grupos, q, orden } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const handleChange = (next: Partial<PlanHistorySearch>) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...next,
      }),
      resetScroll: false,
    })
  }

  return (
    <PlanHistoryPanel
      planId={planId}
      page={page}
      grupos={grupos}
      q={q}
      orden={orden}
      onChange={handleChange}
    />
  )
}
