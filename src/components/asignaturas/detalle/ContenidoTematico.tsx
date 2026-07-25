import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { useParams } from '@tanstack/react-router'
import {
  Plus,
  GripVertical,
  ChevronDown,
  Trash2,
  Clock,
  Library,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type {
  PayloadMejorarCampo,
  PayloadNombrarTema,
  PayloadNombrarUnidad,
  PayloadReubicarUnidad,
  ResultadoMejorarCampo,
  ResultadoNombrarTema,
  ResultadoNombrarUnidad,
  ResultadoReubicarUnidad,
} from '@/data'
import type { ContenidoApi, ContenidoTemaApi } from '@/data/api/subjects.api'
import type { OpcionesAccionAgente } from '@/features/agente'
import type { ReactNode } from 'react'

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EditableNumber } from '@/components/ui/editable-number'
import { EditableText } from '@/components/ui/editable-text'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlan } from '@/data'
import {
  requestAdminOverrideReason,
  useAsignaturaCapabilities,
} from '@/data/auth/planCapabilities'
import { useSubject, useUpdateSubjectContenido } from '@/data/hooks/useSubjects'
import {
  AccionAgente,
  idCampoAgente,
  useAccionAgente,
  useColoresLineas,
} from '@/features/agente'
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

/** Referencia mutable al elemento que creó una acción, para poder deshacerla. */
type Creado = { id: string | null }

function InsertUnidadOverlay({
  onInsert,
  position,
  hoverGroup = 'unit',
  alwaysVisible = false,
  opcionesAgente,
}: {
  onInsert: () => void
  position: 'top' | 'bottom'
  hoverGroup?: 'list' | 'unit'
  alwaysVisible?: boolean
  /** En modo agente el mismo botón pide a la IA el título de la unidad nueva. */
  opcionesAgente: OpcionesAccionAgente<ResultadoNombrarUnidad, Creado>
}) {
  const agente = useAccionAgente(opcionesAgente)

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
          // Mientras la IA piensa el título, el botón no puede desvanecerse: es
          // el único sitio donde se ve que la acción está en curso.
          alwaysVisible || agente.ejecutando ? 'opacity-100' : 'opacity-0',
          hoverGroup === 'list'
            ? 'group-hover/list:opacity-100'
            : 'group-hover/unit:opacity-100',
          agente.halo.className,
        )}
        style={agente.halo.style}
        onClick={(e) => {
          e.stopPropagation()
          onInsert()
        }}
        {...agente.props}
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

/**
 * Contenido de la BD → borrador editable del editor. Solo se ejecuta al
 * montar el editor (carga inicial o cambio de asignatura vía key-remount);
 * los ids ya son persistentes en la BD y `mapContenidoItem` garantiza uno.
 */
function unidadesFromDb(value: unknown): Array<UnidadTematica> {
  return mapContenidoTematicoFromDb(value).map((u, idx) => ({
    id: u.id || createClientId(`u-${u.unidad || idx + 1}`),
    numero: u.unidad || idx + 1,
    nombre: u.titulo || 'Sin título',
    temas: u.temas.map((t, tidx) =>
      typeof t === 'string'
        ? {
            id: createClientId(`t-${u.unidad || idx + 1}-${tidx + 1}`),
            nombre: t || 'Tema',
            horasEstimadas: 0,
          }
        : {
            id: t.id || createClientId(`t-${u.unidad || idx + 1}-${tidx + 1}`),
            nombre: t.nombre || 'Tema',
            horasEstimadas: t.horasEstimadas ?? 0,
            descripcion: t.descripcion,
          },
    ),
  }))
}

