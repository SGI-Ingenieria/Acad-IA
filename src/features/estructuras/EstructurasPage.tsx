import { useNavigate } from '@tanstack/react-router'
import {
  BookOpen,
  ChevronRight,
  Edit,
  Layers,
  LayoutTemplate,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { CamposEditor } from './CamposEditor'
import { EstructuraFormModal } from './EstructuraFormModal'
import { PlantillasTab } from './PlantillasTab'
import type { CampoDefinicion, EstructuraAsignatura, EstructuraPlan } from './types'
import {
  camposToDefinicion,
  formatFecha,
  parseCampos,
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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useEstructurasAsignatura,
  useEstructurasAsignaturaCrud,
  useEstructurasPlan,
  useEstructurasPlanCrud,
} from '@/data'
import { cn } from '@/lib/utils'
import { Route } from '@/routes/estructuras'

type Modo = 'planes' | 'materias'
type TipoFilter = 'todos' | 'CURRICULAR' | 'NO_CURRICULAR'

export function EstructurasPage() {
  const navigate = useNavigate({ from: '/estructuras' })
  const { id: selectedId, tab: selectedTab } = Route.useSearch()

  const [modo, setModo] = useState<Modo>('planes')
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos')
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTab, setDetailTab] = useState(selectedTab ?? 'definicion')

  const { data: planesRaw = [], isLoading: loadingPlanes } = useEstructurasPlan()
  const { data: materiasRaw = [], isLoading: loadingMaterias } = useEstructurasAsignatura()

  const items = useMemo(() => {
    const raw = modo === 'planes' ? planesRaw : materiasRaw
    const base = Array.isArray(raw) ? raw : []
    const norm = q.toLowerCase()
    return base
      .filter((e) => {
        if (norm && !e.nombre.toLowerCase().includes(norm)) return false
        if (tipoFilter !== 'todos' && (e as EstructuraPlan).tipo !== tipoFilter) return false
        return true
      })
  }, [modo, planesRaw, materiasRaw, q, tipoFilter])

  const selected = useMemo(
    () => items.find((e) => e.id === selectedId) ?? null,
    [items, selectedId],
  )

  // Si el item seleccionado desaparece del listado al cambiar modo, deseleccionar
  useEffect(() => {
    if (selectedId && items.length > 0 && !items.find((e) => e.id === selectedId)) {
      void navigate({ search: (prev) => ({ ...prev, id: undefined }) })
    }
  }, [items, selectedId, navigate])

  const selectItem = (e: EstructuraPlan | EstructuraAsignatura) => {
    void navigate({ search: (prev) => ({ ...prev, id: e.id, tab: 'definicion' }) })
    setDetailTab('definicion')
  }

  const handleTabChange = (tab: string) => {
    setDetailTab(tab)
    void navigate({ search: (prev) => ({ ...prev, tab }) })
  }

  const isLoading = modo === 'planes' ? loadingPlanes : loadingMaterias

  const onDeleteSuccess = () => {
    void navigate({ search: () => ({}) })
  }

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      {/* ── Encabezado ── */}
      <header className="border-border/60 border-b px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary rounded-xl p-2">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-foreground text-xl font-bold">Estructuras y Plantillas</h1>
              <p className="text-muted-foreground text-xs">
                Administra las definiciones de campos y documentos del sistema
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filtro modo */}
            <nav className="bg-card flex items-center gap-1 rounded-xl border p-1">
              <button
                onClick={() => setModo('planes')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  modo === 'planes'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutTemplate className="h-3.5 w-3.5" /> Planes
              </button>
              <button
                onClick={() => setModo('materias')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  modo === 'materias'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <BookOpen className="h-3.5 w-3.5" /> Materias
              </button>
            </nav>

            {/* Filtro tipo */}
            {(['todos', 'CURRICULAR', 'NO_CURRICULAR'] as TipoFilter[]).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tipoFilter === t ? 'default' : 'outline'}
                onClick={() => setTipoFilter(t)}
                className="text-xs"
              >
                {t === 'todos' ? 'Todos' : t === 'CURRICULAR' ? 'Curricular' : 'No Curricular'}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Cuerpo: sidebar + detalle ── */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-0 overflow-hidden">
        {/* Sidebar */}
        <aside className="border-border/60 flex w-72 shrink-0 flex-col border-r">
          {/* Buscador + nuevo */}
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

          <Separator />

          {/* Lista */}
          <div className="flex-1 overflow-y-auto py-1">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            )}

            {!isLoading && items.length === 0 && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Sin resultados
              </p>
            )}

            {items.map((e) => {
              const isSelected = e.id === selectedId
              const tipo = (e as EstructuraPlan).tipo
              const campos = parseCampos(e.definicion)

              return (
                <button
                  key={e.id}
                  onClick={() => selectItem(e)}
                  className={cn(
                    'w-full px-3 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'bg-primary/8 border-l-2 border-l-primary'
                      : 'hover:bg-accent/50 border-l-2 border-l-transparent',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-foreground line-clamp-1 text-sm font-medium">
                      {e.nombre}
                    </span>
                    <ChevronRight className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {tipo && (
                      <Badge variant="outline" className="px-1.5 py-0 text-xs font-normal">
                        {tipo === 'CURRICULAR' ? 'Curricular' : 'No Curricular'}
                      </Badge>
                    )}
                    {campos.length > 0 && (
                      <span className="text-muted-foreground text-xs">
                        {campos.length} campo{campos.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Panel de detalle */}
        <main className="min-w-0 flex-1">
          {!selected ? (
            <EmptyDetail onNew={() => setCreateOpen(true)} />
          ) : (
            <DetailPanel
              key={selected.id}
              estructura={selected}
              modo={modo}
              tab={detailTab}
              onTabChange={handleTabChange}
              onDeleteSuccess={onDeleteSuccess}
            />
          )}
        </main>
      </div>

      {/* Modal crear */}
      <EstructuraFormModal
        open={createOpen}
        mode={modo === 'planes' ? 'plan' : 'asignatura'}
        editing={null}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}

/* ── Panel vacío ── */
function EmptyDetail({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-12">
      <div className="bg-muted rounded-2xl p-6">
        <Layers className="text-muted-foreground h-10 w-10" />
      </div>
      <div className="text-center">
        <p className="text-foreground font-semibold">Selecciona una estructura</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Elige una estructura de la lista o crea una nueva.
        </p>
      </div>
      <Button onClick={onNew}>
        <Plus className="mr-2 h-4 w-4" /> Nueva estructura
      </Button>
    </div>
  )
}

/* ── Panel de detalle con tabs ── */
function DetailPanel({
  estructura,
  modo,
  tab,
  onTabChange,
  onDeleteSuccess,
}: {
  estructura: EstructuraPlan | EstructuraAsignatura
  modo: Modo
  tab: string
  onTabChange: (t: string) => void
  onDeleteSuccess: () => void
}) {
  const planCrud = useEstructurasPlanCrud()
  const asigCrud = useEstructurasAsignaturaCrud()
  const isDeleting = planCrud.remove.isPending || asigCrud.remove.isPending

  const handleDelete = async () => {
    try {
      if (modo === 'planes') {
        await planCrud.remove.mutateAsync(estructura.id)
      } else {
        await asigCrud.remove.mutateAsync(estructura.id)
      }
      toast.success('Estructura eliminada')
      onDeleteSuccess()
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === '23503') {
        toast.error('No se puede eliminar: está siendo usada por uno o más planes de estudio')
      } else {
        toast.error('No se pudo eliminar')
      }
    }
  }
  const [editNameOpen, setEditNameOpen] = useState(false)
  const [nombre, setNombre] = useState(estructura.nombre)
  const [campos, setCampos] = useState<CampoDefinicion[]>(() =>
    parseCampos(estructura.definicion),
  )
  const [dirty, setDirty] = useState(false)

  // Resetear cuando cambia la estructura seleccionada
  useEffect(() => {
    setNombre(estructura.nombre)
    setCampos(parseCampos(estructura.definicion))
    setDirty(false)
    setEditNameOpen(false)
  }, [estructura.id])

  const updateCampos = (next: CampoDefinicion[]) => {
    setCampos(next)
    setDirty(true)
  }

  const isSaving = planCrud.update.isPending || asigCrud.update.isPending

  const handleSave = async () => {
    const definicion = camposToDefinicion(campos)
    try {
      if (modo === 'planes') {
        await planCrud.update.mutateAsync({
          id: estructura.id,
          input: { nombre, definicion },
        })
      } else {
        await asigCrud.update.mutateAsync({
          id: estructura.id,
          input: { nombre, definicion },
        })
      }
      setDirty(false)
      toast.success('Estructura guardada')
    } catch {
      toast.error('No se pudo guardar')
    }
  }

  const handleTemplateSelect = async (templateId: string | null) => {
    try {
      if (modo === 'planes') {
        await planCrud.update.mutateAsync({ id: estructura.id, input: { template_id: templateId } })
      } else {
        await asigCrud.update.mutateAsync({ id: estructura.id, input: { template_id: templateId } })
      }
      toast.success(templateId ? 'Plantilla activa actualizada' : 'Plantilla activa eliminada')
    } catch {
      toast.error('No se pudo actualizar la plantilla activa')
    }
  }

  const tipo = (estructura as EstructuraPlan).tipo
  const camposActivos = campos.filter((c) => c.requerido).length

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera del detalle */}
      <div className="border-border/60 border-b px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {editNameOpen ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nombre}
                  onChange={(e) => { setNombre(e.target.value); setDirty(true) }}
                  className="h-8 text-base font-bold"
                  autoFocus
                  onBlur={() => setEditNameOpen(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditNameOpen(false)}
                />
              </div>
            ) : (
              <button
                onClick={() => setEditNameOpen(true)}
                className="group flex items-center gap-1.5"
              >
                <h2 className="text-foreground text-lg font-bold">{nombre}</h2>
                <Edit className="text-muted-foreground h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              {tipo && (
                <span className="text-muted-foreground">
                  {tipo === 'CURRICULAR' ? 'Curricular' : 'No Curricular'}
                </span>
              )}
              {tipo && <span className="text-muted-foreground">·</span>}
              <span className="text-muted-foreground">
                {campos.length} campo{campos.length !== 1 ? 's' : ''}
                {camposActivos > 0 && ` · ${camposActivos} obligatorio${camposActivos !== 1 ? 's' : ''}`}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground text-xs">
                Modificado {formatFecha(estructura.actualizado_en)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  disabled={isDeleting}
                  title="Eliminar estructura"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar estructura?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará <strong>{estructura.nombre}</strong> y no podrás recuperarla.
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
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto">
        <Tabs value={tab} onValueChange={onTabChange} className="h-full">
          <div className="border-border/60 bg-background sticky top-0 z-10 border-b px-6">
            <TabsList className="h-auto rounded-none bg-transparent p-0">
              {[
                { value: 'definicion', label: 'Definición' },
                { value: 'info', label: 'Información' },
                { value: 'plantillas', label: 'Plantillas' },
              ].map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="data-[state=active]:border-primary data-[state=active]:text-primary rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="definicion" className="m-0 p-6">
            <div className="space-y-4">
              <div>
                <p className="font-semibold">Campos de la estructura</p>
                <p className="text-muted-foreground text-sm">
                  Define los campos que conforman esta plantilla.
                </p>
              </div>
              <CamposEditor
                campos={campos}
                onChange={updateCampos}
                dirty={dirty}
                isSaving={isSaving}
                onSave={handleSave}
              />
            </div>
          </TabsContent>

          <TabsContent value="plantillas" className="m-0 p-6">
            <PlantillasTab
              estructuraId={estructura.id}
              templateId={estructura.template_id}
              onTemplateSelect={handleTemplateSelect}
            />
          </TabsContent>

          <TabsContent value="info" className="m-0 p-6">
            <InfoTab estructura={estructura} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

/* ── Tab de información general ── */
function InfoTab({ estructura }: { estructura: EstructuraPlan | EstructuraAsignatura }) {
  const tipo = (estructura as EstructuraPlan).tipo

  return (
    <div className="max-w-lg space-y-4">
      <div className="grid gap-4">
        <InfoRow label="ID" value={<span className="font-mono text-xs">{estructura.id}</span>} />
        <InfoRow label="Nombre" value={estructura.nombre} />
        {tipo && (
          <InfoRow
            label="Tipo"
            value={
              <Badge variant={tipo === 'CURRICULAR' ? 'default' : 'secondary'}>
                {tipo === 'CURRICULAR' ? 'Curricular' : 'No Curricular'}
              </Badge>
            }
          />
        )}
        {estructura.template_id && (
          <InfoRow
            label="Template ID"
            value={<span className="font-mono text-xs">{estructura.template_id}</span>}
          />
        )}
        <InfoRow label="Creado" value={formatFecha(estructura.creado_en)} />
        <InfoRow label="Modificado" value={formatFecha(estructura.actualizado_en)} />
        <InfoRow label="Campos totales" value={String(parseCampos(estructura.definicion).length)} />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-border/60 flex items-start gap-4 border-b pb-3">
      <span className="text-muted-foreground w-32 shrink-0 text-sm">{label}</span>
      <span className="text-foreground text-sm">{value}</span>
    </div>
  )
}
