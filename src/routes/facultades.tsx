import { createFileRoute } from '@tanstack/react-router'
import {
  Building2,
  CircleOff,
  Layers3,
  Search,
  School2,
  Shapes,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { facultades_list, carreras_list, qk } from '@/data'
import { getIconByName } from '@/features/planes/utils/icon-utils'

type FacultadCatalogo = Awaited<ReturnType<typeof facultades_list>>[number]
type CarreraCatalogo = Awaited<ReturnType<typeof carreras_list>>[number] & {
  nivel?: string | null
  facultades?: FacultadCatalogo | null
}

type FacultadesLoaderData = {
  facultades: Array<FacultadCatalogo>
  carreras: Array<CarreraCatalogo>
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const NIVEL_ORDEN = [
  'Licenciatura',
  'Maestría',
  'Especialidad',
  'Doctorado',
  'Otro',
]

const getNivelEtiqueta = (nivel?: string | null) => {
  const normalized = String(nivel ?? '').trim()
  return normalized || 'Otro'
}

export const Route = createFileRoute('/facultades')({
  loader: async ({ context }) => {
    const [facultades, carreras] = await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: qk.facultades(),
        queryFn: facultades_list,
        staleTime: 1000 * 60 * 60,
      }),
      context.queryClient.ensureQueryData({
        queryKey: qk.carreras(),
        queryFn: () => carreras_list(),
        staleTime: 1000 * 60 * 60,
      }),
    ])

    return { facultades, carreras }
  },
  preload: true,
  component: RouteComponent,
})

