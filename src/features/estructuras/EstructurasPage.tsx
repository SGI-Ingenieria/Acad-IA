import {
  Outlet,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import {
  ArrowLeft,
  ChevronRight,
  FileStack,
  Loader2,
  Plus,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import type { EstructuraPlan } from './types'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ListFilterSection,
  ListFiltersPopover,
  ListSortMenu,
  ListToolbar,
} from '@/components/ui/list-controls'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useEstructurasPlan, usePaquetesCurricularesCrud } from '@/data'
import { usePermissions } from '@/data/hooks/usePermissions'
import { cn } from '@/lib/utils'

type EstadoFiltro = 'vigentes' | 'archivados' | 'todos'

function PackageCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (estructura: EstructuraPlan) => void
}) {
  const crud = usePaquetesCurricularesCrud()
  const [nombre, setNombre] = useState('SEP/DGAIR')
  const [version, setVersion] = useState('')

  const create = async () => {
    const created = await crud.create.mutateAsync({
      nombre: nombre.trim(),
      etiquetaVersion: version.trim(),
      autoridadNormativa: 'SEP/DGAIR',
    })
    onOpenChange(false)
    setVersion('')
    onCreated(created)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo paquete SEP</DialogTitle>
        </DialogHeader>
        <div className="space-y-grupo py-relacionado">
          <div className="space-y-relacionado">
            <Label htmlFor="package-name">Nombre</Label>
            <Input
              id="package-name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-relacionado">
            <Label htmlFor="package-version">Versión normativa</Label>
            <Input
              id="package-version"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => void create()}
            disabled={
              !nombre.trim() || !version.trim() || crud.create.isPending
            }
          >
            {crud.create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Crear paquete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EstructurasPage() {
  const { has } = usePermissions()
  const navigate = useNavigate({
    from: '/administracion/estructuras/$modo/{-$id}',
  })
  const params = useParams({ from: '/administracion/estructuras/$modo/{-$id}' })
  const search = useSearch({ from: '/administracion/estructuras/$modo/{-$id}' })
  const selectedId = params.id
  const q = search.q ?? ''
  const orden = search.orden ?? 'nombre_asc'
  const estado = search.estado ?? 'vigentes'
  const [queryDraft, setQueryDraft] = useState(q)
  const [createOpen, setCreateOpen] = useState(false)
  const canManage = has('catalogos.gestionar')
  const { data: packages = [], isLoading } = useEstructurasPlan()

  const updateQuery = useDebouncedCallback((next: string) => {
    void navigate({
      search: (previous) => ({ ...previous, q: next }),
      replace: true,
      resetScroll: false,
    })
  }, 300)

  const items = useMemo(() => {
    const query = q.trim().toLocaleLowerCase('es')
    return packages
      .filter((item) => item.tipo === 'CURRICULAR')
      .filter((item) => {
        if (estado === 'vigentes') {
          return (
            item.estado_publicacion !== 'ARCHIVADA' &&
            item.estado_publicacion !== 'RETIRADA'
          )
        }
        if (estado === 'archivados') {
          return (
            item.estado_publicacion === 'ARCHIVADA' ||
            item.estado_publicacion === 'RETIRADA'
          )
        }
        return true
      })
      .filter((item) => {
        if (!query) return true
        return [item.nombre, item.etiqueta_version, item.autoridad_normativa]
          .filter(Boolean)
          .some((value) =>
            String(value).toLocaleLowerCase('es').includes(query),
          )
      })
      .sort((left, right) => {
        if (orden === 'nombre_desc') {
          return right.nombre.localeCompare(left.nombre, 'es')
        }
        if (orden === 'actualizado_desc') {
          return right.actualizado_en.localeCompare(left.actualizado_en)
        }
        return left.nombre.localeCompare(right.nombre, 'es')
      })
  }, [estado, orden, packages, q])

  const openPackage = (id?: string) =>
    void navigate({
      to: '/administracion/estructuras/$modo/{-$id}',
      params: { modo: 'paquetes', id },
      search,
      resetScroll: false,
    })

  const activeFilters = Number(estado !== 'vigentes')

  return (
    <div className="bg-background flex min-h-0 flex-1 overflow-hidden border-t">
      <aside
        className={cn(
          'border-border/70 w-full flex-col border-r md:flex md:w-80 md:shrink-0',
          selectedId ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="space-y-control p-grupo">
          <ListToolbar
            search={
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={queryDraft}
                  onChange={(event) => {
                    setQueryDraft(event.target.value)
                    updateQuery(event.target.value)
                  }}
                  placeholder="Buscar paquete..."
                  aria-label="Buscar paquetes curriculares"
                  className="pl-pagina"
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
                  onValueChange={(next) =>
                    void navigate({
                      search: (previous) => ({ ...previous, orden: next }),
                      resetScroll: false,
                    })
                  }
                  label="Ordenar paquetes"
                />
                <ListFiltersPopover<{ estado: EstadoFiltro }>
                  title="Filtros"
                  value={{ estado }}
                  defaultValue={{ estado: 'vigentes' }}
                  activeCount={activeFilters}
                  onApply={(next, { resetAll }) =>
                    void navigate({
                      search: (previous) => ({
                        ...previous,
                        estado: next.estado,
                        ...(resetAll ? { q: '', orden: 'nombre_asc' } : {}),
                      }),
                      resetScroll: false,
                    })
                  }
                  label="Filtrar paquetes"
                >
                  {(draft, setDraft) => (
                    <>
                      <ListFilterSection title="Estado">
                        <RadioGroup
                          value={draft.estado}
                          onValueChange={(next) =>
                            setDraft((previous) => ({
                              ...previous,
                              estado: next as EstadoFiltro,
                            }))
                          }
                        >
                          {[
                            ['vigentes', 'Vigentes'],
                            ['archivados', 'Archivados'],
                            ['todos', 'Todos'],
                          ].map(([value, label]) => (
                            <Label
                              key={value}
                              className="gap-control py-relacionado flex cursor-pointer items-center"
                            >
                              <RadioGroupItem value={value} />
                              {label}
                            </Label>
                          ))}
                        </RadioGroup>
                      </ListFilterSection>
                    </>
                  )}
                </ListFiltersPopover>
              </>
            }
          />
          {canManage ? (
            <Button className="w-full" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Nuevo paquete
            </Button>
          ) : null}
        </div>

        <div className="px-relacionado pb-control min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="py-pagina flex justify-center">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          ) : items.length ? (
            <ul className="space-y-micro">
              {items.map((item) => {
                const selected = item.id === selectedId
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openPackage(item.id)}
                      className={cn(
                        'organic-interactive gap-control px-control py-control flex w-full items-center rounded-lg text-left',
                        selected ? 'bg-primary/10' : 'hover:bg-muted/70',
                      )}
                    >
                      <FileStack
                        className={cn(
                          'size-4 shrink-0',
                          selected ? 'text-primary' : 'text-muted-foreground',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block truncate text-sm font-medium">
                          {item.nombre}
                        </span>
                        <span className="text-muted-foreground mt-micro block truncate text-xs">
                          {item.etiqueta_version || 'Borrador'}
                          {' · '}
                          {item.estado_publicacion.toLocaleLowerCase('es')}
                        </span>
                      </span>
                      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="gap-control px-seccion py-pagina flex flex-col items-center text-center">
              <FileStack className="text-muted-foreground size-8" />
              <span className="text-sm font-medium">Nuevo paquete SEP</span>
            </div>
          )}
        </div>
      </aside>

      <main
        className={cn(
          'min-w-0 flex-1 overflow-y-auto',
          selectedId ? 'block' : 'hidden md:block',
        )}
      >
        {selectedId ? (
          <div className="border-border bg-background px-grupo py-relacionado sticky top-0 z-10 border-b md:hidden">
            <Button variant="ghost" size="sm" onClick={() => openPackage()}>
              <ArrowLeft className="size-4" />
              Paquetes
            </Button>
          </div>
        ) : null}
        <Outlet />
      </main>

      {canManage ? (
        <PackageCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(created) => openPackage(created.id)}
        />
      ) : null}
    </div>
  )
}
