import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import {
  Plus,
  Search,
  Filter,
  ChevronRight,
  BookOpen,
  Loader2,
  Archive,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Asignatura } from '@/types/plan'
import type { Tables } from '@/types/supabase'

import { mapAsignaturas } from '@/components/asignaturas/asignaturaMappers'
import {
  asignaturaStatusConfig,
  asignaturaTipoConfig,
} from '@/components/asignaturas/asignaturaTableConfig'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { usePlanAsignaturas, usePlanLineas, useUpdateAsignatura } from '@/data'

export const Route = createFileRoute('/planes/$planId/_detalle/asignaturas')({
  component: AsignaturasPage,
})

function AsignaturasPage() {
  const { planId } = Route.useParams()
  const navigate = useNavigate()
  const [archivingSubject, setArchivingSubject] = useState<Asignatura | null>(
    null,
  )
  const archiveMutation = useUpdateAsignatura()

  // 1. Fetch de datos reales
  const { data: asignaturaApi, isLoading: loadingAsig } =
    usePlanAsignaturas(planId)
  const { data: lineasApi, isLoading: loadingLineas } = usePlanLineas(planId)

  // 2. Estados de filtrado
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTipo, setFilterTipo] = useState<string>('all')
  const [filterEstado, setFilterEstado] = useState<string>('all')
  const [filterLinea, setFilterLinea] = useState<string>('all')

  // 3. Procesamiento de datos
  const asignaturas = useMemo(
    () => mapAsignaturas(asignaturaApi as Array<Tables<'asignaturas'>>),
    [asignaturaApi],
  )
  const visibleAsignaturas = useMemo(
    () => asignaturas.filter((m) => m.estado !== 'archivada'),
    [asignaturas],
  )
  const archivedCount = asignaturas.length - visibleAsignaturas.length
  const lineas = useMemo(() => lineasApi || [], [lineasApi])

  const filteredAsignaturas = visibleAsignaturas.filter((m) => {
    const matchesSearch =
      m.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.clave.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTipo = filterTipo === 'all' || m.tipo === filterTipo
    const matchesEstado = filterEstado === 'all' || m.estado === filterEstado
    const matchesLinea =
      filterLinea === 'all' || m.lineaCurricularId === filterLinea

    return matchesSearch && matchesTipo && matchesEstado && matchesLinea
  })

  const getLineaNombre = (lineaId: string | null) => {
    if (!lineaId) return 'Sin asignar'
    return lineas.find((l: any) => l.id === lineaId)?.nombre || 'Desconocida'
  }

  if (loadingAsig || loadingLineas) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  const handleArchiveConfirm = async () => {
    if (!archivingSubject) return
    await archiveMutation.mutateAsync({
      asignaturaId: archivingSubject.id,
      patch: { estado: 'archivada' },
    })
    setArchivingSubject(null)
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-foreground text-xl font-bold">
            Asignaturas del Plan
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {visibleAsignaturas.length} asignaturas activas •{' '}
            {filteredAsignaturas.length} filtradas
            {archivedCount > 0 ? ` • ${archivedCount} archivadas` : ''}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => {
              console.log('planId desde asignaturas', planId)

              navigate({
                to: `/planes/${planId}/asignaturas/nueva`,
                resetScroll: false,
              })
            }}
            className="shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" /> Nueva Asignatura
          </Button>
        </div>
      </div>

      {/* Barra de Filtros Avanzada */}
      <div className="bg-muted/30 border-border flex flex-wrap items-center gap-3 rounded-xl border p-4">
        <div className="relative min-w-60 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nombre o clave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-background pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="text-muted-foreground mr-1 h-4 w-4" />

          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="bg-background w-35">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="obligatoria">Obligatoria</SelectItem>
              <SelectItem value="optativa">Optativa</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="bg-background w-35">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="revisada">Revisada</SelectItem>
              <SelectItem value="aprobada">Aprobada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterLinea} onValueChange={setFilterLinea}>
            <SelectTrigger className="bg-background w-45">
              <SelectValue placeholder="Línea" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las líneas</SelectItem>
              {lineas.map((linea: any) => (
                <SelectItem key={linea.id} value={linea.id}>
                  {linea.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabla Pro */}
      <div className="bg-background overflow-hidden rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="w-30 px-6 py-4">Clave</TableHead>
              <TableHead className="px-6 py-4">Nombre</TableHead>
              <TableHead className="px-6 py-4 text-center">Créditos</TableHead>
              <TableHead className="px-6 py-4 text-center">Ciclo</TableHead>
              <TableHead className="px-6 py-4">Línea Curricular</TableHead>
              <TableHead className="px-6 py-4">Tipo</TableHead>
              <TableHead className="px-6 py-4">Estado</TableHead>
              <TableHead className="w-12.5 px-6 py-4 text-right">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAsignaturas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 px-6 py-8 text-center">
                  <div className="text-muted-foreground flex flex-col items-center justify-center gap-3">
                    <BookOpen className="h-10 w-10 opacity-20" />
                    <div>
                      <p className="font-medium">
                        No se encontraron asignaturas
                      </p>
                      <p className="mt-1 text-xs">
                        Intenta cambiar los filtros de búsqueda
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
                  <TableCell className="px-6 py-4 text-center font-medium">
                    {asignatura.creditos}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center">
                    {asignatura.ciclo ? (
                      <Badge variant="outline" className="font-normal">
                        Ciclo {asignatura.ciclo}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground px-6 py-4 text-sm">
                    {getLineaNombre(asignatura.lineaCurricularId)}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge
                      variant={asignaturaTipoConfig[asignatura.tipo].variant}
                      className="capitalize shadow-sm"
                    >
                      {asignaturaTipoConfig[asignatura.tipo].label}
                    </Badge>
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
                    <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      {asignatura.estado !== 'archivada' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Archivar asignatura"
                          onClick={(event) => {
                            event.stopPropagation()
                            setArchivingSubject(asignatura)
                          }}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <ChevronRight className="text-muted-foreground h-5 w-5" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialog
        open={Boolean(archivingSubject)}
        onOpenChange={(open) => {
          if (!open) {
            setArchivingSubject(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar asignatura</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a archivar{' '}
              <span className="text-foreground font-semibold">
                {archivingSubject?.nombre}
              </span>
              . Esta asignatura dejará de mostrarse en el plan y solo estará
              disponible en la sección de asignaturas archivadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveConfirm}
              disabled={archiveMutation.isPending}
            >
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Outlet />
    </div>
  )
}