export function ContenidoTematico() {
  const { asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { data, isLoading } = useSubject(asignaturaId)

  if (isLoading)
    return <div className="p-10 text-center">Cargando contenido...</div>

  // key-remount: al cambiar de asignatura el editor renace desde la query.
  // Mientras se edita, el borrador local es el dueño del estado y la mutación
  // hace write-through a la caché al guardar.
  return (
    <ContenidoTematicoEditor
      key={asignaturaId}
      contenidoInicial={data?.contenido_tematico}
      asignaturaNombre={data?.nombre ?? ''}
    />
  )
}

function ContenidoTematicoEditor({
  contenidoInicial,
  asignaturaNombre,
}: {
  contenidoInicial: unknown
  /** Contexto mínimo que el agente necesita para nombrar unidades y temas. */
  asignaturaNombre: string
}) {
  const updateContenido = useUpdateSubjectContenido()
  const { asignaturaId, planId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { data: plan } = usePlan(planId)
  const capabilities = useAsignaturaCapabilities(plan, asignaturaId)
  const canEditContenido = capabilities.canEditAsignaturas
  const puedeAgentar = canEditContenido && capabilities.canUseIA
  const colores = useColoresLineas(planId)

  // Borrador de edición acotado: nace de la query al montar y no se resiembra
  // en cada respuesta del servidor (el guardado ya es write-through).
  const [unidades, setUnidades] = useState<Array<UnidadTematica>>(() =>
    unidadesFromDb(contenidoInicial),
  )
  // La primera unidad llega expandida al entrar a la ruta.
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(() =>
    unidades.length > 0 ? new Set([unidades[0].id]) : new Set(),
  )
  const unitContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [pendingScrollUnitId, setPendingScrollUnitId] = useState<string | null>(
    null,
  )
  const [deleteDialog, setDeleteDialog] = useState<{
    type: 'unidad' | 'tema'
    id: string
    parentId?: string
  } | null>(null)
  const [coleccionOpen, setColeccionOpen] = useState(false)

  const persistUnidades = async (nextUnidades: Array<UnidadTematica>) => {
    if (!canEditContenido) return
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'editar el contenido tematico fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    const payload = serializeUnidadesToApi(nextUnidades)
    await updateContenido.mutateAsync({
      subjectId: asignaturaId,
      unidades: payload,
      adminOverrideReason,
    })
  }

  const expandUnit = (unitId: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev)
      next.add(unitId)
      return next
    })
  }

  /**
   * Punto único de escritura del temario: mueve el borrador y guarda. Las
   * acciones del agente lo esperan (`await`) porque deshacer sólo puede
   * prometer una reversión real si el guardado llegó a completarse.
   */
  const aplicarUnidades = async (next: Array<UnidadTematica>) => {
    setUnidades(next)
    await persistUnidades(next)
  }

  const escribirNombreUnidad = async (unitId: string, nombre: string) => {
    const trimmed = nombre.trim()
    if (!trimmed) return
    await aplicarUnidades(
      unidades.map((u) => (u.id === unitId ? { ...u, nombre: trimmed } : u)),
    )
  }

  const handleSaveUnitName = (unitId: string, nombre: string) => {
    if (!canEditContenido) return
    const trimmed = nombre.trim()
    if (!trimmed) return
    const unit = unidades.find((u) => u.id === unitId)
    if (unit && unit.nombre === trimmed) return
    void escribirNombreUnidad(unitId, trimmed)
  }

  const escribirTema = async (
    unitId: string,
    temaId: string,
    changes: { nombre?: string; horasEstimadas?: number },
  ) => {
    const tema = unidades
      .find((u) => u.id === unitId)
      ?.temas.find((t) => t.id === temaId)
    if (!tema) return

    const nextNombre = changes.nombre?.trim() || tema.nombre
    const nextHoras = changes.horasEstimadas ?? tema.horasEstimadas ?? 0

    if (tema.nombre === nextNombre && (tema.horasEstimadas ?? 0) === nextHoras)
      return

    await aplicarUnidades(
      unidades.map((u) =>
        u.id !== unitId
          ? u
          : {
              ...u,
              temas: u.temas.map((t) =>
                t.id === temaId
                  ? { ...t, nombre: nextNombre, horasEstimadas: nextHoras }
                  : t,
              ),
            },
      ),
    )
  }

  const handleSaveTema = (
    unitId: string,
    temaId: string,
    changes: { nombre?: string; horasEstimadas?: number },
  ) => {
    if (!canEditContenido) return
    void escribirTema(unitId, temaId, changes)
  }

  // Sincronización con el DOM: la unidad recién insertada aún no existe al
  // momento del click, así que el scroll espera a que se monte su contenedor.
  useEffect(() => {
    if (!pendingScrollUnitId) return
    const el = unitContainerRefs.current.get(pendingScrollUnitId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setPendingScrollUnitId(null)
  }, [pendingScrollUnitId, unidades.length])

  // Cálculo de horas (dinámico basado en el borrador del editor)
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

  const insertUnidadAt = async (
    insertIndex: number,
    nombre = 'Nueva Unidad',
  ): Promise<string | null> => {
    if (!canEditContenido) return null
    const newId = createClientId('u')
    const newUnidad: UnidadTematica = {
      id: newId,
      nombre: nombre.trim() || 'Nueva Unidad',
      numero: 0,
      temas: [],
    }

    const clampedIndex = Math.max(0, Math.min(insertIndex, unidades.length))
    const next = renumberUnidades([
      ...unidades.slice(0, clampedIndex),
      newUnidad,
      ...unidades.slice(clampedIndex),
    ])

    setExpandedUnits((prev) => {
      const n = new Set(prev)
      n.add(newId)
      return n
    })
    setPendingScrollUnitId(newId)

    await aplicarUnidades(next)
    return newId
  }

  const eliminarUnidad = (unitId: string) =>
    aplicarUnidades(renumberUnidades(unidades.filter((u) => u.id !== unitId)))

  const eliminarTema = (unidadId: string, temaId: string) =>
    aplicarUnidades(
      unidades.map((u) =>
        u.id === unidadId
          ? { ...u, temas: u.temas.filter((t) => t.id !== temaId) }
          : u,
      ),
    )

  /** Saca una unidad de su posición y la reinserta en `posicion` (1-based). */
  const reubicarUnidad = async (unitId: string, posicion: number) => {
    const desde = unidades.findIndex((u) => u.id === unitId)
    if (desde < 0) return
    const hasta = Math.max(0, Math.min(posicion - 1, unidades.length - 1))
    if (hasta === desde) return
    await aplicarUnidades(renumberUnidades(arrayMove(unidades, desde, hasta)))
  }

  /** Mueve un tema dentro de su unidad o a otra unidad, en `posicion` (1-based). */
  const reubicarTema = async (
    origenId: string,
    temaId: string,
    destinoId: string,
    posicion: number,
  ) => {
    const tema = unidades
      .find((u) => u.id === origenId)
      ?.temas.find((t) => t.id === temaId)
    if (!tema) return
    if (!unidades.some((u) => u.id === destinoId)) return

    const sinTema = unidades.map((u) =>
      u.id === origenId
        ? { ...u, temas: u.temas.filter((t) => t.id !== temaId) }
        : u,
    )
    const next = sinTema.map((u) => {
      if (u.id !== destinoId) return u
      const temas = u.temas.slice()
      temas.splice(Math.max(0, Math.min(posicion - 1, temas.length)), 0, tema)
      return { ...u, temas }
    })

    setExpandedUnits((prev) => {
      const n = new Set(prev)
      n.add(destinoId)
      return n
    })
    await aplicarUnidades(next)
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
  /**
   * Añade un tema al final de la unidad y devuelve su id.
   *
   * `valores` distingue las dos vías: a mano el tema nace en blanco y se guarda
   * cuando el usuario escribe su nombre —comportamiento previo, intacto—;
   * el agente lo entrega ya nombrado, y ahí sí se persiste, porque un cambio
   * del agente que no sobrevive a una recarga haría mentir a "deshacer".
   */
  const addTema = async (
    unidadId: string,
    valores?: { nombre: string; horasEstimadas: number },
  ): Promise<string | null> => {
    if (!canEditContenido) return null
    const unit = unidades.find((u) => u.id === unidadId)
    const unitNumero = unit?.numero ?? 0
    const newTemaIndex = (unit?.temas.length ?? 0) + 1
    const newTemaId = `t-${unitNumero}-${newTemaIndex}`
    const newTema: Tema = {
      id: newTemaId,
      nombre: valores?.nombre.trim() || 'Nuevo tema',
      horasEstimadas: valores?.horasEstimadas ?? 2,
    }

    const next = unidades.map((u) =>
      u.id === unidadId ? { ...u, temas: [...u.temas, newTema] } : u,
    )

    // Expandir unidad para mostrar el nuevo subtema
    setExpandedUnits((prev) => {
      const n = new Set(prev)
      n.add(unidadId)
      return n
    })

    if (valores) await aplicarUnidades(next)
    else setUnidades(next)

    return newTemaId
  }

  const handleDelete = () => {
    if (!canEditContenido) return
    if (!deleteDialog) return
    const { type, id, parentId } = deleteDialog
    setDeleteDialog(null)
    if (type === 'unidad') void eliminarUnidad(id)
    else if (parentId) void eliminarTema(parentId, id)
    // toast.success("Eliminado correctamente");
  }

  // --- Acciones del modo agente ---
  // El temario entero viaja en cada acción: dónde va una unidad, cómo se llama
  // la siguiente o qué tema falta son preguntas que sólo se pueden responder
  // leyendo el conjunto, no el elemento aislado.
  const contextoContenido = () => ({
    asignatura_id: asignaturaId,
    asignatura_nombre: asignaturaNombre,
    unidades: unidades.map((u) => ({
      id: u.id,
      numero: u.numero,
      titulo: u.nombre,
      temas: u.temas.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        horas_estimadas: t.horasEstimadas ?? 0,
      })),
    })),
  })

  const opcionesReubicarUnidad = (
    unidad: UnidadTematica,
  ): OpcionesAccionAgente<ResultadoReubicarUnidad, Array<UnidadTematica>> => ({
    id: `contenido:unidad:${unidad.id}:reubicar`,
    accion: 'reubicar_unidad',
    etiqueta: `Reubicar «${unidad.nombre}»`,
    ariaLabel: `Reubicar la unidad ${unidad.numero} con IA`,
    disabled: !puedeAgentar,
    colores,
    payload: () =>
      ({
        ...contextoContenido(),
        unidad_id: unidad.id,
      }) satisfies PayloadReubicarUnidad,
    // El temario completo como snapshot: renumerar unidades toca a todas, así
    // que guardar sólo la posición de una dejaría el resto sin revertir.
    snapshot: () => unidades,
    aplicar: (resultado) => reubicarUnidad(unidad.id, resultado.posicion),
    restaurar: (previas) => aplicarUnidades(previas),
  })

  const opcionesNombreUnidad = (
    unidad: UnidadTematica,
  ): OpcionesAccionAgente<ResultadoMejorarCampo, string> => ({
    id: idCampoAgente('unidad', unidad.id, 'titulo'),
    accion: 'mejorar_campo',
    etiqueta: `Ajustar el nombre de la unidad ${unidad.numero}`,
    ariaLabel: `Ajustar el nombre de la unidad ${unidad.numero} con IA`,
    disabled: !puedeAgentar,
    colores,
    payload: () =>
      ({
        entidad: 'asignatura',
        entidad_id: asignaturaId,
        clave: `contenido_tematico.${unidad.id}.titulo`,
        label: `Nombre de la unidad ${unidad.numero} de «${asignaturaNombre}»`,
        ayuda: 'Título de una unidad del contenido temático de la asignatura.',
        contenido_actual: unidad.nombre,
        es_richtext: false,
      }) satisfies PayloadMejorarCampo,
    snapshot: () => unidad.nombre,
    aplicar: (resultado) =>
      escribirNombreUnidad(unidad.id, resultado.contenido),
    restaurar: (previo) => escribirNombreUnidad(unidad.id, previo),
  })

  const opcionesNuevaUnidad = (
    insertIndex: number,
  ): OpcionesAccionAgente<ResultadoNombrarUnidad, Creado> => ({
    id: `contenido:unidad:nueva:${insertIndex}`,
    accion: 'nombrar_unidad',
    etiqueta: 'Añadir una unidad',
    ariaLabel: 'Añadir una unidad con IA',
    disabled: !puedeAgentar,
    colores,
    payload: () =>
      ({
        ...contextoContenido(),
        posicion: insertIndex + 1,
      }) satisfies PayloadNombrarUnidad,
    // El id sólo existe después de crearla; se anota en el propio snapshot para
    // que deshacer sepa a cuál quitar.
    snapshot: () => ({ id: null }),
    aplicar: async (resultado, creado) => {
      creado.id = await insertUnidadAt(insertIndex, resultado.titulo)
    },
    restaurar: async (creado) => {
      if (creado.id) await eliminarUnidad(creado.id)
    },
  })

  const opcionesNuevoTema = (
    unidad: UnidadTematica,
  ): OpcionesAccionAgente<ResultadoNombrarTema, Creado> => ({
    id: `contenido:tema:nuevo:${unidad.id}`,
    accion: 'nombrar_tema',
    etiqueta: `Añadir un tema a «${unidad.nombre}»`,
    ariaLabel: `Añadir un tema con IA a la unidad ${unidad.numero}`,
    disabled: !puedeAgentar,
    colores,
    payload: () =>
      ({
        ...contextoContenido(),
        unidad_id: unidad.id,
      }) satisfies PayloadNombrarTema,
    snapshot: () => ({ id: null }),
    aplicar: async (resultado, creado) => {
      creado.id = await addTema(unidad.id, {
        nombre: resultado.nombre,
        horasEstimadas: resultado.horas_estimadas,
      })
    },
    restaurar: async (creado) => {
      if (creado.id) await eliminarTema(unidad.id, creado.id)
    },
  })

  const opcionesReubicarTema = (
    unidad: UnidadTematica,
    tema: Tema,
  ): OpcionesAccionAgente<ResultadoReubicarUnidad, Array<UnidadTematica>> => ({
    id: `contenido:tema:${tema.id}:reubicar`,
    accion: 'reubicar_unidad',
    etiqueta: `Reubicar «${tema.nombre}»`,
    ariaLabel: `Reubicar el tema «${tema.nombre}» con IA`,
    disabled: !puedeAgentar,
    colores,
    payload: () =>
      ({
        ...contextoContenido(),
        unidad_id: unidad.id,
        tema_id: tema.id,
      }) satisfies PayloadReubicarUnidad,
    snapshot: () => unidades,
    aplicar: (resultado) =>
      reubicarTema(
        unidad.id,
        tema.id,
        resultado.unidad_destino_id ?? unidad.id,
        resultado.posicion,
      ),
    restaurar: (previas) => aplicarUnidades(previas),
  })

  const opcionesNombreTema = (
    unidad: UnidadTematica,
    tema: Tema,
    numero: number,
  ): OpcionesAccionAgente<ResultadoMejorarCampo, string> => ({
    id: idCampoAgente('tema', tema.id, 'nombre'),
    accion: 'mejorar_campo',
    etiqueta: `Ajustar el nombre del tema ${numero}`,
    ariaLabel: `Ajustar el nombre del tema ${numero} con IA`,
    disabled: !puedeAgentar,
    colores,
    payload: () =>
      ({
        entidad: 'asignatura',
        entidad_id: asignaturaId,
        clave: `contenido_tematico.${unidad.id}.temas.${tema.id}.nombre`,
        label: `Tema ${numero} de la unidad «${unidad.nombre}»`,
        ayuda: 'Nombre de un tema dentro de una unidad del contenido temático.',
        contenido_actual: tema.nombre,
        es_richtext: false,
      }) satisfies PayloadMejorarCampo,
    snapshot: () => tema.nombre,
    aplicar: (resultado) =>
      escribirTema(unidad.id, tema.id, { nombre: resultado.contenido }),
    restaurar: (previo) => escribirTema(unidad.id, tema.id, { nombre: previo }),
  })

  const opcionesHorasTema = (
    unidad: UnidadTematica,
    tema: Tema,
    numero: number,
  ): OpcionesAccionAgente<ResultadoMejorarCampo, number> => ({
    id: idCampoAgente('tema', tema.id, 'horas'),
    accion: 'mejorar_campo',
    etiqueta: `Ajustar las horas del tema ${numero}`,
    ariaLabel: `Ajustar las horas estimadas del tema ${numero} con IA`,
    disabled: !puedeAgentar,
    colores,
    payload: () =>
      ({
        entidad: 'asignatura',
        entidad_id: asignaturaId,
        clave: `contenido_tematico.${unidad.id}.temas.${tema.id}.horasEstimadas`,
        label: `Horas estimadas del tema «${tema.nombre}»`,
        ayuda: `Horas que se dedican a este tema dentro de la unidad «${unidad.nombre}».`,
        contenido_actual: String(tema.horasEstimadas ?? 0),
        es_richtext: false,
        minimo: 0,
        maximo: 200,
      }) satisfies PayloadMejorarCampo,
    snapshot: () => tema.horasEstimadas ?? 0,
    aplicar: (resultado) => {
      const horas = Number(resultado.contenido)
      if (!Number.isFinite(horas)) {
        throw new Error('La IA devolvió unas horas que no son un número.')
      }
      return escribirTema(unidad.id, tema.id, { horasEstimadas: horas })
    },
    restaurar: (previo) =>
      escribirTema(unidad.id, tema.id, { horasEstimadas: previo }),
  })

  return (
    <div className="animate-in fade-in space-y-6 pb-8 duration-500">
      <div className="group/list relative flex items-center justify-between gap-3 border-b pb-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setColeccionOpen(true)}
        >
          <Library className="mr-1.5 h-4 w-4" />
          Ver contenidos
        </Button>

        {/* Insertar unidad en posición 0: visible sólo al hover de este header,
            excepto cuando no hay unidades (siempre visible). */}
        {canEditContenido && (
          <InsertUnidadOverlay
            position="bottom"
            hoverGroup="list"
            alwaysVisible={unidades.length === 0}
            onInsert={() => void insertUnidadAt(0)}
            opcionesAgente={opcionesNuevaUnidad(0)}
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
                      onInsert={() => void insertUnidadAt(index + 1)}
                      opcionesAgente={opcionesNuevaUnidad(index + 1)}
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
                            <AccionAgente
                              opciones={opcionesReubicarUnidad(unidad)}
                            >
                              {(agente) => (
                                <span
                                  ref={handleRef}
                                  className={cn(
                                    'text-muted-foreground/50 inline-flex touch-none items-center',
                                    agente.enModoAgente
                                      ? 'cursor-pointer'
                                      : 'cursor-grab',
                                    agente.halo.className,
                                  )}
                                  style={agente.halo.style}
                                  aria-label="Reordenar unidad"
                                  // En modo agente el asa deja de arrastrar y le
                                  // pregunta a la IA dónde debería ir la unidad.
                                  // No puede convertirse en un <button> real:
                                  // dnd-kit necesita este mismo nodo como
                                  // activador del arrastre fuera del modo.
                                  {...(agente.enModoAgente
                                    ? { role: 'button', tabIndex: 0 }
                                    : {})}
                                  {...agente.props}
                                >
                                  <GripVertical className="h-4 w-4" />
                                </span>
                              )}
                            </AccionAgente>
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

                          <AccionAgente opciones={opcionesNombreUnidad(unidad)}>
                            {(agente) => (
                              <CardTitle className="text-base font-semibold">
                                {agente.ejecutando ? (
                                  <Skeleton className="h-5 w-52" />
                                ) : (
                                  <span
                                    className={cn(
                                      'block',
                                      agente.enModoAgente &&
                                        'cursor-pointer rounded-md',
                                    )}
                                    {...agente.props}
                                  >
                                    <EditableText
                                      value={unidad.nombre}
                                      onSave={(nombre) =>
                                        handleSaveUnitName(unidad.id, nombre)
                                      }
                                      editable={canEditContenido}
                                      onEditStart={() => expandUnit(unidad.id)}
                                      ariaLabel={
                                        agente.enModoAgente
                                          ? `Ajustar el nombre de la unidad ${unidad.numero} con IA`
                                          : `Nombre de la unidad ${unidad.numero}`
                                      }
                                      className={cn(
                                        'text-base font-semibold transition-colors',
                                        canEditContenido
                                          ? 'hover:text-primary'
                                          : 'cursor-default',
                                      )}
                                    />
                                  </span>
                                )}
                              </CardTitle>
                            )}
                          </AccionAgente>

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
                          <div className="ml-10 space-y-1">
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
                                      onSave={(changes) =>
                                        handleSaveTema(
                                          unidad.id,
                                          tema.id,
                                          changes,
                                        )
                                      }
                                      onEditStart={() => expandUnit(unidad.id)}
                                      onDelete={() =>
                                        setDeleteDialog({
                                          type: 'tema',
                                          id: tema.id,
                                          parentId: unidad.id,
                                        })
                                      }
                                      canEdit={canEditContenido}
                                      opcionesNombre={opcionesNombreTema(
                                        unidad,
                                        tema,
                                        idx + 1,
                                      )}
                                      opcionesHoras={opcionesHorasTema(
                                        unidad,
                                        tema,
                                        idx + 1,
                                      )}
                                      opcionesReubicar={opcionesReubicarTema(
                                        unidad,
                                        tema,
                                      )}
                                    />
                                  )}
                                </SortableTema>
                              ))}
                            </DragDropProvider>
                            {canEditContenido && (
                              <AccionAgente
                                opciones={opcionesNuevoTema(unidad)}
                              >
                                {(agente) => (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                      'text-primary hover:bg-accent/50 hover:text-primary mt-2 w-full cursor-pointer justify-start',
                                      agente.halo.className,
                                    )}
                                    style={agente.halo.style}
                                    onClick={() => void addTema(unidad.id)}
                                    {...agente.props}
                                  >
                                    <Plus className="mr-2 h-3 w-3" /> Añadir
                                    subtema
                                  </Button>
                                )}
                              </AccionAgente>
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

      <Dialog open={coleccionOpen} onOpenChange={setColeccionOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Colección de contenidos</DialogTitle>
            <DialogDescription>
              Selecciona varios contenidos y descárgalos juntos.
            </DialogDescription>
          </DialogHeader>
          <ColeccionesSection asignaturaId={asignaturaId} />
        </DialogContent>
      </Dialog>

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
  onSave: (changes: { nombre?: string; horasEstimadas?: number }) => void
  onEditStart?: () => void
  onDelete: () => void
  canEdit: boolean
  /**
   * Las tres acciones del agente sobre un tema. Llegan como opciones —y no como
   * callbacks ya resueltos— porque `TemaRow` es quien puede llamar a los hooks:
   * dentro del `map` del editor no se puede.
   */
  opcionesNombre: OpcionesAccionAgente<ResultadoMejorarCampo, string>
  opcionesHoras: OpcionesAccionAgente<ResultadoMejorarCampo, number>
  opcionesReubicar: OpcionesAccionAgente<
    ResultadoReubicarUnidad,
    Array<UnidadTematica>
  >
}

