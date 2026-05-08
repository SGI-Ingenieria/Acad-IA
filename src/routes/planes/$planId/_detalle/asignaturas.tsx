import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import {
  Plus,
  Search,
  Filter,
  ChevronRight,
  BookOpen,
  Loader2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Asignatura, AsignaturaStatus, TipoAsignatura } from '@/types/plan'
import type { Tables } from '@/types/supabase'

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
import { usePlanAsignaturas, usePlanLineas } from '@/data'

// --- Configuración de Estilos ---
const statusConfig: Record<
  AsignaturaStatus,
  { label: string; className: string }
> = {
  generando: {
    label: 'Generando',
    className:
      'bg-slate-100 text-slate-600 animate-pulse [animation-duration:2s]',
  },
  borrador: { label: 'Borrador', className: 'bg-slate-100 text-slate-600' },
  revisada: { label: 'Revisada', className: 'bg-amber-100 text-amber-700' },
  aprobada: { label: 'Aprobada', className: 'bg-emerald-100 text-emerald-700' },
  fallida: { label: 'Fallida', className: 'bg-red-100 text-red-700' },
}

const tipoConfig: Record<TipoAsignatura, { label: string; className: string }> =
  {
    OBLIGATORIA: {
      label: 'Obligatoria',
      className: 'bg-blue-100 text-blue-700',
    },
    OPTATIVA: { label: 'Optativa', className: 'bg-purple-100 text-purple-700' },
    TRONCAL: { label: 'Troncal', className: 'bg-slate-100 text-slate-700' },
    OTRA: { label: 'Otra', className: 'bg-slate-100 text-slate-700' },
  }

// --- Mapeadores de API ---
const mapAsignaturas = (
  asigApi: Array<Tables<'asignaturas'>> = [],
): Array<Asignatura> => {
  return asigApi.map((asig) => ({
    id: asig.id,
    clave: asig.codigo ?? '',
    nombre: asig.nombre,
    creditos: asig.creditos,
    ciclo: asig.numero_ciclo ?? null,
    lineaCurricularId: asig.linea_plan_id ?? null,
    tipo: asig.tipo,
    estado: asig.estado,
    hd: asig.horas_academicas ?? 0,
    hi: asig.horas_independientes ?? 0,
    prerrequisito_asignatura_id: asig.prerrequisito_asignatura_id ?? null,
  }))
}

export const Route = createFileRoute('/planes/$planId/_detalle/asignaturas')({
  component: AsignaturasPage,
})

function AsignaturasPage() {
  const { planId } = Route.useParams()
  const navigate = useNavigate()

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
    () => mapAsignaturas(asignaturaApi),
    [asignaturaApi],
  )
  const lineas = useMemo(() => lineasApi || [], [lineasApi])

  const filteredAsignaturas = asignaturas.filter((m) => {
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

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-foreground text-xl font-bold">
            Asignaturas del Plan
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {asignaturas.length} asignaturas en total •{' '}
            {filteredAsignaturas.length} filtradas
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
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-slate-50 p-4">
        <div className="relative min-w-60 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nombre o clave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="text-muted-foreground mr-1 h-4 w-4" />

          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-35 bg-white">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="obligatoria">Obligatoria</SelectItem>
              <SelectItem value="optativa">Optativa</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-35 bg-white">
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
            <SelectTrigger className="w-45 bg-white">
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
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="w-30 px-6 py-4">Clave</TableHead>
              <TableHead className="px-6 py-4">Nombre</TableHead>
              <TableHead className="px-6 py-4 text-center">Créditos</TableHead>
              <TableHead className="px-6 py-4 text-center">Ciclo</TableHead>
              <TableHead className="px-6 py-4">Línea Curricular</TableHead>
              <TableHead className="px-6 py-4">Tipo</TableHead>
              <TableHead className="px-6 py-4">Estado</TableHead>
              <TableHead className="w-12.5 px-6 py-4"></TableHead>
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
                  className="group cursor-pointer transition-colors hover:bg-slate-50/80"
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
                  <TableCell className="px-6 py-4 font-mono text-xs font-bold text-slate-400">
                    {asignatura.clave}
                  </TableCell>
                  <TableCell className="px-6 py-4 font-semibold text-slate-700">
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
                      <span className="text-slate-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-slate-600">
                    {getLineaNombre(asignatura.lineaCurricularId)}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge
                      variant="outline"
                      className={`capitalize shadow-sm ${tipoConfig[asignatura.tipo].className}`}
                    >
                      {tipoConfig[asignatura.tipo].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge
                      variant="outline"
                      className={`capitalize shadow-sm ${statusConfig[asignatura.estado]?.className}`}
                    >
                      {statusConfig[asignatura.estado]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="opacity-0 transition-opacity group-hover:opacity-100">
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Outlet />
    </div>
  )
}
