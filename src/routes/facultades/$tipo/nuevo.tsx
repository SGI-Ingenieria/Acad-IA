import { createFileRoute } from '@tanstack/react-router'

import {
  requireAcademicCatalogEditor,
  requireAnyPermission,
} from '@/data/auth/routeGuards'
import EntidadCrudModal from '@/features/facultades/EntidadCrudModal'

type NuevoFacultadSearch = {
  facultadId?: string
}

export const Route = createFileRoute('/facultades/$tipo/nuevo')({
  beforeLoad: ({ context, params }) =>
    params.tipo === 'facultad'
      ? requireAnyPermission(context.queryClient, ['catalogos.gestionar'])
      : requireAcademicCatalogEditor(context.queryClient),
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
      prefillFacultadId={search.facultadId}
    />
  )
}
