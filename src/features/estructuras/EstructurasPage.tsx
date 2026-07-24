import {
  Outlet,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Layers,
  LayoutTemplate,
  Loader2,
  Plus,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { EstructuraFormModal } from './EstructuraFormModal'

import type { EstructuraAsignatura, EstructuraPlan } from './types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ListFilterSection,
  ListFiltersDialog,
  ListSortMenu,
  ListToolbar,
} from '@/components/ui/list-controls'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useEstructurasAsignatura, useEstructurasPlan } from '@/data'
import { usePermissions } from '@/data/hooks/usePermissions'
import { cn } from '@/lib/utils'

type Modo = 'planes' | 'materias'
type Tipo = 'CURRICULAR' | 'NO_CURRICULAR'
type Estructura = EstructuraPlan | EstructuraAsignatura

/* ── Segmented control (shared by modo + tipo for visual cohesion) ── */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>
  size?: 'sm' | 'md'
}) {
  return (
    <div className="bg-muted inline-flex items-center rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function EstructurasPage() {
  const { has } = usePermissions()
  const navigate = useNavigate({ from: '/administracion/estructuras/$modo/{-$id}' })
  const params = useParams({ from: '/administracion/estructuras/$modo/{-$id}' })
  const search = useSearch({ from: '/administracion/estructuras/$modo/{-$id}' })
  const modo = params.modo as Modo
  const selectedId = params.id
  const tipo = search.tipo
  const q = search.q ?? ''
  const orden = search.orden ?? 'nombre_asc'

  const [createOpen, setCreateOpen] = useState(false)
  const canManageCatalogos = has('catalogos.gestionar')

  const { data: planesRaw = [], isLoading: loadingPlanes } =
    useEstructurasPlan()
  const { data: materiasRaw = [], isLoading: loadingMaterias } =
    useEstructurasAsignatura()

  const isLoading = modo === 'planes' ? loadingPlanes : loadingMaterias
  const raw: Array<Estructura> = useMemo(
    () => (modo === 'planes' ? planesRaw : materiasRaw),
    [modo, planesRaw, materiasRaw],
  )

  // List honours the tipo filter + search; defaults to CURRICULAR only.
  const items = useMemo(() => {
    const norm = q.trim().toLowerCase()
    return raw
      .filter((e) => {
        if ((e.tipo ?? 'CURRICULAR') !== tipo) return false
        if (norm && !e.nombre.toLowerCase().includes(norm)) return false
        return true
      })
      .sort((left, right) => {
        if (orden === 'nombre_desc')
          return right.nombre.localeCompare(left.nombre, 'es')
        if (orden === 'actualizado_desc') {
          const leftDate = String(
            (left as EstructuraPlan & { actualizado_en?: string | null })
              .actualizado_en,
          )
          const rightDate = String(
            (right as EstructuraPlan & { actualizado_en?: string | null })
              .actualizado_en,
          )
          return rightDate.localeCompare(leftDate)
        }
        return left.nombre.localeCompare(right.nombre, 'es')
      })
  }, [orden, q, raw, tipo])

  const goTo = (next: { modo?: Modo; id?: string }) =>
    void navigate({
      to: '/administracion/estructuras/$modo/{-$id}',
      params: { modo: next.modo ?? modo, id: next.id },
      search,
    })

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="border-border/60 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary rounded-xl p-2">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-foreground text-xl font-bold tracking-tight">
                Estructuras y plantillas
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Segmented<Modo>
              value={modo}
              onChange={(next) => goTo({ modo: next, id: undefined })}
              options={[
                {
                  value: 'planes',
                  label: 'Planes',
                  icon: <LayoutTemplate className="h-3.5 w-3.5" />,
                },
                {
                  value: 'materias',
                  label: 'Materias',
                  icon: <BookOpen className="h-3.5 w-3.5" />,
                },
              ]}
            />
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + detail ── */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden">
        {/* Sidebar — full width on mobile; hidden there once an item is open */}
        <aside
          className={cn(
            'border-border/60 w-full flex-col border-r md:flex md:w-72 md:shrink-0',
            selectedId ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="space-y-2 p-3">
            <ListToolbar
              className="sm:flex-col sm:items-stretch"
              search={
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
                  <Input
                    value={q}
                    onChange={(event) =>
                      void navigate({
                        search: (previous) => ({
                          ...previous,
                          q: event.target.value,
                        }),
                        replace: true,
                        resetScroll: false,
                      })
                    }
                    placeholder="Buscar estructura..."
                    className="h-9 pl-8 text-sm"
                    aria-label="Buscar estructuras"
                  />
                </div>
              }
              actions={
                <>
                  <ListSortMenu
                    value={orden}
                    defaultValue="nombre_asc"
                    options={[
                      { value: 'nombre_asc', label: 'Nombre A–Z' },
                      { value: 'nombre_desc', label: 'Nombre Z–A' },
                      {
                        value: 'actualizado_desc',
                        label: 'Actualización reciente',
                      },
                    ]}
                    onValueChange={(nextOrden) =>
                      void navigate({
                        search: (previous) => ({
                          ...previous,
                          orden: nextOrden,
                        }),
                        resetScroll: false,
                      })
                    }
                    label="Ordenar estructuras"
                  />
                  <ListFiltersDialog<{ tipo: Tipo }>
                    title="Filtrar estructuras"
                    description="Selecciona la naturaleza académica de las plantillas."
                    value={{ tipo }}
                    defaultValue={{ tipo: 'CURRICULAR' }}
                    activeCount={tipo === 'CURRICULAR' ? 0 : 1}
                    onApply={(next, { resetAll }) => {
                      void navigate({
                        search: {
                          tipo: next.tipo,
                          q: resetAll ? '' : q,
                          orden: resetAll ? 'nombre_asc' : orden,
                        },
                        resetScroll: false,
                      })
                    }}
                    label="Filtrar estructuras"
                  >
                    {(draft, setDraft) => (
                      <ListFilterSection title="Tipo">
                        <RadioGroup
                          value={draft.tipo}
                          onValueChange={(nextTipo) =>
                            setDraft({ tipo: nextTipo as Tipo })
                          }
                        >
                          <Label className="border-border flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3">
                            <RadioGroupItem value="CURRICULAR" />
                            Curricular
                          </Label>
                          <Label className="border-border flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3">
                            <RadioGroupItem value="NO_CURRICULAR" />
                            No curricular
                          </Label>
                        </RadioGroup>
                      </ListFilterSection>
                    )}
                  </ListFiltersDialog>
                </>
              }
            />
            {canManageCatalogos && (
              <Button
                className="w-full"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Nueva estructura
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground px-2 py-10 text-center text-sm">
                {q
                  ? 'Sin resultados para tu búsqueda.'
                  : `No hay estructuras ${tipo === 'CURRICULAR' ? 'curriculares' : 'no curriculares'}.`}
              </p>
            ) : (
              <ul className="space-y-1">
                {items.map((e) => {
                  const isSelected = e.id === selectedId
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => goTo({ id: e.id })}
                        className={cn(
                          'group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'bg-primary/10 text-foreground'
                            : 'hover:bg-accent/60',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-foreground line-clamp-1 text-sm font-medium">
                            {e.nombre}
                          </span>
                        </div>
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                            isSelected
                              ? 'text-primary'
                              : 'text-muted-foreground/40 group-hover:text-muted-foreground',
                          )}
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Detail — rendered by the active subroute (campos / plantillas) */}
        <main
          className={cn(
            'min-w-0 flex-1 overflow-y-auto',
            selectedId ? 'block' : 'hidden md:block',
          )}
        >
          {/* Botón de regreso solo en móvil cuando hay una estructura abierta */}
          {selectedId && (
            <div className="border-border/60 bg-background/95 sticky top-0 z-10 border-b px-4 py-2 backdrop-blur md:hidden">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground -ml-2"
                onClick={() => goTo({ id: undefined })}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la lista
              </Button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {canManageCatalogos && (
        <EstructuraFormModal
          open={createOpen}
          mode={modo === 'planes' ? 'plan' : 'asignatura'}
          editing={null}
          onClose={() => setCreateOpen(false)}
          defaultTipo={modo === 'planes' ? tipo : undefined}
        />
      )}
    </div>
  )
}