function TemaRow({
  tema,
  index,
  asignaturaId,
  unidadId,
  canManageResources,
  handleRef,
  onSave,
  onEditStart,
  onDelete,
  canEdit,
  opcionesNombre,
  opcionesHoras,
  opcionesReubicar,
}: TemaRowProps) {
  const agenteNombre = useAccionAgente(opcionesNombre)
  const agenteHoras = useAccionAgente(opcionesHoras)
  const agenteReubicar = useAccionAgente(opcionesReubicar)

  return (
    <div className="group hover:bg-muted/30 flex items-center gap-3 rounded-md p-2 transition-all">
      <span
        ref={handleRef}
        className={cn(
          'text-muted-foreground/50 inline-flex touch-none items-center',
          canEdit ? 'cursor-grab' : 'cursor-default opacity-30',
          agenteReubicar.enModoAgente && 'cursor-pointer',
          agenteReubicar.halo.className,
        )}
        style={agenteReubicar.halo.style}
        aria-label="Reordenar tema"
        // Ver la nota del asa de la unidad: en modo agente reubica con IA, pero
        // sigue siendo el nodo que dnd-kit necesita para arrastrar.
        {...(agenteReubicar.enModoAgente
          ? { role: 'button', tabIndex: 0 }
          : {})}
        {...agenteReubicar.props}
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="text-muted-foreground w-4 font-mono text-xs">
        {index}.
      </span>

      {agenteNombre.ejecutando ? (
        <Skeleton className="h-4 min-w-0 flex-1" />
      ) : (
        <span
          className={cn(
            'block min-w-0 flex-1',
            agenteNombre.enModoAgente && 'cursor-pointer rounded-md',
          )}
          {...agenteNombre.props}
        >
          <EditableText
            value={tema.nombre}
            onSave={(nombre) => onSave({ nombre })}
            onEditStart={onEditStart}
            editable={canEdit}
            ariaLabel={
              agenteNombre.enModoAgente
                ? `Ajustar el nombre del tema ${index} con IA`
                : `Nombre del tema ${index}`
            }
            className="block w-full text-sm font-medium"
          />
        </span>
      )}

      {agenteHoras.ejecutando ? (
        <Skeleton className="h-4 w-10" />
      ) : (
        <span
          className={cn(
            'flex items-center',
            agenteHoras.enModoAgente && 'cursor-pointer',
          )}
          {...agenteHoras.props}
        >
          <EditableNumber
            value={tema.horasEstimadas ?? 0}
            onSave={(horas) => onSave({ horasEstimadas: horas ?? 0 })}
            onEditStart={onEditStart}
            min={0}
            max={200}
            step={0.5}
            editable={canEdit}
            suffix="h"
            ariaLabel={
              agenteHoras.enModoAgente
                ? `Ajustar las horas del tema ${index} con IA`
                : 'Horas estimadas'
            }
            // En modo agente el clic ya no incrementa: los pasos +/− prometerían
            // algo que no va a pasar.
            showControls={!agenteHoras.enModoAgente}
            className="text-xs"
          />
        </span>
      )}

      {/* Slot de ancho fijo: mantiene las horas alineadas haya o no contenidos. */}
      {asignaturaId && unidadId && (
        <div className="flex w-12 shrink-0 justify-center">
          <RecursosTemaPanel
            asignaturaId={asignaturaId}
            unidadId={unidadId}
            temaId={tema.id}
            canManage={Boolean(canManageResources)}
          />
        </div>
      )}

      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-7 w-7 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
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
