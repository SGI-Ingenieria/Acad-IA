import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import type {
  AsignaturaHistorialGrupo,
  AsignaturaHistorialSearch,
} from '@/types/search'

import { HistorialTab } from '@/components/asignaturas/detalle/HistorialTab'
import {
  ASIGNATURA_HISTORIAL_GRUPOS,
  defaultAsignaturaHistorialSearch,
} from '@/types/search'

// Normaliza el param `grupos` al orden canónico: así una selección completa
// coincide (igualdad profunda) con el default y stripSearchParams la retira.
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
  return <HistorialTab />
}
