import { useStore } from '@tanstack/react-form'
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { CheckCircle2, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useDebounce } from 'use-debounce'

import type { NuevaAsignaturaFormValues } from '@/features/asignaturas/nueva/types'
import type { AnyFieldMeta } from '@tanstack/react-form'

import { withForm } from '@/components/form'
import Pagination03 from '@/components/shadcn-studio/pagination/pagination-03'
import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  subjectOptions,
  supabaseBrowser,
  useCatalogosPlanes,
  usePlanes,
} from '@/data'
import {
  asignaturaFuenteSchema,
  nuevaAsignaturaFormOpts,
  primerError,
} from '@/features/asignaturas/nueva/schema'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

const ALL = '__all__'

const fieldInvalid = (meta: AnyFieldMeta): boolean =>
  meta.isTouched && !meta.isValid

export const PasoFuenteClonadoInterno = withForm({
  ...nuevaAsignaturaFormOpts,
  render: function Render({ form }) {
    const pageSize = 20
    const qc = useQueryClient()

    const clonInterno = useStore(form.store, (s) => s.values.clonInterno)

    const facultadId = clonInterno.facultadId
    const carreraId = clonInterno.carreraId
    const planOrigenId = clonInterno.planOrigenId
    const search = clonInterno.search
    const page = Math.max(1, clonInterno.page)

    const [debouncedSearch] = useDebounce(search, 350)

    const { data: catalogos } = useCatalogosPlanes()

    const carrerasOptions = useMemo(() => {
      const raw = catalogos?.carreras ?? []
      return facultadId ? raw.filter((c) => c.facultad_id === facultadId) : raw
    }, [catalogos?.carreras, facultadId])

    const carrerasPorNivel = useMemo(() => {
      const groups = new Map<string, typeof carrerasOptions>()
      carrerasOptions.forEach((carrera) => {
        const nivel = String(carrera.nivel).trim() || 'Otro'
        const current = groups.get(nivel) ?? []
        current.push(carrera)
        groups.set(nivel, current)
      })
      return Array.from(groups.entries()).map(([nivel, carreras]) => ({
        nivel,
        carreras,
      }))
    }, [carrerasOptions])

    const planesQuery = usePlanes({
      search: '',
      facultadId: facultadId ?? 'todas',
      carreraId: carreraId ?? 'todas',
      estadoId: 'todos',
      limit: 500,
      offset: 0,
    })

    const needPlansForFilter = Boolean(
      (facultadId || carreraId) && !planOrigenId,
    )
    const plansForFilter = planesQuery.data?.data ?? []

    const { data: subjectsPaged, isLoading: subjectsLoading } = useQuery({
      queryKey: [
        'asignaturas',
        'clone-source',
        {
          facultadId,
          carreraId,
          planOrigenId,
          search: debouncedSearch,
          page,
          pageSize,
          planIdsKey: needPlansForFilter
            ? plansForFilter.map((p) => p.id).join(',')
            : null,
        },
      ],
      enabled: !needPlansForFilter || !planesQuery.isLoading,
      placeholderData: keepPreviousData,
      queryFn: async () => {
        const supabase = supabaseBrowser()
        const from = (page - 1) * pageSize
        const term = debouncedSearch.trim()

        // Una sola llamada limpia. RPC maneja tanto búsqueda vacía como llena.
        const { data, error } = await supabase.rpc('search_asignaturas', {
          p_search: term,
          p_facultad_id: facultadId ?? undefined, // Corrección TS 2322
          p_carrera_id: carreraId ?? undefined, // Corrección TS 2322
          p_plan_estudio_id: planOrigenId ?? undefined, // Corrección TS 2322
          p_limit: pageSize,
          p_offset: from,
        })

        if (error) throw new Error(error.message)

        // Extraemos el conteo total de la primera fila.
        // ESLint feliz: "data" ya no puede ser null a este punto.
        const count = data.length > 0 ? Number(data[0].total_count) : 0

        return {
          // ESLint feliz: map directo sobre data
          data: data.map((r) => ({
            id: r.id,
            nombre: r.nombre,
            codigo: r.codigo,
            creditos: Number(r.creditos),
            tipo: r.tipo,
            plan_estudio_id: r.plan_estudio_id,
            estructura_id: '',
            rank: r.rank,
          })),
          count,
        }
      },
    })

    const subjects = subjectsPaged?.data ?? []
    const total = subjectsPaged?.count ?? 0
    const pageCount = Math.max(1, Math.ceil(total / pageSize))

    // Sincronización con datos del servidor (no es copia query→form): si los
    // resultados encogen y la página actual queda fuera de rango, se ajusta
    // para que la query se relance con una página válida.
    useEffect(() => {
      if (page > pageCount) {
        form.setFieldValue('clonInterno.page', pageCount)
      }
    }, [form, page, pageCount])

    const patchClonInterno = (
      patch: Partial<NuevaAsignaturaFormValues['clonInterno']>,
    ) =>
      form.setFieldValue('clonInterno', {
        ...form.getFieldValue('clonInterno'),
        ...patch,
      })

    /**
     * Acción explícita de selección de fuente (sustituye al useEffect que
     * copiaba la asignatura fuente al estado del wizard): fija el id y copia
     * los datos básicos de la fuente al form en el propio handler.
     */
    const seleccionarFuente = async (id: string) => {
      patchClonInterno({ asignaturaOrigenId: id })

      try {
        const fuente = await qc.ensureQueryData(subjectOptions(id))

        // Selección superada por otra más reciente: no pisar la intención.
        if (form.getFieldValue('clonInterno.asignaturaOrigenId') !== id) return

        form.setFieldValue('datosBasicos', {
          ...form.getFieldValue('datosBasicos'),
          nombre: fuente.nombre,
          codigo: fuente.codigo ?? '',
          tipo: fuente.tipo,
          creditos: fuente.creditos,
          horasAcademicas: (fuente as any).horas_academicas ?? null,
          horasIndependientes: (fuente as any).horas_independientes ?? null,
        })
      } catch {
        notify.error(
          'No se pudieron cargar los datos de la asignatura fuente. Intenta seleccionarla de nuevo.',
        )
      }
    }

    const hasAnyFilter = Boolean(
      facultadId || carreraId || planOrigenId || search.trim().length,
    )

    const clearDisabled = !hasAnyFilter

    return (
      <div className="gap-grupo grid">
        <Card className="gap-grupo">
          <CardHeader>
            <CardTitle className="text-base">Fuente</CardTitle>
          </CardHeader>
          <CardContent className="gap-grupo grid">
            <div className="gap-control grid sm:grid-cols-3">
              <div className="gap-micro grid">
                <Label>Facultad</Label>
                <Select
                  value={facultadId ?? ALL}
                  onValueChange={(val) => {
                    const next = val === ALL ? null : val
                    patchClonInterno({
                      facultadId: next,
                      carreraId: null,
                      planOrigenId: null,
                      page: 1,
                      asignaturaOrigenId: null,
                    })
                  }}
                >
                  <SelectTrigger className="w-full min-w-0 [&>span]:block! [&>span]:truncate!">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {(catalogos?.facultades ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id} textValue={f.nombre}>
                        <span className="gap-relacionado flex items-center">
                          <FacultadIconPill facultad={f} />
                          {f.nombre}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="gap-micro grid">
                <Label>Carrera</Label>
                <Select
                  value={carreraId ?? ALL}
                  onValueChange={(val) => {
                    const next = val === ALL ? null : val
                    patchClonInterno({
                      carreraId: next,
                      planOrigenId: null,
                      page: 1,
                      asignaturaOrigenId: null,
                    })
                  }}
                  disabled={!facultadId}
                >
                  <SelectTrigger className="w-full min-w-0 [&>span]:block! [&>span]:truncate!">
                    <SelectValue
                      placeholder={facultadId ? 'Todas' : 'Selecciona facultad'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {carrerasPorNivel.map((grupo) => (
                      <SelectGroup key={grupo.nivel}>
                        <SelectLabel>{grupo.nivel}</SelectLabel>
                        {grupo.carreras.map((carrera) => (
                          <SelectItem key={carrera.id} value={carrera.id}>
                            {carrera.nombre}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="gap-micro grid">
                <Label>Plan</Label>
                <Select
                  value={planOrigenId ?? ALL}
                  onValueChange={(val) => {
                    const next = val === ALL ? null : val
                    patchClonInterno({
                      planOrigenId: next,
                      page: 1,
                      asignaturaOrigenId: null,
                    })
                  }}
                >
                  <SelectTrigger
                    className="w-full min-w-0 [&>span]:block! [&>span]:truncate!"
                    disabled={!carreraId && !facultadId}
                  >
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {(planesQuery.data?.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="gap-control grid sm:grid-cols-[1fr_auto]">
              <div className="gap-micro grid">
                <Label>Buscar</Label>
                <Input
                  placeholder="Nombre o código..."
                  value={search}
                  onChange={(e) =>
                    patchClonInterno({ search: e.target.value, page: 1 })
                  }
                />
              </div>
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    patchClonInterno({
                      facultadId: null,
                      carreraId: null,
                      planOrigenId: null,
                      search: '',
                      page: 1,
                      asignaturaOrigenId: null,
                    })
                  }}
                  disabled={clearDisabled}
                >
                  <X className="mr-relacionado h-4 w-4" />
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <form.AppField
          name="clonInterno.asignaturaOrigenId"
          validators={{
            onChange: ({ value }) => primerError(asignaturaFuenteSchema, value),
          }}
        >
          {(field) => {
            const selectedId = field.state.value
            const invalid = fieldInvalid(field.state.meta)

            return (
              <div className="gap-relacionado grid">
                <div className="text-muted-foreground text-xs">
                  Selecciona una asignatura fuente (solo una).
                </div>

                {invalid ? (
                  <p className="text-destructive text-sm" role="alert">
                    {typeof field.state.meta.errors[0] === 'string'
                      ? field.state.meta.errors[0]
                      : 'Selecciona una asignatura fuente.'}
                  </p>
                ) : null}

                <div className="gap-relacionado px-micro grid max-h-80 overflow-y-auto">
                  {subjectsLoading ? (
                    <div className="text-muted-foreground text-sm">
                      Cargando asignaturas…
                    </div>
                  ) : subjects.length === 0 ? (
                    <div className="text-muted-foreground text-sm">
                      No hay asignaturas con esos filtros.
                    </div>
                  ) : (
                    subjects.map((m) => {
                      const active = String(selectedId) === String(m.id)
                      return (
                        <label
                          key={m.id}
                          className={cn(
                            'hover:bg-accent p-control flex cursor-pointer items-center justify-between rounded-md border text-left',
                            active &&
                              'border-primary bg-primary/5 ring-primary ring-1',
                          )}
                        >
                          <input
                            className="sr-only"
                            type="radio"
                            name="asignaturaFuente"
                            checked={active}
                            onChange={() => void seleccionarFuente(m.id)}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {m.nombre}
                            </div>
                            <div className="text-muted-foreground mt-micro text-xs">
                              {(m.codigo ? m.codigo : '—') +
                                ' • ' +
                                String(m.creditos) +
                                ' créditos'}
                            </div>
                          </div>
                          {active ? (
                            <CheckCircle2 className="text-primary h-5 w-5 flex-none" />
                          ) : (
                            <span className="h-5 w-5 flex-none" aria-hidden />
                          )}
                        </label>
                      )
                    })
                  )}
                </div>

                {pageCount > 1 ? (
                  <Pagination03
                    page={page}
                    pageCount={pageCount}
                    onPageChange={(nextPage) =>
                      patchClonInterno({ page: nextPage })
                    }
                  />
                ) : null}
              </div>
            )
          }}
        </form.AppField>
      </div>
    )
  },
})
