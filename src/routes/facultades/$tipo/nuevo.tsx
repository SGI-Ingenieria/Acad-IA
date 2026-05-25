import { createFileRoute } from '@tanstack/react-router'

import EntidadCrudModal from '@/features/facultades/EntidadCrudModal'

type NuevoFacultadSearch = {
  facultadId?: string
}

export const Route = createFileRoute('/facultades/$tipo/nuevo')({
  validateSearch: (search: Record<string, unknown>): NuevoFacultadSearch => {
    return {
      facultadId:
        typeof search.facultadId === 'string' ? search.facultadId : undefined,
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { tipo } = Route.useParams()
  const search = Route.useSearch()

  return (
    <EntidadCrudModal
      entityType={tipo as 'facultad' | 'carrera'}
      mode="nuevo"
      prefillFacultadId={search.facultadId as string | null | undefined}
    />
  )
}
