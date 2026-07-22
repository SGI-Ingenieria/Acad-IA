import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'

import type {
  AsignaturaHistorialGrupo,
  AsignaturaHistorialSearch,
} from '@/types/search'

import { SubjectHistoryPanel } from '@/features/asignaturas/SubjectHistoryPanel'
import {
  ASIGNATURA_HISTORIAL_GRUPOS,
  defaultAsignaturaHistorialSearch,
} from '@/types/search'

const parseGrupos = (value: unknown): Array<AsignaturaHistorialGrupo> => {
  if (!Array.isArray(value)) return [...ASIGNATURA_HISTORIAL_GRUPOS]
  const seleccion = new Set(
    value.filter(
      (v): v is AsignaturaHistorialGrupo =>
        typeof v === 'string' &&
        (ASIGNATURA_HISTORIAL_GRUPOS as ReadonlyArray<string>).includes(v),
    ),
  )
  return ASIGNATURA_HISTORIAL_GRUPOS.filter((grupo) => seleccion.has(grupo))
}

const parseAsignaturaHistorialSearch = (
  search: Record<string, unknown>,
): AsignaturaHistorialSearch => ({
  grupos: parseGrupos(search.grupos),
})

export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId/historial',
)({
  validateSearch: parseAsignaturaHistorialSearch,
  search: {
    middlewares: [stripSearchParams(defaultAsignaturaHistorialSearch)],
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { planId, asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId/historial',
  })
  const { grupos } = useSearch({
    from: '/planes/$planId/asignaturas/$asignaturaId/historial',
  })
  const navigate = useNavigate({
    from: '/planes/$planId/asignaturas/$asignaturaId/historial',
  })

  const handleGruposChange = (next: Array<AsignaturaHistorialGrupo>) => {
    void navigate({
      search: (prev) => ({ ...prev, grupos: next }),
      resetScroll: false,
    })
  }

  return (
    <SubjectHistoryPanel
      planId={planId}
      asignaturaId={asignaturaId}
      grupos={grupos}
      onGruposChange={handleGruposChange}
    />
  )
}