function RouteComponent() {
  const { facultades, carreras }: FacultadesLoaderData = Route.useLoaderData()
  const [searchTerm, setSearchTerm] = useState('')
  const [facultadSeleccionada, setFacultadSeleccionada] = useState('todas')

  const carrerasPorFacultad = useMemo(() => {
    return carreras.reduce<Map<string, number>>((acc, carrera) => {
      const key = carrera.facultad_id ?? 'sin-facultad'
      acc.set(key, (acc.get(key) ?? 0) + 1)
      return acc
    }, new Map())
  }, [carreras])

  const facultadActiva =
    facultadSeleccionada === 'todas'
      ? null
      : (facultades.find((item) => item.id === facultadSeleccionada) ?? null)

  const filteredFacultades = useMemo(() => {
    const term = normalizeText(searchTerm.trim())

    if (!term) return facultades

    return facultades.filter((facultad) => {
      const haystack = normalizeText(
        [facultad.nombre, facultad.nombre_corto].filter(Boolean).join(' '),
      )

      return haystack.includes(term)
    })
  }, [facultades, searchTerm])

  const filteredCarreras = useMemo(() => {
    const term = normalizeText(searchTerm.trim())

    return carreras.filter((carrera) => {
      const perteneceAFacultad =
        facultadSeleccionada === 'todas' ||
        carrera.facultad_id === facultadSeleccionada

      if (!perteneceAFacultad) return false

      if (!term) return true

      const haystack = normalizeText(
        [
          carrera.nombre,
          carrera.nombre_corto,
          carrera.clave_sep,
          carrera.facultades?.nombre,
          carrera.facultades?.nombre_corto,
        ]
          .filter(Boolean)
          .join(' '),
      )

      return haystack.includes(term)
    })
  }, [carreras, facultadSeleccionada, searchTerm])

  const carrerasPorNivel = useMemo(() => {
    const groups = new Map<string, Array<CarreraCatalogo>>()

    filteredCarreras.forEach((carrera) => {
      const nivel = getNivelEtiqueta(carrera.nivel)
      const current = groups.get(nivel) ?? []
      current.push(carrera)
      groups.set(nivel, current)
    })

    return Array.from(groups.entries()).sort(([nivelA], [nivelB]) => {
      const indexA = NIVEL_ORDEN.indexOf(nivelA)
      const indexB = NIVEL_ORDEN.indexOf(nivelB)

      if (indexA === -1 && indexB === -1) return nivelA.localeCompare(nivelB)
      if (indexA === -1) return 1
      if (indexB === -1) return -1

      return indexA - indexB
    })
  }, [filteredCarreras])

  const totalFacultades = facultades.length
  const totalCarreras = carreras.length
  const carrerasActivas = carreras.filter((carrera) => carrera.activa).length
  const carrerasFiltradasActivas = filteredCarreras.filter(
    (carrera) => carrera.activa,
  ).length
  const nivelesVisibles = carrerasPorNivel.length

  const clearFilters = () => {
    setSearchTerm('')
    setFacultadSeleccionada('todas')
  }

  const hasFilters =
    searchTerm.trim() !== '' || facultadSeleccionada !== 'todas'

  return (
    <main className="bg-background relative min-h-screen w-full overflow-hidden">
      <div className="from-primary/10 via-background absolute inset-x-0 top-0 -z-10 h-56 bg-linear-to-b to-transparent" />
      <div className="bg-primary/10 absolute top-10 left-8 -z-10 h-36 w-36 rounded-full blur-3xl" />
      <div className="bg-foreground/5 absolute right-0 bottom-0 -z-10 h-60 w-60 rounded-full blur-3xl" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <section className="bg-card/80 flex flex-col gap-5 rounded-3xl border p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-3xl items-start gap-4">
              <div className="bg-primary/10 text-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border">
                <Building2 className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-foreground text-3xl font-bold tracking-tight">
                    Facultades y carreras
                  </h1>
                  <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium">
                    <Sparkles className="h-3.5 w-3.5" />
                    Catálogo institucional
                  </span>
                </div>
                <p className="text-muted-foreground max-w-2xl text-sm leading-6">
                  Revisa la estructura académica, filtra carreras por facultad y
                  navega rápidamente entre las entidades registradas.
                </p>
              </div>
            </div>

            <div className="text-muted-foreground flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary" className="gap-1.5">
                <School2 className="h-3.5 w-3.5" />
                {totalFacultades} facultades
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Layers3 className="h-3.5 w-3.5" />
                {totalCarreras} carreras
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <CircleOff className="h-3.5 w-3.5" />
                {carrerasActivas} activas
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Layers3 className="h-3.5 w-3.5" />
                {nivelesVisibles} niveles
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 bg-background/70 p-4 shadow-none">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Facultades
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-foreground text-3xl font-semibold">
                    {totalFacultades}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Catálogo disponible en memoria
                  </p>
                </div>
                <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-2xl">
                  <School2 className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="border-border/60 bg-background/70 p-4 shadow-none">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Carreras
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-foreground text-3xl font-semibold">
                    {totalCarreras}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {carrerasActivas} habilitadas para gestión ·{' '}
                    {nivelesVisibles} niveles visibles
                  </p>
                </div>
                <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-2xl">
                  <Shapes className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="border-border/60 bg-background/70 p-4 shadow-none">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Filtro actual
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-foreground text-xl font-semibold">
                    {facultadActiva?.nombre ?? 'Todas las facultades'}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {filteredCarreras.length} carreras visibles
                    {hasFilters ? `, ${carrerasFiltradasActivas} activas` : ''}
                  </p>
                </div>
                <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-2xl">
                  <Search className="h-5 w-5" />
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative max-w-xl flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar facultades o carreras por nombre, clave o abreviatura"
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={clearFilters}
                disabled={!hasFilters}
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="overflow-hidden border shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-foreground text-lg font-semibold">
                Facultades
              </h2>
              <p className="text-muted-foreground text-sm">
                Selecciona una facultad para ver sus carreras.
              </p>
            </div>

            <div className="max-h-160 space-y-3 overflow-auto p-4">
              <button
                type="button"
                onClick={() => setFacultadSeleccionada('todas')}
                className={`border-border/60 bg-background flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  facultadSeleccionada === 'todas'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : ''
                }`}
              >
                <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-xl">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-foreground truncate font-semibold">
                      Todas las facultades
                    </p>
                    <Badge variant="outline">{totalFacultades}</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Vista global del catálogo
                  </p>
                </div>
              </button>

              {filteredFacultades.map((facultad) => {
                const Icono = getIconByName(facultad.icono ?? null)
                const carreraCount = carrerasPorFacultad.get(facultad.id) ?? 0
                const isSelected = facultadSeleccionada === facultad.id

                return (
                  <button
                    type="button"
                    key={facultad.id}
                    onClick={() => setFacultadSeleccionada(facultad.id)}
                    className={`border-border/60 bg-background flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      isSelected ? 'border-primary bg-primary/5 shadow-sm' : ''
                    }`}
                  >
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: facultad.color
                          ? `${facultad.color}1A`
                          : undefined,
                        color: facultad.color ?? undefined,
                      }}
                    >
                      <Icono className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-foreground truncate font-semibold">
                          {facultad.nombre}
                        </p>
                        <Badge variant="outline">{carreraCount}</Badge>
                      </div>
                      <p className="text-muted-foreground truncate text-sm">
                        {facultad.nombre_corto ?? 'Sin nombre corto'}
                      </p>
                    </div>
                  </button>
                )
              })}

              {filteredFacultades.length === 0 && (
                <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-8 text-center">
                  <School2 className="h-10 w-10" />
                  <p className="font-medium">No hay facultades que coincidan</p>
                  <p className="text-sm">
                    Prueba con otro término de búsqueda.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden border shadow-sm">
            <div className="flex flex-col gap-4 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-foreground text-lg font-semibold">
                  Carreras
                </h2>
                <p className="text-muted-foreground text-sm">
                  {facultadActiva?.nombre ?? 'Todas las facultades'} ·{' '}
                  {filteredCarreras.length} resultados
                </p>
              </div>
              <Badge variant="secondary" className="self-start">
                {carrerasFiltradasActivas} activas
              </Badge>
            </div>

            {filteredCarreras.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                <CircleOff className="text-muted-foreground h-12 w-12" />
                <div>
                  <h3 className="text-foreground text-base font-semibold">
                    No hay carreras para mostrar
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Ajusta la búsqueda o cambia la facultad seleccionada.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 p-4">
                {carrerasPorNivel.map(([nivel, carrerasDelNivel]) => {
                  const activasDelNivel = carrerasDelNivel.filter(
                    (carrera) => carrera.activa,
                  ).length

                  return (
                    <section
                      key={nivel}
                      className="overflow-hidden rounded-2xl border"
                    >
                      <div className="bg-muted/40 flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-foreground font-semibold">
                            {nivel}
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            {carrerasDelNivel.length} carreras ·{' '}
                            {activasDelNivel} activas
                          </p>
                        </div>
                        <Badge variant="outline">Nivel</Badge>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Carrera</TableHead>
                            <TableHead>Clave</TableHead>
                            <TableHead>Facultad</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {carrerasDelNivel.map((carrera) => (
                            <TableRow key={carrera.id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col gap-1">
                                  <span className="text-foreground">
                                    {carrera.nombre}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    {carrera.nombre_corto ?? 'Sin nombre corto'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {carrera.clave_sep ?? carrera.id.slice(0, 8)}
                              </TableCell>
                              <TableCell>
                                {carrera.facultades?.nombre ?? 'Sin facultad'}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    carrera.activa ? 'default' : 'outline'
                                  }
                                >
                                  {carrera.activa ? 'Activa' : 'Inactiva'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </section>
                  )
                })}
              </div>
            )}
          </Card>
        </section>
      </div>
    </main>
  )
}
