import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { useParams } from '@tanstack/react-router'
import {
  Plus,
  GripVertical,
  ChevronDown,
  Edit3,
  Trash2,
  Clock,
  Library,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { ContenidoApi, ContenidoTemaApi } from '@/data/api/subjects.api'
import type { FocusEvent, KeyboardEvent, ReactNode } from 'react'

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { usePlan } from '@/data'
import {
  requestAdminOverrideReason,
  useAsignaturaCapabilities,
} from '@/data/auth/planCapabilities'
import { useSubject, useUpdateSubjectContenido } from '@/data/hooks/useSubjects'
import { ColeccionesSection } from '@/features/recursos/ColeccionesSection'
import { RecursosTemaPanel } from '@/features/recursos/RecursosTemaPanel'
import { cn } from '@/lib/utils'
// import { toast } from 'sonner';

export interface Tema {
  id: string
  nombre: string
  descripcion?: string
  horasEstimadas?: number
}

export interface UnidadTematica {
  id: string
  nombre: string
  numero: number
  temas: Array<Tema>
}

function createClientId(prefix: string) {
  try {
    const c = (globalThis as any).crypto
    if (c && typeof c.randomUUID === 'function')
      return `${prefix}-${c.randomUUID()}`
  } catch {
    // ignore
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function arrayMove<T>(array: Array<T>, fromIndex: number, toIndex: number) {
  const next = array.slice()
  const startIndex = fromIndex < 0 ? next.length + fromIndex : fromIndex
  if (startIndex < 0 || startIndex >= next.length) return next
  const endIndex = toIndex < 0 ? next.length + toIndex : toIndex
  const [item] = next.splice(startIndex, 1)
  next.splice(endIndex, 0, item)
  return next
}

function renumberUnidades(unidades: Array<UnidadTematica>) {
  return unidades.map((u, idx) => ({ ...u, numero: idx + 1 }))
}

function InsertUnidadOverlay({
  onInsert,
  position,
  hoverGroup = 'unit',
  alwaysVisible = false,
}: {
  onInsert: () => void
  position: 'top' | 'bottom'
  hoverGroup?: 'list' | 'unit'
  alwaysVisible?: boolean
}) {
  return (
    <div
      className={cn(
        'pointer-events-auto absolute right-0 left-0 z-30 flex justify-center',
        // Match the `space-y-4` gap so the hover target is *between* units.
        position === 'top' ? '-top-4 h-4' : '-bottom-4 h-4',
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'bg-background/95 border-border/60 hover:bg-background cursor-pointer shadow-sm transition-opacity',
          alwaysVisible ? 'opacity-100' : 'opacity-0',
          hoverGroup === 'list'
            ? 'group-hover/list:opacity-100'
            : 'group-hover/unit:opacity-100',
        )}
        onClick={(e) => {
          e.stopPropagation()
          onInsert()
        }}
      >
        <Plus className="mr-2 h-3 w-3" /> Nueva unidad
      </Button>
    </div>
  )
}

function SortableUnidad({
  id,
  index,
  registerContainer,
  children,
}: {
  id: string
  index: number
  registerContainer: (el: HTMLDivElement | null) => void
  children: (args: { handleRef: (el: HTMLElement | null) => void }) => ReactNode
}) {
  const { ref, handleRef, isDragSource, isDropTarget } = useSortable({
    id,
    index,
  })

  return (
    <div
      ref={(el) => {
        ref(el)
        registerContainer(el)
      }}
      className={cn(
        'group/unit relative',
        isDragSource && 'opacity-80',
        isDropTarget && 'ring-primary/20 ring-2',
      )}
    >
      {children({ handleRef })}
    </div>
  )
}

function SortableTema({
  id,
  index,
  children,
}: {
  id: string
  index: number
  children: (args: { handleRef: (el: HTMLElement | null) => void }) => ReactNode
}) {
  const { ref, handleRef, isDragSource, isDropTarget } = useSortable({
    id,
    index,
  })

  return (
    <div
      ref={ref}
      className={cn(
        'group relative',
        isDragSource && 'opacity-80',
        isDropTarget && 'ring-primary/20 rounded-md ring-2',
      )}
    >
      {children({ handleRef })}
    </div>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  return undefined
}

function mapTemaValue(value: unknown): ContenidoTemaApi | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed
      ? {
          id: createClientId('t-legacy'),
          nombre: trimmed,
          horasEstimadas: 0,
        }
      : null
  }
  if (isRecord(value)) {
    const nombre = coerceString(value.nombre)
    if (!nombre) return null
    const id = coerceString(value.id) || createClientId('t-legacy')
    const horasEstimadas = coerceNumber(value.horasEstimadas)
    const descripcion = coerceString(value.descripcion)
    return {
      ...value,
      id,
      nombre,
      horasEstimadas,
      descripcion,
    }
  }
  return null
}

function mapContenidoItem(value: unknown, index: number): ContenidoApi | null {
  if (!isRecord(value)) return null

  const unidad = coerceNumber(value.unidad) ?? index + 1
  const titulo = coerceString(value.titulo) ?? 'Sin título'
  const id = coerceString(value.id) || createClientId('u-legacy')

  let temas: Array<ContenidoTemaApi> = []
  if (Array.isArray(value.temas)) {
    temas = value.temas
      .map(mapTemaValue)
      .filter((x): x is ContenidoTemaApi => x !== null)
  }

  return {
    ...value,
    id,
    unidad,
    titulo,
    temas,
  }
}

function mapContenidoTematicoFromDb(value: unknown): Array<ContenidoApi> {
  if (typeof value === 'string') {
    try {
      return mapContenidoTematicoFromDb(JSON.parse(value))
    } catch {
      return []
    }
  }

  if (Array.isArray(value)) {
    return value
      .map((item, idx) => mapContenidoItem(item, idx))
      .filter((x): x is ContenidoApi => x !== null)
  }

  if (isRecord(value)) {
    if (Array.isArray(value.contenido_tematico)) {
      return mapContenidoTematicoFromDb(value.contenido_tematico)
    }
    if (Array.isArray(value.unidades)) {
      return mapContenidoTematicoFromDb(value.unidades)
    }
  }

  return []
}

function serializeUnidadesToApi(
  unidades: Array<UnidadTematica>,
): Array<ContenidoApi> {
  return unidades
    .slice()
    .sort((a, b) => a.numero - b.numero)
    .map((u, idx) => ({
      id: u.id,
      unidad: u.numero || idx + 1,
      titulo: u.nombre || 'Sin título',
      temas: u.temas.map((t) => ({
        id: t.id,
        nombre: t.nombre || 'Tema',
        horasEstimadas: t.horasEstimadas ?? 0,
        descripcion: t.descripcion,
      })),
    }))
}

// Props del componente

export function ContenidoTematico() {
  const updateContenido = useUpdateSubjectContenido()
  const { asignaturaId, planId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { data: plan } = usePlan(planId)
  const capabilities = useAsignaturaCapabilities(plan, asignaturaId)
  const canEditContenido = capabilities.canEditAsignaturas

  const { data: data, isLoading: isLoading } = useSubject(asignaturaId)
  const [unidades, setUnidades] = useState<Array<UnidadTematica>>([])
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set())
  const unitContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const unitTitleInputRef = useRef<HTMLInputElement | null>(null)
  const temaNombreInputElRef = useRef<HTMLInputElement | null>(null)
  const [pendingScrollUnitId, setPendingScrollUnitId] = useState<string | null>(
    null,
  )
  const cancelNextBlurRef = useRef(false)
  const [deleteDialog, setDeleteDialog] = useState<{
    type: 'unidad' | 'tema'
    id: string
    parentId?: string
  } | null>(null)
  const [editingUnit, setEditingUnit] = useState<string | null>(null)
  const [unitDraftNombre, setUnitDraftNombre] = useState('')
  const [unitOriginalNombre, setUnitOriginalNombre] = useState('')
  const [editingTema, setEditingTema] = useState<{
    unitId: string
    temaId: string
  } | null>(null)
  const [temaDraftNombre, setTemaDraftNombre] = useState('')
  const [temaOriginalNombre, setTemaOriginalNombre] = useState('')
  const [temaDraftHoras, setTemaDraftHoras] = useState('')
  const [temaOriginalHoras, setTemaOriginalHoras] = useState(0)

  const didInitExpandedUnitsRef = useRef(false)

  const unidadesRef = useRef<Array<UnidadTematica>>([])
  useEffect(() => {
    unidadesRef.current = unidades
  }, [unidades])

  const persistUnidades = async (nextUnidades: Array<UnidadTematica>) => {
    if (!canEditContenido) return
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'editar el contenido tematico fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    // A partir del primer guardado, ya respetamos lo que el usuario deje expandido.
    didInitExpandedUnitsRef.current = true
    const payload = serializeUnidadesToApi(nextUnidades)
    await updateContenido.mutateAsync({
      subjectId: asignaturaId,
      unidades: payload,
      adminOverrideReason,
    })
  }

  const beginEditUnit = (unitId: string) => {
    if (!canEditContenido) return
    const unit = unidades.find((u) => u.id === unitId)
    const nombre = unit?.nombre ?? ''
    setEditingUnit(unitId)
    setUnitDraftNombre(nombre)
    setUnitOriginalNombre(nombre)
    setExpandedUnits((prev) => {
      const next = new Set(prev)
      next.add(unitId)
      return next
    })
  }

  const commitEditUnit = () => {
    if (!editingUnit) return
    const next = unidades.map((u) =>
      u.id === editingUnit ? { ...u, nombre: unitDraftNombre } : u,
    )
    setUnidades(next)
    setEditingUnit(null)
    void persistUnidades(next)
  }

  const cancelEditUnit = () => {
    setEditingUnit(null)
    setUnitDraftNombre(unitOriginalNombre)
  }

  const beginEditTema = (unitId: string, temaId: string) => {
    if (!canEditContenido) return
    const unit = unidades.find((u) => u.id === unitId)
    const tema = unit?.temas.find((t) => t.id === temaId)
    const nombre = tema?.nombre ?? ''
    const horas = tema?.horasEstimadas ?? 0

    setEditingTema({ unitId, temaId })
    setTemaDraftNombre(nombre)
    setTemaOriginalNombre(nombre)
    setTemaDraftHoras(String(horas))
    setTemaOriginalHoras(horas)
    setExpandedUnits((prev) => {
      const next = new Set(prev)
      next.add(unitId)
      return next
    })
  }

  const parseHorasEstimadas = (raw: string): number => {
    const normalized = raw.trim().replace(',', '.')
    const parsed = Number.parseFloat(normalized)
    if (!Number.isFinite(parsed)) return 0

    return parsed
  }

  const commitEditTema = () => {
    if (!editingTema) return
    const horasEstimadas = parseHorasEstimadas(temaDraftHoras)

    const next = unidades.map((u) => {
      if (u.id !== editingTema.unitId) return u
      return {
        ...u,
        temas: u.temas.map((t) =>
          t.id === editingTema.temaId
            ? { ...t, nombre: temaDraftNombre, horasEstimadas }
            : t,
        ),
      }
    })

    setUnidades(next)
    setEditingTema(null)
    void persistUnidades(next)
  }

  const cancelEditTema = () => {
    setEditingTema(null)
    setTemaDraftNombre(temaOriginalNombre)
    setTemaDraftHoras(String(temaOriginalHoras))
  }

  const handleTemaEditorBlurCapture = (e: FocusEvent<HTMLDivElement>) => {
    if (cancelNextBlurRef.current) {
      cancelNextBlurRef.current = false
      return
    }
    const nextFocus = e.relatedTarget as Node | null
    if (nextFocus && e.currentTarget.contains(nextFocus)) return
    commitEditTema()
  }

  const handleTemaEditorKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.target instanceof HTMLElement) e.target.blur()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelNextBlurRef.current = true
      cancelEditTema()
      if (e.target instanceof HTMLElement) e.target.blur()
    }
  }

  useEffect(() => {
    const contenido = mapContenidoTematicoFromDb(
      data ? data.contenido_tematico : undefined,
    )

    // 1. EL ESCUDO: Comparamos si nuestro estado local ya tiene esta info exacta
    // (Esto ocurre justo después de arrastrar, ya que actualizamos la UI antes que la BD)
    const currentPayload = JSON.stringify(
      serializeUnidadesToApi(unidadesRef.current),
    )

    // Normalizamos la data de la BD para que tenga exactamente la misma forma que el payload.
    // Ahora contenido_tematico incluye ids persistentes generados por la BD.
    const incomingPayload = JSON.stringify(
      contenido.map((u, idx) => ({
        id: u.id || createClientId(`u-${u.unidad || idx + 1}`),
        unidad: u.unidad || idx + 1,
        titulo: u.titulo || 'Sin título',
        temas: Array.isArray(u.temas)
          ? u.temas.map((t, tidx) => {
              if (typeof t === 'string') {
                return {
                  id: createClientId(`t-${u.unidad || idx + 1}-${tidx + 1}`),
                  nombre: t,
                  horasEstimadas: 0,
                  descripcion: undefined,
                }
              }

              return {
                id:
                  t.id ||
                  createClientId(`t-${u.unidad || idx + 1}-${tidx + 1}`),
                nombre: t.nombre || 'Tema',
                horasEstimadas: t.horasEstimadas ?? 0,
                descripcion: t.descripcion,
              }
            })
          : [],
      })),
    )

    // Si los datos son idénticos, abortamos el useEffect.
    if (currentPayload === incomingPayload && unidadesRef.current.length > 0) {
      return
    }

    // 2. Si llegamos aquí, es la carga inicial o alguien más editó la BD desde otro lado.
    // Reciclamos IDs persistentes de la BD; si no hay, usamos el título/nombre como fallback.
    const prevUnidades = [...unidadesRef.current]
    const idToUnit = new Map(prevUnidades.map((prev) => [prev.id, prev]))
    const nameToUnit = new Map(prevUnidades.map((prev) => [prev.nombre, prev]))

    const transformed = contenido.map((u, idx) => {
      const dbUnitId = u.id || createClientId(`u-${u.unidad || idx + 1}`)
      const existingUnit =
        idToUnit.get(dbUnitId) || nameToUnit.get(u.titulo || '')
      const unidadId = existingUnit ? existingUnit.id : dbUnitId

      const temaIdMap = new Map(
        (existingUnit?.temas ?? []).map((t) => [t.id, t]),
      )
      const temaNameMap = new Map(
        (existingUnit?.temas ?? []).map((t) => [t.nombre, t]),
      )

      return {
        id: unidadId,
        numero: u.unidad || idx + 1,
        nombre: u.titulo || 'Sin título',
        temas: Array.isArray(u.temas)
          ? u.temas.map((t: any, tidx: number) => {
              const dbTemaNombre =
                typeof t === 'string' ? t : t?.nombre || 'Tema'
              const dbTemaId =
                typeof t === 'string'
                  ? createClientId(`t-${u.unidad || idx + 1}-${tidx + 1}`)
                  : t?.id ||
                    createClientId(`t-${u.unidad || idx + 1}-${tidx + 1}`)
              const existingTema =
                temaIdMap.get(dbTemaId) || temaNameMap.get(dbTemaNombre)

              return {
                id: existingTema ? existingTema.id : dbTemaId,
                nombre: dbTemaNombre,
                horasEstimadas:
                  coerceNumber(
                    typeof t === 'string' ? undefined : t?.horasEstimadas,
                  ) ?? 0,
              }
            })
          : [],
      }
    })

    setUnidades(transformed)

    setExpandedUnits((prev) => {
      const validIds = new Set(transformed.map((u) => u.id))
      const filtered = new Set(
        Array.from(prev).filter((id) => validIds.has(id)),
      )

      // Expandir la primera unidad solo una vez al llegar a la ruta.
      if (!didInitExpandedUnitsRef.current && transformed.length > 0) {
        return filtered.size > 0 ? filtered : new Set([transformed[0].id])
      }

      return filtered
    })
  }, [data])

  useEffect(() => {
    if (!editingUnit) return
    // Foco controlado (evitamos autoFocus por lint/a11y)
    setTimeout(() => unitTitleInputRef.current?.focus(), 0)
  }, [editingUnit])

  useEffect(() => {
    if (!editingTema) return
    setTimeout(() => temaNombreInputElRef.current?.focus(), 0)
  }, [editingTema])

  useEffect(() => {
    if (!pendingScrollUnitId) return
    const el = unitContainerRefs.current.get(pendingScrollUnitId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setPendingScrollUnitId(null)
  }, [pendingScrollUnitId, unidades.length])

  if (isLoading)
    return <div className="p-10 text-center">Cargando contenido...</div>

  // 3. Cálculo de horas (ahora dinámico basado en los nuevos datos)
  const totalHoras = unidades.reduce(
    (acc, u) =>
      acc + u.temas.reduce((sum, t) => sum + (t.horasEstimadas ?? 0), 0),
    0,
  )

  // --- Lógica de Unidades ---
  const toggleUnit = (id: string) => {
    const newExpanded = new Set(expandedUnits)
    newExpanded.has(id) ? newExpanded.delete(id) : newExpanded.add(id)
    setExpandedUnits(newExpanded)
  }

  const insertUnidadAt = (insertIndex: number) => {
    if (!canEditContenido) return
    const newId = createClientId('u')
    const newUnidad: UnidadTematica = {
      id: newId,
      nombre: 'Nueva Unidad',
      numero: 0,
      temas: [],
    }

    const clampedIndex = Math.max(0, Math.min(insertIndex, unidades.length))
    const next = renumberUnidades([
      ...unidades.slice(0, clampedIndex),
      newUnidad,
      ...unidades.slice(clampedIndex),
    ])

    setUnidades(next)
    setExpandedUnits((prev) => {
      const n = new Set(prev)
      n.add(newId)
      return n
    })
    setPendingScrollUnitId(newId)

    setEditingUnit(newId)
    setUnitDraftNombre(newUnidad.nombre)
    setUnitOriginalNombre(newUnidad.nombre)

    void persistUnidades(next)
  }

  const handleReorderEnd = (event: any) => {
    if (!canEditContenido) return
    if (event?.canceled) return

    const source = event?.operation?.source
    if (!source) return

    // Type-guard nativo de dnd-kit para asegurar que el elemento tiene metadata de orden
    if (!isSortable(source)) return

    // Extraemos las posiciones exactas calculadas por dnd-kit
    const { initialIndex, index } = source.sortable

    // Si lo soltó en la misma posición de la que salió, cancelamos
    if (initialIndex === index) return

    setUnidades((prev) => {
      // Hacemos el movimiento usando los índices directos
      const moved = arrayMove(prev, initialIndex, index)
      const next = renumberUnidades(moved)

      // Disparamos la persistencia hacia Supabase
      void persistUnidades(next).catch((err) => {
        console.error('No se pudo guardar el orden de unidades', err)
      })

      return next
    })
  }

  const handleTemaReorderEnd = (unidadId: string, event: any) => {
    if (!canEditContenido) return
    if (event?.canceled) return

    const source = event?.operation?.source
    if (!source) return
    if (!isSortable(source)) return

    const { initialIndex, index } = source.sortable
    if (initialIndex === index) return

    setUnidades((prev) => {
      const next = prev.map((u) => {
        if (u.id !== unidadId) return u
        return {
          ...u,
          temas: arrayMove(u.temas, initialIndex, index),
        }
      })

      void persistUnidades(next).catch((err) => {
        console.error('No se pudo guardar el orden de temas', err)
      })

      return next
    })
  }

  // --- Lógica de Temas ---
  const addTema = (unidadId: string) => {
    if (!canEditContenido) return
    const unit = unidades.find((u) => u.id === unidadId)
    const unitNumero = unit?.numero ?? 0
    const newTemaIndex = (unit?.temas.length ?? 0) + 1
    const newTemaId = `t-${unitNumero}-${newTemaIndex}`
    const newTema: Tema = {
      id: newTemaId,
      nombre: 'Nuevo tema',
      horasEstimadas: 2,
    }

    const next = unidades.map((u) =>
      u.id === unidadId ? { ...u, temas: [...u.temas, newTema] } : u,
    )
    setUnidades(next)

    // Expandir unidad y poner el subtema en edición con foco en el nombre
    setExpandedUnits((prev) => {
      const n = new Set(prev)
      n.add(unidadId)
      return n
    })
    setEditingTema({ unitId: unidadId, temaId: newTemaId })
    setTemaDraftNombre(newTema.nombre)
    setTemaOriginalNombre(newTema.nombre)
    setTemaDraftHoras(String(newTema.horasEstimadas ?? 0))
    setTemaOriginalHoras(newTema.horasEstimadas ?? 0)
  }

  const handleDelete = () => {
    if (!canEditContenido) return
    if (!deleteDialog) return
    let next: Array<UnidadTematica> = unidades
    if (deleteDialog.type === 'unidad') {
      next = unidades
        .filter((u) => u.id !== deleteDialog.id)
        .map((u, i) => ({ ...u, numero: i + 1 }))
    } else if (deleteDialog.parentId) {
      next = unidades.map((u) =>
        u.id === deleteDialog.parentId
          ? { ...u, temas: u.temas.filter((t) => t.id !== deleteDialog.id) }
          : u,
      )
    }
    setUnidades(next)
    setDeleteDialog(null)
    void persistUnidades(next)
    // toast.success("Eliminado correctamente");
  }

  return (
    <div className="animate-in fade-in space-y-6 pb-8 duration-500">
      <div className="group/list relative flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-foreground text-2xl font-bold tracking-tight">
            Contenido Temático
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {unidades.length} unidades • {totalHoras} horas estimadas totales
          </p>
        </div>

        {/* Insertar unidad en posición 0: visible sólo al hover de este header,
            excepto cuando no hay unidades (siempre visible). */}
        {canEditContenido && (
          <InsertUnidadOverlay
            position="bottom"
            hoverGroup="list"
            alwaysVisible={unidades.length === 0}
            onInsert={() => insertUnidadAt(0)}
          />
        )}
      </div>

      <DragDropProvider onDragEnd={handleReorderEnd}>
        <div className={cn('space-y-4', unidades.length === 0 && 'min-h-10')}>
          {unidades.map((unidad, index) => (
            <SortableUnidad
              key={unidad.id}
              id={unidad.id}
              index={index}
              registerContainer={(el) => {
                if (el) unitContainerRefs.current.set(unidad.id, el)
                else unitContainerRefs.current.delete(unidad.id)
              }}
            >
              {({ handleRef }) => (
                <>
                  {canEditContenido && (
                    <InsertUnidadOverlay
                      position="bottom"
                      hoverGroup="unit"
                      onInsert={() => insertUnidadAt(index + 1)}
                    />
                  )}

                  <Card className="border-border gap-0 overflow-hidden py-0 shadow-sm">
                    <Collapsible
                      open={expandedUnits.has(unidad.id)}
                      onOpenChange={() => toggleUnit(unidad.id)}
                    >
                      <CardHeader
                        className={cn(
                          'py-3 transition-colors',
                          expandedUnits.has(unidad.id)
                            ? 'bg-muted/40'
                            : 'hover:bg-muted/30',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {canEditContenido && (
                            <span
                              ref={handleRef}
                              className="text-muted-foreground/50 inline-flex cursor-grab touch-none items-center"
                              aria-label="Reordenar unidad"
                            >
                              <GripVertical className="h-4 w-4" />
                            </span>
                          )}
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              aria-label={
                                expandedUnits.has(unidad.id)
                                  ? 'Colapsar unidad'
                                  : 'Expandir unidad'
                              }
                              className="hover:bg-muted/60 -my-1 flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 pl-1 transition-colors"
                            >
                              <ChevronDown
                                className={cn(
                                  'text-muted-foreground h-5 w-5 shrink-0 transition-transform duration-200',
                                  !expandedUnits.has(unidad.id) && '-rotate-90',
                                )}
                              />
                              <Badge className="font-mono">
                                Unidad {unidad.numero}
                              </Badge>
                            </button>
                          </CollapsibleTrigger>

                          {editingUnit === unidad.id ? (
                            <Input
                              ref={unitTitleInputRef}
                              value={unitDraftNombre}
                              onChange={(e) =>
                                setUnitDraftNombre(e.target.value)
                              }
                              onBlur={() => {
                                if (cancelNextBlurRef.current) {
                                  cancelNextBlurRef.current = false
                                  return
                                }
                                commitEditUnit()
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  e.currentTarget.blur()
                                  return
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault()
                                  cancelNextBlurRef.current = true
                                  cancelEditUnit()
                                  e.currentTarget.blur()
                                }
                              }}
                              className="bg-background h-8 max-w-md"
                            />
                          ) : (
                            <CardTitle
                              className={cn(
                                'text-base font-semibold transition-colors',
                                canEditContenido
                                  ? 'hover:text-primary cursor-pointer'
                                  : 'cursor-default',
                              )}
                              onClick={() => {
                                if (canEditContenido) beginEditUnit(unidad.id)
                              }}
                            >
                              {unidad.nombre}
                            </CardTitle>
                          )}

                          <div className="ml-auto flex items-center gap-3">
                            <span className="text-muted-foreground flex cursor-default items-center gap-1 text-xs font-medium">
                              <Clock className="h-3 w-3" />{' '}
                              {unidad.temas.reduce(
                                (sum, t) => sum + (t.horasEstimadas || 0),
                                0,
                              )}
                              h
                            </span>
                            {canEditContenido && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive h-8 w-8 cursor-pointer"
                                onClick={() =>
                                  setDeleteDialog({
                                    type: 'unidad',
                                    id: unidad.id,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent className="border-border/60 border-t py-4">
                          <div className="border-border/40 ml-10 space-y-1 border-l-2 pl-4">
                            <DragDropProvider
                              onDragEnd={(event) =>
                                handleTemaReorderEnd(unidad.id, event)
                              }
                            >
                              {unidad.temas.map((tema, idx) => (
                                <SortableTema
                                  key={tema.id}
                                  id={tema.id}
                                  index={idx}
                                >
                                  {({ handleRef: temaHandleRef }) => (
                                    <TemaRow
                                      tema={tema}
                                      index={idx + 1}
                                      asignaturaId={asignaturaId}
                                      unidadId={unidad.id}
                                      canManageResources={canEditContenido}
                                      handleRef={temaHandleRef}
                                      isEditing={
                                        !!editingTema &&
                                        editingTema.unitId === unidad.id &&
                                        editingTema.temaId === tema.id
                                      }
                                      draftNombre={temaDraftNombre}
                                      draftHoras={temaDraftHoras}
                                      onBeginEdit={() =>
                                        beginEditTema(unidad.id, tema.id)
                                      }
                                      onDraftNombreChange={setTemaDraftNombre}
                                      onDraftHorasChange={setTemaDraftHoras}
                                      onEditorBlurCapture={
                                        handleTemaEditorBlurCapture
                                      }
                                      onEditorKeyDownCapture={
                                        handleTemaEditorKeyDownCapture
                                      }
                                      onNombreInputRef={(el) => {
                                        temaNombreInputElRef.current = el
                                      }}
                                      onDelete={() =>
                                        setDeleteDialog({
                                          type: 'tema',
                                          id: tema.id,
                                          parentId: unidad.id,
                                        })
                                      }
                                      canEdit={canEditContenido}
                                    />
                                  )}
                                </SortableTema>
                              ))}
                            </DragDropProvider>
                            {canEditContenido && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:bg-accent/50 hover:text-primary mt-2 w-full cursor-pointer justify-start"
                                onClick={() => addTema(unidad.id)}
                              >
                                <Plus className="mr-2 h-3 w-3" /> Añadir subtema
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                </>
              )}
            </SortableUnidad>
          ))}
        </div>
      </DragDropProvider>

      <div className="space-y-3 border-t pt-6">
        <div className="flex items-center gap-2">
          <Library className="text-primary h-5 w-5" />
          <h2 className="text-lg font-semibold">Colección de contenidos</h2>
        </div>
        <ColeccionesSection asignaturaId={asignaturaId} />
      </div>

      <DeleteConfirmDialog
        dialog={deleteDialog}
        setDialog={setDeleteDialog}
        onConfirm={handleDelete}
      />
    </div>
  )
}

// --- Componentes Auxiliares ---
interface TemaRowProps {
  tema: Tema
  index: number
  asignaturaId?: string
  unidadId?: string
  canManageResources?: boolean
  handleRef: (el: HTMLElement | null) => void
  isEditing: boolean
  draftNombre: string
  draftHoras: string
  onBeginEdit: () => void
  onDraftNombreChange: (value: string) => void
  onDraftHorasChange: (value: string) => void
  onEditorBlurCapture: (e: FocusEvent<HTMLDivElement>) => void
  onEditorKeyDownCapture: (e: KeyboardEvent<HTMLDivElement>) => void
  onNombreInputRef: (el: HTMLInputElement | null) => void
  onDelete: () => void
  canEdit: boolean
}

function TemaRow({
  tema,
  index,
  asignaturaId,
  unidadId,
  canManageResources,
  handleRef,
  isEditing,
  draftNombre,
  draftHoras,
  onBeginEdit,
  onDraftNombreChange,
  onDraftHorasChange,
  onEditorBlurCapture,
  onEditorKeyDownCapture,
  onNombreInputRef,
  onDelete,
  canEdit,
}: TemaRowProps) {
  return (
    <div className="space-y-1">
      <div
        className={cn(
          'group flex items-center gap-3 rounded-md p-2 transition-all',
          isEditing ? 'bg-accent/40 ring-ring/30 ring-1' : 'hover:bg-muted/30',
        )}
      >
        <span
          ref={handleRef}
          className={cn(
            'text-muted-foreground/50 inline-flex touch-none items-center',
            canEdit ? 'cursor-grab' : 'cursor-default opacity-30',
          )}
          aria-label="Reordenar tema"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <span className="text-muted-foreground w-4 font-mono text-xs">
          {index}.
        </span>
        {isEditing ? (
          <div
            className="animate-in slide-in-from-left-2 flex flex-1 items-center gap-2"
            onBlurCapture={onEditorBlurCapture}
            onKeyDownCapture={onEditorKeyDownCapture}
          >
            <Input
              ref={onNombreInputRef}
              value={draftNombre}
              onChange={(e) => onDraftNombreChange(e.target.value)}
              className="bg-background h-8 flex-1"
              placeholder="Nombre"
            />
            <Input
              type="number"
              value={draftHoras}
              min={0}
              max={200}
              step={0.5}
              onChange={(e) => onDraftHorasChange(e.target.value)}
              className="bg-background h-8 w-16"
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              className="flex flex-1 cursor-pointer items-center gap-3 text-left"
              onClick={(e) => {
                e.stopPropagation()
                if (!canEdit) return
                onBeginEdit()
              }}
            >
              <p className="text-foreground text-sm font-medium">
                {tema.nombre}
              </p>
              <Badge variant="secondary" className="text-[10px] opacity-60">
                {tema.horasEstimadas}h
              </Badge>
            </button>
            {canEdit && (
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-primary h-7 w-7 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onBeginEdit()
                  }}
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-7 w-7 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {asignaturaId && unidadId && (
        <RecursosTemaPanel
          asignaturaId={asignaturaId}
          unidadId={unidadId}
          temaId={tema.id}
          canManage={Boolean(canManageResources)}
        />
      )}
    </div>
  )
}

interface DeleteDialogState {
  type: 'unidad' | 'tema'
  id: string
  parentId?: string
}

interface DeleteConfirmDialogProps {
  dialog: DeleteDialogState | null
  setDialog: (value: DeleteDialogState | null) => void
  onConfirm: () => void
}

function DeleteConfirmDialog({
  dialog,
  setDialog,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={!!dialog} onOpenChange={() => setDialog(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
          <AlertDialogDescription>
            Estás a punto de borrar un {dialog?.type}. Esta acción no se puede
            deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
