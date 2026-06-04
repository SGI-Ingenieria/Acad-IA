import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { Archive, BookOpen, ChevronRight, Loader2 } from 'lucide-react'
import { useMemo } from 'react'

import type { Asignatura } from '@/types/plan'
import type { ArchivadasSearch } from '@/types/search'

import { mapAsignaturaRow } from '@/components/asignaturas/asignaturaMappers'
import {
  asignaturaStatusConfig,
  asignaturaTipoConfig,
} from '@/components/asignaturas/asignaturaTableConfig'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useArchivedSubjects } from '@/data'
import { usePlan } from '@/data/hooks/usePlans'
import { archivedSubjectsOptions } from '@/data/query/queryOptions'
import {
  defaultArchivadasSearch,
  defaultAsignaturasSearch,
} from '@/types/search'

const parseArchivadasSearch = (
  search: Record<string, unknown>,
): ArchivadasSearch => ({
  q: typeof search.q === 'string' ? search.q : defaultArchivadasSearch.q,
  tipo:
    typeof search.tipo === 'string'
      ? search.tipo
      : defaultArchivadasSearch.tipo,
})

export const Route = createFileRoute('/planes/$planId/asignaturas/archivadas')({
  validateSearch: parseArchivadasSearch,
  search: {
    middlewares: [stripSearchParams(defaultArchivadasSearch)],
  },
  loader: async ({ context: { queryClient }, params: { planId } }) => {
    await queryClient.prefetchQuery(archivedSubjectsOptions(planId))
  },
  component: ArchivedSubjectsPage,
})

function ArchivedSubjectsPage() {
  const { planId } = Route.useParams()
  const { q, tipo } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: planData } = usePlan(planId)
  const { data, isLoading } = useArchivedSubjects(planId)

  const archivedAsignaturas = useMemo<Array<Asignatura>>(() => {
    return (data ?? []).map((row) => mapAsignaturaRow(row))
  }, [data])

  const filteredAsignaturas = archivedAsignaturas.filter((m) => {
    const matchesSearch =
      m.nombre.toLowerCase().includes(q.toLowerCase()) ||
      m.clave.toLowerCase().includes(q.toLowerCase())
    const matchesTipo = tipo === 'all' || m.tipo === tipo
    return matchesSearch && matchesTipo
  })

  return (
    <main className="bg-background min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-primary bg-primary/10 rounded-lg p-2">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-foreground text-3xl font-bold">
                Asignaturas archivadas
              </h1>
              <p className="text-muted-foreground text-sm">
                {planData?.nombre ? `Plan: ${planData.nombre} • ` : ''}
                {archivedAsignaturas.length} asignaturas en archivo •{' '}
                {filteredAsignaturas.length} filtradas
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: '/planes/$planId/asignaturas',
                params: { planId },
                search: defaultAsignaturasSearch,
                resetScroll: false,
              })
            }
          >
            Volver a asignaturas
          </Button>
        </div>

        <div className="bg-muted/30 border-border flex flex-wrap items-center gap-3 rounded-xl border p-4">
          <div className="relative min-w-60 flex-1">
            <Input
              placeholder="Buscar por nombre o clave..."
              value={q}
              onChange={(event) =>
                navigate({
                  search: (prev) => ({ ...prev, q: event.target.value }),
                  replace: true,
                  resetScroll: false,
                })
              }
              className="bg-background"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={tipo}
              onValueChange={(v) =>
                navigate({
                  search: (prev) => ({ ...prev, tipo: v }),
                  resetScroll: false,
                })
              }
            >
              <SelectTrigger className="bg-background w-35">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="OBLIGATORIA">Obligatoria</SelectItem>
                <SelectItem value="OPTATIVA">Optativa</SelectItem>
                <SelectItem value="TRONCAL">Troncal</SelectItem>
                <SelectItem value="OTRA">Otra</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-background overflow-hidden rounded-xl border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                <TableHead className="w-30 px-6 py-4">Clave</TableHead>
                <TableHead className="px-6 py-4">Nombre</TableHead>
                <TableHead className="px-6 py-4">Tipo</TableHead>
                <TableHead className="px-6 py-4 text-center">
                  Créditos
                </TableHead>
                <TableHead className="px-6 py-4">Estado</TableHead>
                <TableHead className="w-12.5 px-6 py-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 px-6 py-8 text-center">
                    <div className="text-muted-foreground flex items-center justify-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Cargando asignaturas archivadas...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredAsignaturas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 px-6 py-8 text-center">
                    <div className="text-muted-foreground flex flex-col items-center justify-center gap-3">
                      <BookOpen className="h-10 w-10 opacity-20" />
                      <div>
                        <p className="font-medium">
                          No hay asignaturas archivadas
                        </p>
                        <p className="mt-1 text-xs">
                          Cuando archives una asignatura aparecerá aquí
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAsignaturas.map((asignatura) => (
                  <TableRow
                    key={asignatura.id}
                    className="group hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() =>
                      navigate({
                        to: '/planes/$planId/asignaturas/$asignaturaId',
                        params: {
                          planId,
                          asignaturaId: asignatura.id,
                        },
                        state: {
                          realId: asignatura.id,
                          asignaturaId: asignatura.id,
                        } as any,
                      })
                    }
                  >
                    <TableCell className="text-muted-foreground px-6 py-4 font-mono text-xs font-bold">
                      {asignatura.clave}
                    </TableCell>
                    <TableCell className="text-foreground px-6 py-4 font-semibold">
                      {asignatura.nombre}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge
                        variant={asignaturaTipoConfig[asignatura.tipo].variant}
                        className="capitalize shadow-sm"
                      >
                        {asignaturaTipoConfig[asignatura.tipo].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center font-medium">
                      {asignatura.creditos}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge
                        variant={
                          asignaturaStatusConfig[asignatura.estado].variant
                        }
                        className={`capitalize shadow-sm ${asignaturaStatusConfig[asignatura.estado].className ?? ''}`}
                      >
                        {asignaturaStatusConfig[asignatura.estado].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="opacity-0 transition-opacity group-hover:opacity-100">
                        <ChevronRight className="text-muted-foreground h-5 w-5" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  )
}
