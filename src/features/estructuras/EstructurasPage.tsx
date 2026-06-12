import { useNavigate, useParams } from '@tanstack/react-router'
import {
  BookOpen,
  ChevronRight,
  Layers,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { CamposEditor } from './CamposEditor'
import { EstructuraFormModal } from './EstructuraFormModal'
import { camposToDefinicion, formatFecha, parseCampos } from './types'

import type {
  CampoDefinicion,
  EstructuraAsignatura,
  EstructuraPlan,
} from './types'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useEstructurasAsignatura,
  useEstructurasAsignaturaCrud,
  useEstructurasPlan,
  useEstructurasPlanCrud,
} from '@/data'
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

function TipoBadge({ tipo }: { tipo: Tipo }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border-transparent px-2 py-0 text-[11px] font-medium',
        tipo === 'CURRICULAR'
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {tipo === 'CURRICULAR' ? 'Curricular' : 'No curricular'}
    </Badge>
  )
}

export function EstructurasPage() {
  const navigate = useNavigate()
  const params = useParams({ from: '/estructuras/$modo/{-$id}' })
  const modo = params.modo as Modo
  const selectedId = params.id

  const [tipo, setTipo] = useState<Tipo>('CURRICULAR')
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

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
    return raw.filter((e) => {
      if ((e.tipo ?? 'CURRICULAR') !== tipo) return false
      if (norm && !e.nombre.toLowerCase().includes(norm)) return false
      return true
    })
  }, [raw, tipo, q])

  // Selection resolves against the *unfiltered* list so deep links to a
  // non-curricular structure still open even while the filter shows curricular.
  const selected = useMemo(
    () => raw.find((e) => e.id === selectedId) ?? null,
    [raw, selectedId],
  )

  const goTo = (next: { modo?: Modo; id?: string }) =>
    void navigate({
      to: '/estructuras/$modo/{-$id}',
      params: { modo: next.modo ?? modo, id: next.id },
    })

  // Clear a stale id from the URL once data has loaded and it matched nothing.
  useEffect(() => {
    if (selectedId && !isLoading && raw.length > 0 && !selected) {
      goTo({ id: undefined })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, isLoading, raw, selected])

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
              <p className="text-muted-foreground text-xs">
                Define los campos de planes de estudio y asignaturas.
              </p>
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
            <Segmented<Tipo>
              size="sm"
              value={tipo}
              onChange={setTipo}
              options={[
                { value: 'CURRICULAR', label: 'Curricular' },
                { value: 'NO_CURRICULAR', label: 'No curricular' },
              ]}
            />
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + detail ── */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="border-border/60 flex w-72 shrink-0 flex-col border-r">
          <div className="space-y-2 p-3">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar estructura..."
                className="h-9 pl-8 text-sm"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              className="w-full"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> Nueva estructura
            </Button>
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
                  const campos = parseCampos(e.definicion)
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
                          <span className="text-muted-foreground mt-0.5 block text-xs">
                            {campos.length} campo
                            {campos.length !== 1 ? 's' : ''}
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

        {/* Detail */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {selected ? (
            <DetailPanel
              key={selected.id}
              estructura={selected}
              modo={modo}
              onDeleted={() => goTo({ id: undefined })}
            />
          ) : (
            <EmptyDetail onNew={() => setCreateOpen(true)} />
          )}
        </main>
      </div>

      <EstructuraFormModal
        open={createOpen}
        mode={modo === 'planes' ? 'plan' : 'asignatura'}
        editing={null}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}

/* ── Empty state ── */
function EmptyDetail({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="bg-muted rounded-2xl p-6">
        <Layers className="text-muted-foreground h-10 w-10" />
      </div>
      <div>
        <p className="text-foreground font-semibold">
          Selecciona una estructura
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Elige una estructura de la lista para ver y editar su definición.
        </p>
      </div>
      <Button variant="outline" onClick={onNew}>
        <Plus className="mr-2 h-4 w-4" /> Nueva estructura
      </Button>
    </div>
  )
}

/* ── Detail panel ── */
function DetailPanel({
  estructura,
  modo,
  onDeleted,
}: {
  estructura: Estructura
  modo: Modo
  onDeleted: () => void
}) {
  const planCrud = useEstructurasPlanCrud()
  const asigCrud = useEstructurasAsignaturaCrud()

  const [editNameOpen, setEditNameOpen] = useState(false)
  const [nombre, setNombre] = useState(estructura.nombre)
  const [campos, setCampos] = useState<Array<CampoDefinicion>>(() =>
    parseCampos(estructura.definicion),
  )
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setNombre(estructura.nombre)
    setCampos(parseCampos(estructura.definicion))
    setDirty(false)
    setEditNameOpen(false)
  }, [estructura.id, estructura.nombre, estructura.definicion])

  const isDeleting = planCrud.remove.isPending || asigCrud.remove.isPending
  const isSaving = planCrud.update.isPending || asigCrud.update.isPending

  const handleSave = async () => {
    const definicion = camposToDefinicion(campos)
    const crud = modo === 'planes' ? planCrud : asigCrud
    try {
      await crud.update.mutateAsync({
        id: estructura.id,
        input: { nombre, definicion },
      })
      setDirty(false)
      toast.success('Estructura guardada')
    } catch {
      toast.error('No se pudo guardar')
    }
  }

  const handleDelete = async () => {
    const crud = modo === 'planes' ? planCrud : asigCrud
    try {
      await crud.remove.mutateAsync(estructura.id)
      toast.success('Estructura eliminada')
      onDeleted()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      toast.error(
        code === '23503'
          ? 'No se puede eliminar: está en uso por uno o más planes de estudio.'
          : 'No se pudo eliminar',
      )
    }
  }

  const tipo = estructura.tipo as Tipo | null
  const requeridos = campos.filter((c) => c.requerido).length

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      {/* Header */}
      <div className="space-y-3">
        {editNameOpen ? (
          <Input
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value)
              setDirty(true)
            }}
            className="h-10 text-lg font-bold"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onBlur={() => setEditNameOpen(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditNameOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditNameOpen(true)}
            className="group flex items-center gap-2"
          >
            <h2 className="text-foreground text-xl font-bold tracking-tight">
              {nombre}
            </h2>
            <Pencil className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {tipo && <TipoBadge tipo={tipo} />}
          <span className="text-muted-foreground">
            {campos.length} campo{campos.length !== 1 ? 's' : ''}
          </span>
          {requeridos > 0 && (
            <>
              <span className="text-border">·</span>
              <span className="text-muted-foreground">
                {requeridos} obligatorio{requeridos !== 1 ? 's' : ''}
              </span>
            </>
          )}
          <span className="text-border">·</span>
          <span className="text-muted-foreground">
            Modificado {formatFecha(estructura.actualizado_en)}
          </span>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive ml-auto h-7 gap-1.5 px-2 text-xs"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar estructura?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará <strong>{estructura.nombre}</strong> y no podrás
                  recuperarla.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Definition */}
      <div className="mt-6 space-y-4">
        <div>
          <h3 className="text-foreground text-sm font-semibold">
            Campos de la estructura
          </h3>
          <p className="text-muted-foreground text-sm">
            Define los campos que conforman esta plantilla. Arrastra para
            reordenar.
          </p>
        </div>
        <CamposEditor
          campos={campos}
          onChange={(next) => {
            setCampos(next)
            setDirty(true)
          }}
          dirty={dirty}
          isSaving={isSaving}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}
