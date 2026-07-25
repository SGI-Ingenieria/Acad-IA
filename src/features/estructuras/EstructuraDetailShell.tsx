import {
  Link,
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
import { Layers, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { parseCampos } from './types'

import type { EstructuraAsignatura, EstructuraPlan } from './types'

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

/* ── Empty state ── */
function EmptyDetail() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="bg-muted rounded-2xl p-6">
        <Layers className="text-muted-foreground h-10 w-10" />
      </div>
      <div>
        <p className="text-foreground font-semibold">
          Selecciona una estructura
        </p>
      </div>
    </div>
  )
}

/* ── Tab link (underline style, shared with plan detail) ── */
function TabLink({
  to,
  params,
  active,
  children,
}: {
  to: string
  params: { modo: Modo; id?: string }
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      params={params}
      className={cn(
        'border-b-2 pb-3 text-sm font-medium transition-colors',
        active
          ? 'border-primary text-primary font-semibold'
          : 'text-muted-foreground hover:text-foreground hover:border-primary/40 border-transparent',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  )
}

/* ── Shared detail shell: header (name + delete) + tablist + tab content ── */
function DetailContent({
  estructura,
  modo,
  children,
}: {
  estructura: Estructura
  modo: Modo
  children: (estructura: Estructura, modo: Modo) => React.ReactNode
}) {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const planCrud = useEstructurasPlanCrud()
  const asigCrud = useEstructurasAsignaturaCrud()
  const { data: estructurasPlan = [] } = useEstructurasPlan()
  const { data: estructurasAsignatura = [] } = useEstructurasAsignatura()

  // Solo estado de edición en curso: el nombre vigente vive en la query (la
  // mutación de useMeta es optimista con rollback) y DetailContent se remonta
  // con key={estructura.id} al cambiar de estructura.
  const [editNameOpen, setEditNameOpen] = useState(false)
  const [draftNombre, setDraftNombre] = useState('')
  const assignedPlanId =
    modo === 'materias'
      ? (estructura as EstructuraAsignatura).estructura_plan_id
      : ''

  const isDeleting = planCrud.remove.isPending || asigCrud.remove.isPending

  const campos = parseCampos(estructura.definicion)
  const requeridos = campos.filter((c) => c.requerido).length
  const tipo = estructura.tipo
  const lastPathSegment = pathname.split('/').filter(Boolean).at(-1)
  const activeTab = lastPathSegment === 'plantillas' ? 'plantillas' : 'campos'

  const startEditName = () => {
    setDraftNombre(estructura.nombre)
    setEditNameOpen(true)
  }

  const handleNameSave = () => {
    setEditNameOpen(false)
    const next = draftNombre.trim()
    if (!next || next === estructura.nombre) return
    const crud = modo === 'planes' ? planCrud : asigCrud
    // Optimista con rollback en useMeta: la lista que alimenta `estructura`
    // refleja el cambio al instante y el toast global avisa si falla.
    crud.update.mutate(
      { id: estructura.id, input: { nombre: next } },
      { onSuccess: () => toast.success('Nombre actualizado') },
    )
  }

  // 1:1 — solo se ofrecen plantillas de plan libres (más la actual).
  const planesDisponibles = estructurasPlan.filter(
    (ep) =>
      ep.id === assignedPlanId ||
      !estructurasAsignatura.some((ea) => ea.estructura_plan_id === ep.id),
  )

  const handlePlanChange = (newPlanId: string) => {
    // Sin rollback manual: la mutación optimista de useMeta restaura el valor
    // del Select (derivado de la query) si el servidor rechaza.
    asigCrud.update.mutate(
      { id: estructura.id, input: { estructura_plan_id: newPlanId } },
      { onSuccess: () => toast.success('Estructura de plan actualizada') },
    )
  }

  const handleDelete = async () => {
    const crud = modo === 'planes' ? planCrud : asigCrud
    try {
      await crud.remove.mutateAsync(estructura.id)
      toast.success('Estructura eliminada')
      void navigate({
        to: '/administracion/estructuras/$modo/{-$id}',
        params: { modo, id: undefined },
        search: (prev) => ({
          tipo: prev.tipo === 'NO_CURRICULAR' ? 'NO_CURRICULAR' : 'CURRICULAR',
        }),
      })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      toast.error(
        code === '23503'
          ? 'No se puede eliminar: está en uso por uno o más planes de estudio.'
          : 'No se pudo eliminar',
      )
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      {/* Header */}
      <div className="space-y-3">
        {editNameOpen ? (
          <Input
            value={draftNombre}
            onChange={(e) => setDraftNombre(e.target.value)}
            className="h-10 text-lg font-bold"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSave()
              if (e.key === 'Escape') setEditNameOpen(false)
            }}
          />
        ) : (
          <button
            type="button"
            onClick={startEditName}
            className="group flex items-center gap-2"
          >
            <h2 className="text-foreground text-xl font-bold tracking-tight">
              {estructura.nombre}
            </h2>
            <Pencil className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {tipo && <TipoBadge tipo={tipo} />}
          {modo === 'materias' && planesDisponibles.length > 0 && (
            <Select value={assignedPlanId} onValueChange={handlePlanChange}>
              <SelectTrigger className="text-muted-foreground hover:text-foreground h-auto gap-1 border-0 p-0 text-sm shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3">
                <SelectValue placeholder="Sin plantilla de plan" />
              </SelectTrigger>
              <SelectContent>
                {planesDisponibles.map((ep) => (
                  <SelectItem key={ep.id} value={ep.id}>
                    {ep.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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

      {/* Tablist */}
      <div className="mt-6 border-b">
        <nav className="flex gap-8">
          <TabLink
            to="/administracion/estructuras/$modo/{-$id}"
            params={{ modo, id: estructura.id }}
            active={activeTab === 'campos'}
          >
            Campos
          </TabLink>
          <TabLink
            to="/administracion/estructuras/$modo/{-$id}/plantillas"
            params={{ modo, id: estructura.id }}
            active={activeTab === 'plantillas'}
          >
            Plantillas
          </TabLink>
        </nav>
      </div>

      {/* Tab content */}
      <div className="animate-in fade-in mt-6 duration-300">
        {children(estructura, modo)}
      </div>
    </div>
  )
}

/**
 * Resolves the structure selected in the URL and renders the shared detail
 * header + tablist around the active tab's content. Used by both the campos
 * (index) and plantillas subroutes.
 */
export function EstructuraDetailShell({
  children,
}: {
  children: (estructura: Estructura, modo: Modo) => React.ReactNode
}) {
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const modo = params.modo as Modo
  const selectedId = params.id

  const { data: planesRaw = [], isLoading: loadingPlanes } =
    useEstructurasPlan()
  const { data: materiasRaw = [], isLoading: loadingMaterias } =
    useEstructurasAsignatura()

  const isLoading = modo === 'planes' ? loadingPlanes : loadingMaterias
  const raw: Array<Estructura> = modo === 'planes' ? planesRaw : materiasRaw

  const selected = useMemo(
    () => raw.find((e) => e.id === selectedId) ?? null,
    [raw, selectedId],
  )

  // Clear a stale id from the URL once data has loaded and it matched nothing.
  useEffect(() => {
    if (selectedId && !isLoading && raw.length > 0 && !selected) {
      void navigate({
        to: '/administracion/estructuras/$modo/{-$id}',
        params: { modo, id: undefined },
        search: (prev) => ({
          tipo: prev.tipo === 'NO_CURRICULAR' ? 'NO_CURRICULAR' : 'CURRICULAR',
        }),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, isLoading, raw, selected])

  if (!selectedId) return <EmptyDetail />
  if (isLoading && !selected) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }
  if (!selected) return <EmptyDetail />

  return (
    <DetailContent key={selected.id} estructura={selected} modo={modo}>
      {children}
    </DetailContent>
  )
}
