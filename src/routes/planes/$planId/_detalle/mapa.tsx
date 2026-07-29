import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  Calculator,
  Download,
  GitBranch,
  Hash,
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  useMemo,
  useState,
  useEffect,
  Fragment,
  useRef,
  useLayoutEffect,
  useCallback,
  lazy,
  Suspense,
} from 'react'

import type {
  AsignaturaMapa,
  ContextoMapa,
  PayloadAjustarCreditosHoras,
  PayloadAsignarAsignatura,
  PayloadMejorarCampo,
  PayloadOrdenarLineas,
  PayloadProponerPrerrequisito,
  PayloadProponerLinea,
  PayloadProponerParaCelda,
  PayloadReorganizarMapa,
  ResultadoAjustarCreditosHoras,
  ResultadoAsignarAsignatura,
  ResultadoMejorarCampo,
  ResultadoOrdenarLineas,
  ResultadoProponerPrerrequisito,
  ResultadoProponerLinea,
  ResultadoProponerParaCelda,
  ResultadoReorganizarMapa,
  TipoAsignatura,
} from '@/data'
import type { OpcionesAccionAgente } from '@/features/agente'
import type { Asignatura } from '@/types/plan'
import type { CSSProperties } from 'react'

import { AlertaConflicto } from '@/components/asignaturas/detalle/mapa/AlertaConflicto'
import AsignaturaCardItem from '@/components/planes/detalle/mapa/AsignaturaCardItem'
import { showAppAlert, showAppConfirm } from '@/components/ui/app-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EditableNumber } from '@/components/ui/editable-number'
import { EditableSelect } from '@/components/ui/editable-select'
import { EditableText } from '@/components/ui/editable-text'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PanelLateralHeader } from '@/components/ui/panel-lateral'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { MapTabSkeleton } from '@/components/ui/route-pending-skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useCreateLinea,
  useDeleteLinea,
  usePlan,
  usePlanAsignaturas,
  usePlanLineas,
  useUpdateAsignatura,
  useUpdateLinea,
  useUpdatePlanFields,
} from '@/data'
import { fetchPlanExcel } from '@/data/api/document.api'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import { useLineasSugeridas } from '@/data/hooks/useMeta'
import { AccionAgente, useAccionAgente } from '@/features/agente'
import {
  Flip,
  gsap,
  organicDuration,
  organicEase,
  prefersReducedMotion,
} from '@/lib/animations'
import { formatCiclo, nombreTipoCiclo } from '@/lib/ciclo-utils'
import { HORAS_POR_CREDITO } from '@/lib/creditos-utils'
import { getPlanDisplayName } from '@/lib/plan-display'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { generarColorContrastante } from '@/utils/colors'

const VisualizadorSeriacionModal = lazy(() =>
  import('@/components/planes/detalle/mapa/VisualizadorSeriacionModal').then(
    (m) => ({ default: m.VisualizadorSeriacionModal }),
  ),
)

// --- Mapeadores (Fuera del componente para mayor limpieza) ---
const palette = [
  '#4F46E5', // índigo
  '#7C3AED', // violeta
  '#EA580C', // naranja
  '#059669', // esmeralda
  '#DC2626', // rojo
  '#0891B2', // cyan
  '#CA8A04', // ámbar
  '#C026D3', // fucsia
]

type LineaCurricularUI = {
  id: string
  nombre: string
  orden: number
  color: string
  /**
   * Descripción del bloque de conocimiento que la línea representa. Es un solo
   * texto libre: las tres preguntas que antes eran tres campos obligatorios
   * (qué cuerpo de conocimiento organiza, qué aporta al perfil de egreso, qué
   * queda fuera) viven ahora en el placeholder, porque son una guía para
   * escribir, no un formulario que rellenar.
   */
  descripcion: string
}

/**
 * Texto único del bloque a partir de la fila. `proposito` es la columna
 * canónica; `aporte_perfil_egreso` y `alcance_formativo` son de la versión
 * anterior —que pedía los tres por separado— y se conservan al leer para no
 * perder lo ya escrito. Al guardar se consolidan en `proposito` y las otras
 * dos quedan a null.
 */
const descripcionDeLinea = (linea: {
  proposito?: string | null
  aporte_perfil_egreso?: string | null
  alcance_formativo?: string | null
}): string =>
  [linea.proposito, linea.aporte_perfil_egreso, linea.alcance_formativo]
    .map((parte) => (parte ?? '').trim())
    .filter(Boolean)
    .join('\n\n')

const PLACEHOLDER_BLOQUE =
  'Qué cuerpo de conocimiento organiza, qué aporta al perfil de egreso y qué queda fuera.'

type CardRect = {
  x: number
  y: number
  width: number
  height: number
}

const mapLineasToLineaCurricular = (
  lineasApi: Array<any> = [],
): Array<LineaCurricularUI> => {
  return lineasApi.map((linea, index) => ({
    id: linea.id,
    nombre: linea.nombre,
    orden: linea.orden ?? 0,
    color: linea.color ?? palette[index % palette.length],
    descripcion: descripcionDeLinea(linea),
  }))
}

const mapAsignaturasToAsignaturas = (
  asigApi: Array<any> = [],
): Array<Asignatura> => {
  return asigApi.map((asig) => {
    return {
      id: asig.id,
      clave: asig.codigo,
      nombre: asig.nombre,
      creditos: asig.creditos ?? 0,
      ciclo: asig.numero_ciclo ?? null,
      lineaCurricularId: asig.linea_plan_id ?? null,
      tipo: asig.tipo,
      estado: 'borrador',
      orden: asig.orden_celda ?? 0,
      // Mapeo directo de los nuevos campos de la API
      hd: asig.horas_academicas ?? 0,
      hi: asig.horas_independientes ?? 0,
      prerrequisito_asignatura_id: asig.prerrequisito_asignatura_id ?? null,
    }
  })
}

/** Posición de una asignatura en el mapa: lo mínimo para deshacer un movimiento. */
type PosicionAsignatura = {
  id: string
  ciclo: number | null
  lineaCurricularId: string | null
}

// --- Subcomponentes ---
// Asignación directa desde la celda: un `+` discreto que abre un buscador con
// las asignaturas pendientes. Solo se renderiza mientras quede alguna.
//
// En modo agente ese mismo `+` deja de abrir el buscador y le pide a la IA que
// elija la pendiente que encaja en esta línea y este ciclo. Es la celda —y no un
// aviso global— quien muestra el rechazo razonado, porque el motivo depende de
// la celda concreta ("ninguna pendiente encaja en Ciencias básicas, 1.º").
function CeldaAgregarAsignatura({
  disponibles,
  ariaLabel,
  onSelect,
  opcionesAgente,
}: {
  disponibles: Array<Asignatura>
  ariaLabel: string
  onSelect: (asignaturaId: string) => void
  opcionesAgente: OpcionesAccionAgente<
    ResultadoProponerParaCelda,
    PosicionAsignatura
  >
}) {
  const [open, setOpen] = useState(false)
  const agente = useAccionAgente(opcionesAgente)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={ariaLabel}
              className={cn(
                'flex min-h-9 w-full flex-1 items-center justify-center rounded-lg transition-colors',
                'text-muted-foreground/20 hover:text-foreground hover:bg-muted/50',
                'focus-visible:ring-ring/40 focus-visible:text-foreground focus-visible:ring-2 focus-visible:outline-none',
                open && 'text-foreground bg-muted/50',
                agente.halo.className,
              )}
              style={agente.halo.style}
              {...agente.props}
            >
              <Plus
                className={cn('h-4 w-4', agente.ejecutando && 'animate-pulse')}
                aria-hidden
              />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {agente.enModoAgente
            ? 'Que la IA elija una pendiente para esta celda'
            : 'Asignar aquí una pendiente'}
        </TooltipContent>
      </Tooltip>

      {agente.rechazo && (
        <p className="text-muted-foreground animate-in fade-in px-1 pb-1 text-[11px] leading-snug">
          {agente.rechazo}
        </p>
      )}
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar asignatura pendiente..." />
          <CommandList>
            <CommandEmpty>Sin coincidencias.</CommandEmpty>
            <CommandGroup>
              {disponibles.map((asignatura) => (
                <CommandItem
                  key={asignatura.id}
                  value={`${asignatura.clave} ${asignatura.nombre}`}
                  onSelect={() => {
                    setOpen(false)
                    onSelect(asignatura.id)
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {asignatura.nombre}
                  </span>
                  <span className="text-muted-foreground ml-2 shrink-0 text-xs tabular-nums">
                    {asignatura.creditos} cr
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Trazo de seriación cuando alguno de los extremos no tiene línea asignada. */
const SERIACION_COLOR_NEUTRO = 'oklch(from var(--muted-foreground) l c h)'

function getBezierPath(source: CardRect, target: CardRect): string {
  const startX = source.x + source.width
  const startY = source.y + source.height / 2
  const endX = target.x
  const endY = target.y + target.height / 2
  const bend = Math.max(64, Math.abs(endX - startX) * 0.35)

  return `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`
}

function buildChainIds(
  hoveredId: string | null,
  asignaturas: Array<Asignatura>,
): Set<string> | null {
  if (!hoveredId) return null

  const childrenByParent = new Map<string, Array<string>>()
  const parentByChild = new Map<string, string>()

  asignaturas.forEach((asignatura) => {
    if (asignatura.prerrequisito_asignatura_id) {
      parentByChild.set(asignatura.id, asignatura.prerrequisito_asignatura_id)

      const children =
        childrenByParent.get(asignatura.prerrequisito_asignatura_id) ?? []
      children.push(asignatura.id)
      childrenByParent.set(asignatura.prerrequisito_asignatura_id, children)
    }
  })

  const visited = new Set<string>([hoveredId])
  const queue = [hoveredId]

  while (queue.length > 0) {
    const currentId = queue.pop()
    if (!currentId) continue

    const parentId = parentByChild.get(currentId)
    if (parentId && !visited.has(parentId)) {
      visited.add(parentId)
      queue.push(parentId)
    }

    const children = childrenByParent.get(currentId) ?? []
    children.forEach((childId) => {
      if (!visited.has(childId)) {
        visited.add(childId)
        queue.push(childId)
      }
    })
  }

  return visited
}

export const Route = createFileRoute('/planes/$planId/_detalle/mapa')({
  component: MapaCurricularPage,
})

function MapaCurricularPage() {
  const { planId } = Route.useParams() // Idealmente usa el ID de la ruta
  const navigate = useNavigate({ from: Route.fullPath })
  const { data } = usePlan(planId)
  const capabilities = usePlanCapabilities(data)
  const canEditMapa = capabilities.canEditAsignaturas
  const [totalCiclos, setTotalCiclos] = useState(0)
  const [editingLineaId, setEditingLineaId] = useState<string | null>(null)
  const {
    mutate: createLinea,
    mutateAsync: createLineaAsync,
    isPending: isCreatingLinea,
  } = useCreateLinea()
  const { mutate: updateLineaApi, mutateAsync: updateLineaAsync } =
    useUpdateLinea()
  const { mutate: deleteLineaApi, mutateAsync: deleteLineaAsync } =
    useDeleteLinea()
  const { data: asignaturaApi, isLoading: loadingAsig } =
    usePlanAsignaturas(planId)
  const { data: lineasApi, isLoading: loadingLineas } = usePlanLineas(planId)
  // Las sugerencias por facultad solo aplican a Licenciatura; en posgrado las
  // líneas son ad-hoc al plan. "Área Común" se trata aparte (global, solo licenciatura).
  const esLicenciatura = data?.carreras?.nivel === 'Licenciatura'
  const facultadIdPlan = data?.carreras?.facultad_id ?? null
  const { data: lineasSugeridas = [] } = useLineasSugeridas(
    esLicenciatura ? facultadIdPlan : null,
  )
  const [asignaturas, setAsignaturas] = useState<Array<Asignatura>>([])
  const [lineas, setLineas] = useState<Array<LineaCurricularUI>>([])
  const [draggedAsignatura, setDraggedAsignatura] = useState<string | null>(
    null,
  )
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddLineaDialogOpen, setIsAddLineaDialogOpen] = useState(false)
  const [isLineasSheetOpen, setIsLineasSheetOpen] = useState(false)
  // '' = nada; 'area_comun'; 'custom'; o `sug:<id>` para una sugerencia de facultad.
  const [selectedLineaOption, setSelectedLineaOption] = useState<string>('')
  const [customLineaNombre, setCustomLineaNombre] = useState('')
  const [ultimoHue, setUltimoHue] = useState<number | null>(null)
  const { mutateAsync: updateAsignatura } = useUpdateAsignatura()
  const { mutate: updatePlanFields } = useUpdatePlanFields()
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    resolve: (value: boolean) => void
    mensaje: string
  } | null>(null)

  const [hoveredAsignaturaId, setHoveredAsignaturaId] = useState<string | null>(
    null,
  )
  const [cardRects, setCardRects] = useState<Partial<Record<string, CardRect>>>(
    {},
  )
  const mapOverlayRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const contenedorMapaRef = useRef<HTMLDivElement>(null)
  const flipMapaRef = useRef<ReturnType<typeof Flip.getState> | null>(null)

  /**
   * Congela la posición actual de las tarjetas para animar el reacomodo que
   * viene. Se llama justo antes de mutar el estado, no después: `Flip` necesita
   * el "antes" real, y una vez que React repinta ya no hay forma de recuperarlo.
   *
   * Se consulta el DOM en vez de `cardRefs` porque la bandeja de pendientes no
   * está en ese registro y sus tarjetas también viajan al mapa.
   */
  const capturarLayoutMapa = () => {
    if (prefersReducedMotion()) return
    const tarjetas =
      contenedorMapaRef.current?.querySelectorAll('[data-flip-id]')
    if (!tarjetas || tarjetas.length === 0) return
    flipMapaRef.current = Flip.getState(tarjetas)
  }

  const [selectedVisualizacion, setSelectedVisualizacion] =
    useState<Asignatura | null>(null)
  const [isVisualizadorOpen, setIsVisualizadorOpen] = useState(false)

  const handleViewSeriacion = (asignatura: Asignatura) => {
    setSelectedVisualizacion(asignatura)
    setIsVisualizadorOpen(true)
  }
  const validarConInterrupcion = async (
    asignaturaId: string,
    nuevoCiclo: number | null,
  ): Promise<boolean> => {
    const asignatura = asignaturas.find((a) => a.id === asignaturaId)
    if (!asignatura) return true

    if (nuevoCiclo === null) {
      const materiasConflicto = asignaturas.filter(
        (a) =>
          a.id !== asignatura.id &&
          (asignatura.prerrequisito_asignatura_id === a.id ||
            a.prerrequisito_asignatura_id === asignatura.id),
      )

      if (
        !asignatura.prerrequisito_asignatura_id &&
        materiasConflicto.length === 0
      ) {
        return true
      }

      return new Promise((resolve) => {
        setConfirmState({
          isOpen: true,
          resolve,
          mensaje: JSON.stringify({
            main: `Desasignar "${asignatura.nombre}" del mapa quitará sus relaciones de seriación con:`,
            materias: materiasConflicto.map((m) => m.nombre),
          }),
        })
      })
    }

    // Buscamos las materias que causan el conflicto
    const materiasConflicto = asignaturas.filter((a) => {
      const esPrerrequisitoConflictivo =
        asignatura.prerrequisito_asignatura_id === a.id &&
        (a.ciclo ?? 0) >= nuevoCiclo

      const esDependienteConflictiva =
        a.prerrequisito_asignatura_id === asignatura.id &&
        (a.ciclo ?? 0) <= nuevoCiclo &&
        a.ciclo !== null

      return esPrerrequisitoConflictivo || esDependienteConflictiva
    })

    if (materiasConflicto.length === 0) return true

    // Extraemos solo los nombres para la lista visual
    const listaNombres = materiasConflicto.map((m) => m.nombre)

    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        resolve,
        // Guardamos la lista de nombres en el mensaje de forma que podamos procesarla
        mensaje: JSON.stringify({
          main: `Mover "${asignatura.nombre}" a ${formatCiclo(data?.tipo_ciclo, nuevoCiclo)} genera conflictos con:`,
          materias: listaNombres,
        }),
      })
    })
  }

  useEffect(() => {
    if (data?.numero_ciclos) {
      setTotalCiclos(data.numero_ciclos)
    }
  }, [data])

  useEffect(() => {
    if (selectedLineaOption === 'custom' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [selectedLineaOption])

  const manejarAgregarLinea = async (
    nombre: string,
    color: string,
    hue: number,
    area: string = 'sin asignar',
  ) => {
    if (!canEditMapa) return
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'agregar una linea curricular fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    const nombreNormalizado = nombre.trim()
    if (!nombreNormalizado) return
    const nombreBusqueda = nombreNormalizado
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    const yaExiste = lineas.some((l) => {
      const lineaExistente = l.nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return lineaExistente === nombreBusqueda
    })

    if (yaExiste) {
      await showAppAlert({
        title: 'Línea duplicada',
        description: `La línea "${nombreNormalizado}" ya existe en este plan.`,
      })
      return
    }
    const maxOrden = lineas.reduce((max, l) => Math.max(max, l.orden || 0), 0)

    createLinea(
      {
        nombre: nombreNormalizado,
        plan_estudio_id: planId,
        orden: maxOrden + 1,
        area,
        color,
        adminOverrideReason,
      },
      {
        onSuccess: (nueva) => {
          const mapeada = {
            id: nueva.id,
            nombre: nueva.nombre,
            orden: nueva.orden,
            color: nueva.color ?? color,
            descripcion: descripcionDeLinea(nueva),
          }
          setLineas((prev) => [...prev, mapeada])
          setUltimoHue(hue)
          setIsAddLineaDialogOpen(false)
          setSelectedLineaOption('')
          setCustomLineaNombre('')
        },
        onError: (err) => {
          console.error('Error al crear linea:', err)
        },
      },
    )
  }

  const canAddLinea =
    selectedLineaOption === 'area_comun' ||
    selectedLineaOption.startsWith('sug:') ||
    (selectedLineaOption === 'custom' && customLineaNombre.trim().length > 0)

  // El catálogo solo ofrece líneas que aún no existen en el plan.
  const normalizarNombre = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const lineasExistentes = new Set(
    lineas.map((l) => normalizarNombre(l.nombre)),
  )
  // Sugerencias de la facultad (solo licenciatura) aún no presentes en el plan.
  const sugeridasDisponibles = esLicenciatura
    ? lineasSugeridas.filter(
        (s) => !lineasExistentes.has(normalizarNombre(s.nombre)),
      )
    : []
  // "Área Común" es global y solo aplica a licenciatura.
  const areaComunYaExiste = lineasExistentes.has('area comun')
  const mostrarAreaComun = esLicenciatura && !areaComunYaExiste
  const hayCatalogoDisponible =
    sugeridasDisponibles.length > 0 || mostrarAreaComun

  const handleAgregarLinea = async () => {
    if (!canAddLinea || isCreatingLinea) return

    let nombreSeleccionado = ''
    let areaSeleccionada: string | undefined
    let colorSugerido: string | null | undefined

    if (selectedLineaOption === 'area_comun') {
      nombreSeleccionado = 'Área Común'
    } else if (selectedLineaOption.startsWith('sug:')) {
      const sugId = selectedLineaOption.slice('sug:'.length)
      const sug = sugeridasDisponibles.find((s) => s.id === sugId)
      if (!sug) return
      nombreSeleccionado = sug.nombre
      areaSeleccionada = sug.area ?? undefined
      colorSugerido = sug.color
    } else {
      nombreSeleccionado = customLineaNombre.trim()
    }

    if (!nombreSeleccionado) return

    const { hex, hue } = generarColorContrastante(ultimoHue)
    const color = colorSugerido || hex

    await manejarAgregarLinea(nombreSeleccionado, color, hue, areaSeleccionada)
  }

  const cambiarColorLinea = async (lineaId: string, nuevoColor: string) => {
    if (!canEditMapa) return
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'cambiar una linea curricular fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    setLineas((prev) =>
      prev.map((l) => (l.id === lineaId ? { ...l, color: nuevoColor } : l)),
    )

    updateLineaApi(
      {
        lineaId,
        patch: { color: nuevoColor, adminOverrideReason },
      },
      {
        onError: (err) => {
          console.error('Error al actualizar color de linea:', err)
        },
      },
    )
  }
  const guardarEdicionLinea = async (id: string, nuevoNombre: string) => {
    if (!canEditMapa) return
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'editar una linea curricular fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    const nombreAFijar = nuevoNombre.trim()

    if (!nombreAFijar) {
      setEditingLineaId(null)
      return
    }

    updateLineaApi(
      {
        lineaId: id,
        patch: { nombre: nombreAFijar, adminOverrideReason },
      },
      {
        onSuccess: (lineaActualizada) => {
          setLineas((prev) =>
            prev.map((l) =>
              l.id === id ? { ...l, nombre: lineaActualizada.nombre } : l,
            ),
          )
          setEditingLineaId(null)
        },
        onError: (err) => {
          console.error('Error al actualizar linea:', err)
          // Opcional: revertir cambios o avisar al usuario
        },
      },
    )
  }

  /**
   * Descripción del bloque de conocimiento que la línea representa.
   *
   * Escribe siempre en `proposito` y anula las dos columnas de la versión
   * anterior: si no se anulasen, el texto consolidado volvería a leerse
   * duplicado en el siguiente render (la lectura concatena las tres).
   */
  const guardarDescripcionLinea = async (id: string, texto: string) => {
    if (!canEditMapa) return

    const anterior = lineas.find((l) => l.id === id)?.descripcion ?? ''
    const nueva = texto.trim()
    if (nueva === anterior) return

    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'editar una linea curricular fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    setLineas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, descripcion: nueva } : l)),
    )

    updateLineaApi(
      {
        lineaId: id,
        patch: {
          proposito: nueva || null,
          aporte_perfil_egreso: null,
          alcance_formativo: null,
          adminOverrideReason,
        },
      },
      {
        onError: (err) => {
          console.error('Error al actualizar la descripción de la linea:', err)
          setLineas((prev) =>
            prev.map((l) =>
              l.id === id ? { ...l, descripcion: anterior } : l,
            ),
          )
        },
      },
    )
  }

  useEffect(() => {
    if (asignaturaApi)
      setAsignaturas(mapAsignaturasToAsignaturas(asignaturaApi))
  }, [asignaturaApi])

  useEffect(() => {
    if (lineasApi) setLineas(mapLineasToLineaCurricular(lineasApi))
  }, [lineasApi])

  const ciclosTotales = Number(totalCiclos)
  const ciclosArray = Array.from({ length: ciclosTotales }, (_, i) => i + 1)

  const maxCicloUsado = asignaturas.reduce(
    (max, a) => Math.max(max, a.ciclo ?? 0),
    0,
  )
  const minCiclos = Math.max(1, maxCicloUsado)

  const handleCambiarCiclos = async (value: number | null) => {
    if (!canEditMapa) return
    if (value === null) return
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'cambiar los ciclos del plan fuera de su etapa normal',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    const nuevo = Math.max(minCiclos, Math.min(99, Math.floor(value)))
    if (nuevo === ciclosTotales) return
    setTotalCiclos(nuevo)
    updatePlanFields(
      { planId, patch: { numero_ciclos: nuevo }, adminOverrideReason },
      {
        onError: (err) => {
          console.error('No se pudo actualizar el número de ciclos', err)
          // Revertimos al valor previo del servidor.
          if (data?.numero_ciclos) setTotalCiclos(data.numero_ciclos)
        },
      },
    )
  }
  const [editingData, setEditingData] = useState<Asignatura | null>(null)
  const [isLineaEditorOpen, setIsLineaEditorOpen] = useState(false)
  const [isSeriacionEditorOpen, setIsSeriacionEditorOpen] = useState(false)
  const [editingCarga, setEditingCarga] = useState<'hd' | 'hi' | null>(null)
  const [isEditingCiclo, setIsEditingCiclo] = useState(false)

  /**
   * Única vía de escritura de una asignatura del mapa: la usan el arrastre, el
   * modal, el `+` de celda y el modo agente.
   *
   * Devuelve si el cambio quedó aplicado —`false` si faltan permisos, si el
   * usuario canceló el override o el conflicto de seriación, o si la escritura
   * falló—, porque el agente necesita saberlo: sin cambio real no hay nada que
   * registrar en la pila de deshacer.
   */
  const procesarCambioAsignatura = async (
    asignaturaId: string,
    nuevosDatos: Partial<Asignatura>,
    opciones: {
      /** El modal se cierra al guardar desde él, pero no al ajustar dentro. */
      cerrarModal?: boolean
    } = {},
  ): Promise<boolean> => {
    const { cerrarModal = true } = opciones
    if (!canEditMapa) return false
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'modificar una asignatura fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return false

    const asignaturaOriginal = asignaturas.find((a) => a.id === asignaturaId)
    if (!asignaturaOriginal) return false

    const cambioNormalizado =
      nuevosDatos.ciclo === null
        ? {
            ...nuevosDatos,
            lineaCurricularId: null,
            prerrequisito_asignatura_id: null,
          }
        : nuevosDatos

    // ¿Cambió el ciclo? Si es así, validamos seriación
    if (
      cambioNormalizado.ciclo !== undefined &&
      cambioNormalizado.ciclo !== asignaturaOriginal.ciclo
    ) {
      const acepto = await validarConInterrupcion(
        asignaturaId,
        cambioNormalizado.ciclo ?? null,
      )
      setConfirmState(null)
      if (!acepto) return false // El usuario canceló, no guardamos nada
    }

    // Si llegamos aquí, o no cambió el ciclo o el usuario aceptó el conflicto
    const patch = {
      nombre: cambioNormalizado.nombre ?? asignaturaOriginal.nombre,
      codigo: cambioNormalizado.clave ?? asignaturaOriginal.clave,
      numero_ciclo: cambioNormalizado.ciclo,
      linea_plan_id: cambioNormalizado.lineaCurricularId,
      horas_academicas: cambioNormalizado.hd,
      horas_independientes: cambioNormalizado.hi,
      // Una asignatura sin ciclo no puede participar en una seriación. Las
      // dependencias hacia ella se limpian por el trigger de base de datos.
      prerrequisito_asignatura_id:
        cambioNormalizado.ciclo === null
          ? null
          : cambioNormalizado.prerrequisito_asignatura_id,
      tipo: cambioNormalizado.tipo?.toUpperCase() as TipoAsignatura,
    }

    const previousAsignaturas = asignaturas
    setAsignaturas((prev) =>
      prev.map((m) =>
        m.id === asignaturaId ? { ...m, ...cambioNormalizado } : m,
      ),
    )
    if (editingData?.id === asignaturaId) {
      setEditingData((prev) =>
        prev ? { ...prev, ...cambioNormalizado } : prev,
      )
    }

    try {
      await updateAsignatura({
        asignaturaId,
        patch: patch as any,
        adminOverrideReason,
      })
      setEditingCarga(null)
      setIsEditingCiclo(false)
      if (cerrarModal) setIsEditModalOpen(false)
      return true
    } catch (err) {
      console.error('Error al guardar:', err)
      setAsignaturas(previousAsignaturas)
      return false
    }
  }

  /**
   * Reacomodo en bloque del mapa. No encadena `procesarCambioAsignatura` por
   * asignatura porque cada llamada pediría su propio motivo de override y su
   * propia confirmación de seriación: mover veinte asignaturas serían veinte
   * diálogos. Aquí se pregunta una vez y se valida el reparto final, que es lo
   * que de verdad importa.
   */
  const aplicarMovimientosMapa = async (
    movimientos: Array<PosicionAsignatura>,
    opciones: {
      /**
       * Motivo ya pedido por quien llama. Se acepta explícitamente para que una
       * reorganización que además crea líneas no pregunte dos veces.
       */
      adminOverrideReason?: string | null
    } = {},
  ): Promise<boolean> => {
    if (!canEditMapa || movimientos.length === 0) return false

    const adminOverrideReason =
      opciones.adminOverrideReason !== undefined
        ? opciones.adminOverrideReason
        : capabilities.requiresAdminOverrideForEdit
          ? await requestAdminOverrideReason(
              'reorganizar el mapa curricular fuera de la etapa normal del plan',
            )
          : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return false

    // Fuera del mapa no hay línea ni seriación posible; misma regla que aplica
    // el camino manual y que el trigger de base de datos refuerza.
    const destinos = new Map(
      movimientos.map((movimiento) => [
        movimiento.id,
        movimiento.ciclo === null
          ? { ...movimiento, lineaCurricularId: null }
          : movimiento,
      ]),
    )
    const cicloFinal = (asignatura: Asignatura) =>
      destinos.get(asignatura.id)?.ciclo ?? asignatura.ciclo

    const conflictos = asignaturas.filter((asignatura) => {
      const prerrequisito = asignaturas.find(
        (a) => a.id === asignatura.prerrequisito_asignatura_id,
      )
      if (!prerrequisito) return false
      const propio = cicloFinal(asignatura)
      const previo = cicloFinal(prerrequisito)
      if (propio === null || previo === null) return true
      return previo >= propio
    })

    if (conflictos.length > 0) {
      const acepto = await new Promise<boolean>((resolve) => {
        setConfirmState({
          isOpen: true,
          resolve,
          mensaje: JSON.stringify({
            main: 'El reacomodo propuesto rompe la seriación de:',
            materias: conflictos.map((c) => c.nombre),
          }),
        })
      })
      setConfirmState(null)
      if (!acepto) return false
    }

    const previousAsignaturas = asignaturas
    setAsignaturas((prev) =>
      prev.map((asignatura) => {
        const destino = destinos.get(asignatura.id)
        return destino
          ? {
              ...asignatura,
              ciclo: destino.ciclo,
              lineaCurricularId: destino.lineaCurricularId,
            }
          : asignatura
      }),
    )

    try {
      await Promise.all(
        [...destinos.values()].map((destino) =>
          updateAsignatura({
            asignaturaId: destino.id,
            patch: {
              numero_ciclo: destino.ciclo,
              linea_plan_id: destino.lineaCurricularId,
              ...(destino.ciclo === null
                ? { prerrequisito_asignatura_id: null }
                : {}),
            } as any,
            adminOverrideReason,
          }),
        ),
      )
      return true
    } catch (err) {
      // El rollback local es provisional: la invalidación de cada mutación
      // refresca el mapa con lo que de verdad quedó escrito.
      console.error('Error al reorganizar el mapa:', err)
      setAsignaturas(previousAsignaturas)
      return false
    }
  }

  const handleSaveChanges = () => {
    if (!editingData) return

    // Llamamos a la lógica centralizada que incluye la alerta
    void procesarCambioAsignatura(editingData.id, editingData)
  }
  const editingLinea = editingData?.lineaCurricularId
    ? (lineas.find((linea) => linea.id === editingData.lineaCurricularId) ??
      null)
    : null
  const editingSeriada = editingData?.prerrequisito_asignatura_id
    ? (asignaturas.find(
        (asignatura) =>
          asignatura.id === editingData.prerrequisito_asignatura_id,
      ) ?? null)
    : null
  const seriacionesElegibles = editingData
    ? asignaturas
        .filter(
          (asignatura) =>
            asignatura.id !== editingData.id &&
            asignatura.ciclo !== null &&
            editingData.ciclo !== null &&
            asignatura.ciclo < editingData.ciclo,
        )
        .sort(
          (left, right) =>
            Number(right.lineaCurricularId === editingData.lineaCurricularId) -
              Number(
                left.lineaCurricularId === editingData.lineaCurricularId,
              ) ||
            (right.ciclo ?? 0) - (left.ciclo ?? 0) ||
            left.nombre.localeCompare(right.nombre, 'es'),
        )
    : []
  const muestraControlSeriacion =
    editingSeriada !== null || seriacionesElegibles.length > 0
  const unassignedAsignaturas = asignaturas.filter(
    (m) => m.ciclo === null || m.lineaCurricularId === null,
  )
  const unassignedCount = unassignedAsignaturas.length

  // --- Modo agente ---------------------------------------------------------
  // Cada superficie del mapa declara qué le pide a la IA, cómo se aplica y cómo
  // se deshace; `useAccionAgente` aporta el resto: contexto, sesión, rechazos
  // razonados, errores en español, halo y pila de deshacer.

  // El halo toma los colores de las líneas del plan, no una paleta inventada:
  // el mapa se lee por color de línea y el borde que anuncia "esto lo está
  // tocando la IA" debe hablar el mismo idioma.
  const coloresLineas = lineas.length > 0 ? lineas.map((l) => l.color) : palette

  const asignaturaAMapa = (asignatura: Asignatura): AsignaturaMapa => ({
    id: asignatura.id,
    nombre: asignatura.nombre,
    clave: asignatura.clave || null,
    creditos: asignatura.creditos,
    horas_academicas: asignatura.hd,
    horas_independientes: asignatura.hi,
    tipo: asignatura.tipo,
    numero_ciclo: asignatura.ciclo,
    linea_plan_id: asignatura.lineaCurricularId,
    prerrequisito_asignatura_id: asignatura.prerrequisito_asignatura_id,
  })

  const contextoMapa = (): ContextoMapa => ({
    lineas: lineas.map((linea) => ({
      id: linea.id,
      nombre: linea.nombre,
      orden: linea.orden,
    })),
    asignaturas: asignaturas.map(asignaturaAMapa),
    numero_ciclos: ciclosTotales,
    nombre_ciclo: nombreTipoCiclo(data?.tipo_ciclo),
  })

  const posicionDe = (asignaturaId: string): PosicionAsignatura => {
    const asignatura = asignaturas.find((a) => a.id === asignaturaId)
    return {
      id: asignaturaId,
      ciclo: asignatura?.ciclo ?? null,
      lineaCurricularId: asignatura?.lineaCurricularId ?? null,
    }
  }

  const moverAsignatura = async (destino: PosicionAsignatura) => {
    capturarLayoutMapa()
    const aplicado = await procesarCambioAsignatura(
      destino.id,
      { ciclo: destino.ciclo, lineaCurricularId: destino.lineaCurricularId },
      { cerrarModal: false },
    )
    // Lanzar es lo que evita una entrada fantasma en la pila: si el usuario
    // canceló el conflicto de seriación o la escritura falló, no hay nada que
    // deshacer.
    if (!aplicado) throw new Error('No se pudo mover la asignatura.')
  }

  const editarAsignaturaConIA = async (
    asignaturaId: string,
    cambio: Partial<Asignatura>,
  ) => {
    const aplicado = await procesarCambioAsignatura(asignaturaId, cambio, {
      cerrarModal: false,
    })
    if (!aplicado) throw new Error('No se pudo aplicar el cambio.')
  }

  const eliminarLineasCreadas = async (ids: Array<string>) => {
    if (ids.length === 0) return
    await Promise.all(
      ids.map((lineaId) =>
        deleteLineaAsync({ lineaId, planId, adminOverrideReason: null }),
      ),
    )
    setLineas((prev) => prev.filter((linea) => !ids.includes(linea.id)))
  }

  /**
   * Reordena una línea una posición. Las líneas curriculares tienen un orden
   * con significado —de formación básica a especializante— y hasta ahora sólo
   * podía fijarse en el momento de crearlas: reordenar exigía borrarlas y
   * volverlas a crear. Reusa `aplicarOrdenLineas`, que ya es optimista y
   * revierte en bloque si alguna escritura falla.
   */
  const moverLinea = async (lineaId: string, direccion: -1 | 1) => {
    const indice = lineas.findIndex((linea) => linea.id === lineaId)
    const destino = indice + direccion
    if (indice < 0 || destino < 0 || destino >= lineas.length) return

    const reordenadas = [...lineas]
    const [movida] = reordenadas.splice(indice, 1)
    reordenadas.splice(destino, 0, movida)

    try {
      await aplicarOrdenLineas(
        reordenadas.map((linea, posicion) => ({
          linea_plan_id: linea.id,
          orden: posicion + 1,
        })),
      )
    } catch {
      notify.error('No se pudo cambiar el orden de las líneas curriculares.')
    }
  }

  const aplicarOrdenLineas = async (
    orden: Array<{ linea_plan_id: string; orden: number }>,
  ) => {
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'reordenar las lineas curriculares fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason) {
      throw new Error('Falta el motivo para reordenar fuera de etapa.')
    }

    const ordenPorLinea = new Map(
      orden.map((entrada) => [entrada.linea_plan_id, entrada.orden]),
    )
    const previas = lineas
    setLineas((prev) =>
      prev
        .map((linea) => ({
          ...linea,
          orden: ordenPorLinea.get(linea.id) ?? linea.orden,
        }))
        .sort((a, b) => a.orden - b.orden),
    )

    try {
      await Promise.all(
        orden.map((entrada) =>
          updateLineaAsync({
            lineaId: entrada.linea_plan_id,
            patch: { orden: entrada.orden, adminOverrideReason },
          }),
        ),
      )
    } catch (error) {
      setLineas(previas)
      throw error
    }
  }

  /**
   * Estado previo de un reacomodo. `creadas` viaja vacío y lo rellena `aplicar`:
   * los identificadores de las líneas nuevas sólo existen después de crearlas,
   * y sin ellos deshacer dejaría líneas huérfanas en el plan.
   */
  type SnapshotReorganizacion = {
    posiciones: Array<PosicionAsignatura>
    creadas: Array<string>
    /**
     * Seriaciones previas de todo lo que la propuesta toca. Se guardan aparte de
     * `posiciones` porque una asignatura puede cambiar de prerrequisito sin
     * moverse de celda —y al revés—, y porque sacar una asignatura del mapa le
     * borra la seriación aunque nadie la haya propuesto.
     */
    seriaciones: Array<{ id: string; prerrequisito: string | null }>
  }

  /**
   * Escribe las seriaciones propuestas. Va después de los movimientos y no
   * dentro de `aplicarMovimientosMapa` a propósito: esa función valida la
   * seriación *existente* contra las posiciones nuevas y pregunta al usuario si
   * la rompe. Si escribiera las nuevas a la vez, validaría contra un estado que
   * ella misma está cambiando.
   */
  const aplicarSeriaciones = async (
    entradas: Array<{ id: string; prerrequisito: string | null }>,
    adminOverrideReason: string | null,
  ) => {
    if (entradas.length === 0) return

    const previas = asignaturas
    setAsignaturas((prev) =>
      prev.map((asignatura) => {
        const entrada = entradas.find((e) => e.id === asignatura.id)
        return entrada
          ? {
              ...asignatura,
              prerrequisito_asignatura_id: entrada.prerrequisito,
            }
          : asignatura
      }),
    )

    try {
      await Promise.all(
        entradas.map((entrada) =>
          updateAsignatura({
            asignaturaId: entrada.id,
            patch: {
              prerrequisito_asignatura_id: entrada.prerrequisito,
            } as any,
            adminOverrideReason,
          }),
        ),
      )
    } catch (err) {
      console.error('Error al aplicar las seriaciones propuestas:', err)
      setAsignaturas(previas)
      throw err
    }
  }

  const aplicarReorganizacion = async (
    resultado: ResultadoReorganizarMapa,
    snapshot: SnapshotReorganizacion,
  ) => {
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'reorganizar el mapa curricular fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason) {
      throw new Error('Falta el motivo para reorganizar fuera de etapa.')
    }

    capturarLayoutMapa()

    // Rehacer vuelve a crear las líneas, así que la lista se rehace entera en
    // cada aplicación en vez de acumular identificadores ya inexistentes.
    snapshot.creadas = []
    const idsPorClave = new Map<string, string>()
    let hue = ultimoHue
    let ordenSiguiente =
      lineas.reduce((max, linea) => Math.max(max, linea.orden || 0), 0) + 1

    for (const nueva of resultado.lineas_nuevas) {
      const nombre = nueva.nombre.trim()
      if (!nombre) continue
      const { hex, hue: siguienteHue } = generarColorContrastante(hue)
      hue = siguienteHue

      const creada = await createLineaAsync({
        nombre,
        plan_estudio_id: planId,
        orden: ordenSiguiente,
        area: 'sin asignar',
        color: nueva.color || hex,
        adminOverrideReason,
      })
      ordenSiguiente += 1

      idsPorClave.set(nueva.clave_temporal, creada.id)
      snapshot.creadas.push(creada.id)
      setLineas((prev) => [
        ...prev,
        {
          id: creada.id,
          nombre: creada.nombre,
          orden: creada.orden,
          color: creada.color ?? hex,
          descripcion: descripcionDeLinea(creada),
        },
      ])
    }
    setUltimoHue(hue)

    // Sólo se escribe lo que apunta a algo real: una línea inventada por el
    // modelo que no llegó a crearse dejaría una clave foránea colgando.
    const lineasValidas = new Set([
      ...lineas.map((linea) => linea.id),
      ...idsPorClave.values(),
    ])
    const movimientos = resultado.movimientos
      .map((movimiento) => ({
        id: movimiento.asignatura_id,
        ciclo: movimiento.numero_ciclo,
        lineaCurricularId:
          idsPorClave.get(movimiento.linea) ?? movimiento.linea,
      }))
      .filter(
        (movimiento) =>
          asignaturas.some((a) => a.id === movimiento.id) &&
          lineasValidas.has(movimiento.lineaCurricularId),
      )

    if (movimientos.length > 0) {
      const aplicado = await aplicarMovimientosMapa(movimientos, {
        adminOverrideReason,
      })
      if (!aplicado) {
        // No dejamos líneas huérfanas de un reacomodo que no llegó a aplicarse.
        await eliminarLineasCreadas(snapshot.creadas)
        snapshot.creadas = []
        throw new Error('No se aplicó la reorganización del mapa.')
      }
    }

    // Una seriación sólo se escribe si sus dos extremos siguen en el plan y el
    // prerrequisito quedó de verdad en un ciclo anterior. El backend ya lo
    // comprobó sobre el mapa que él propuso; aquí se vuelve a comprobar sobre el
    // que quedó, que puede diferir si el usuario canceló un conflicto.
    const posicionFinal = new Map(asignaturas.map((a) => [a.id, a.ciclo]))
    for (const movimiento of movimientos) {
      posicionFinal.set(movimiento.id, movimiento.ciclo)
    }
    const seriaciones = resultado.seriaciones
      .filter((seriacion) => posicionFinal.has(seriacion.asignatura_id))
      .map((seriacion) => ({
        id: seriacion.asignatura_id,
        prerrequisito: seriacion.prerrequisito_asignatura_id,
      }))
      .filter((seriacion) => {
        if (seriacion.prerrequisito === null) return true
        const propio = posicionFinal.get(seriacion.id) ?? null
        const previo = posicionFinal.get(seriacion.prerrequisito) ?? null
        return propio !== null && previo !== null && previo < propio
      })

    await aplicarSeriaciones(seriaciones, adminOverrideReason)
  }

  const deshacerReorganizacion = async (snapshot: SnapshotReorganizacion) => {
    capturarLayoutMapa()
    // Las seriaciones se sueltan antes de mover: si una asignatura vuelve a un
    // ciclo anterior al de su prerrequisito propuesto, restaurar posiciones con
    // la seriación nueva todavía puesta dispararía el aviso de conflicto contra
    // un estado que estamos deshaciendo justamente por eso.
    await aplicarSeriaciones(
      snapshot.seriaciones.map((s) => ({ id: s.id, prerrequisito: null })),
      null,
    )
    if (snapshot.posiciones.length > 0) {
      const restaurado = await aplicarMovimientosMapa(snapshot.posiciones)
      if (!restaurado) throw new Error('No se pudo restaurar el mapa.')
    }
    await aplicarSeriaciones(snapshot.seriaciones, null)
    // Las asignaturas vuelven primero a su sitio; sólo entonces las líneas
    // creadas quedan vacías y se pueden eliminar sin arrastrar a nadie.
    await eliminarLineasCreadas(snapshot.creadas)
    snapshot.creadas = []
  }

  const puedeAgentar = canEditMapa && capabilities.canUseIA

  const opcionesAsignar = (
    asignatura: Asignatura,
  ): OpcionesAccionAgente<ResultadoAsignarAsignatura, PosicionAsignatura> => ({
    id: `mapa:asignar:${asignatura.id}`,
    accion: 'asignar_asignatura',
    etiqueta: `Colocar «${asignatura.nombre}»`,
    ariaLabel: `Colocar ${asignatura.nombre} en el mapa con IA`,
    disabled: !puedeAgentar || lineas.length === 0,
    colores: coloresLineas,
    payload: () =>
      ({
        ...contextoMapa(),
        asignatura_id: asignatura.id,
      }) satisfies PayloadAsignarAsignatura,
    snapshot: () => posicionDe(asignatura.id),
    aplicar: (resultado) =>
      moverAsignatura({
        id: asignatura.id,
        ciclo: resultado.numero_ciclo,
        lineaCurricularId: resultado.linea_plan_id,
      }),
    restaurar: (previo) => moverAsignatura(previo),
  })

  const opcionesCelda = (
    linea: LineaCurricularUI,
    cicloNumero: number,
  ): OpcionesAccionAgente<ResultadoProponerParaCelda, PosicionAsignatura> => {
    const ubicacion = `${linea.nombre}, ${formatCiclo(data?.tipo_ciclo, cicloNumero)}`

    return {
      id: `mapa:celda:${linea.id}:${cicloNumero}`,
      accion: 'proponer_para_celda',
      etiqueta: `Proponer una asignatura para ${ubicacion}`,
      ariaLabel: `Que la IA elija una asignatura pendiente para ${ubicacion}`,
      disabled: !puedeAgentar,
      colores: [linea.color],
      payload: () =>
        ({
          ...contextoMapa(),
          linea_plan_id: linea.id,
          linea_nombre: linea.nombre,
          numero_ciclo: cicloNumero,
          candidatas: unassignedAsignaturas.map(asignaturaAMapa),
        }) satisfies PayloadProponerParaCelda,
      // El "antes" sólo se conoce cuando el modelo dice a quién eligió.
      snapshot: (resultado) => posicionDe(resultado.asignatura_id),
      aplicar: (resultado) =>
        moverAsignatura({
          id: resultado.asignatura_id,
          ciclo: cicloNumero,
          lineaCurricularId: linea.id,
        }),
      restaurar: (previo) => moverAsignatura(previo),
    }
  }

  const opcionesOrdenarLineas = (
    linea: LineaCurricularUI,
  ): OpcionesAccionAgente<
    ResultadoOrdenarLineas,
    Array<{ linea_plan_id: string; orden: number }>
  > => ({
    id: `mapa:orden-lineas:${linea.id}`,
    accion: 'ordenar_lineas',
    etiqueta: 'Reordenar las líneas curriculares',
    ariaLabel: `Reordenar las líneas curriculares con IA, tomando ${linea.nombre} como referencia`,
    disabled: !puedeAgentar || lineas.length < 2,
    colores: coloresLineas,
    payload: () =>
      ({
        lineas: lineas.map((l) => ({
          id: l.id,
          nombre: l.nombre,
          orden: l.orden,
        })),
        linea_plan_id: linea.id,
      }) satisfies PayloadOrdenarLineas,
    snapshot: () =>
      lineas.map((l) => ({ linea_plan_id: l.id, orden: l.orden })),
    aplicar: (resultado) => aplicarOrdenLineas(resultado.orden),
    restaurar: (previo) => aplicarOrdenLineas(previo),
  })

  const opcionesReorganizar = (
    linea?: LineaCurricularUI,
  ): OpcionesAccionAgente<
    ResultadoReorganizarMapa,
    SnapshotReorganizacion
  > => ({
    id: linea ? `mapa:reorganizar:${linea.id}` : 'mapa:reorganizar',
    accion: 'reorganizar_mapa',
    etiqueta: linea
      ? `Reorganizar «${linea.nombre}»`
      : 'Reorganizar el mapa curricular',
    ariaLabel: linea
      ? `Reorganizar la línea ${linea.nombre} con IA`
      : 'Reorganizar todo el mapa curricular con IA',
    modo: linea ? 'captura' : 'boton',
    disabled: !puedeAgentar || asignaturas.length === 0,
    colores: linea ? [linea.color] : coloresLineas,
    // Reacomodar un mapa entero es la acción más cara del modo: aquí sí se paga
    // razonamiento, porque el resultado depende de carga, seriación y progresión.
    reasoningEffort: 'medium',
    payload: () =>
      ({
        ...contextoMapa(),
        ...(linea ? { linea_plan_id: linea.id } : {}),
      }) satisfies PayloadReorganizarMapa,
    snapshot: (resultado) => {
      // Todo lo que la propuesta toca, se mueva o sólo cambie de seriación:
      // deshacer tiene que devolver ambas cosas, y sacar una asignatura del mapa
      // le borra el prerrequisito aunque nadie lo haya propuesto.
      const tocadas = new Set([
        ...resultado.movimientos.map((m) => m.asignatura_id),
        ...resultado.seriaciones.map((s) => s.asignatura_id),
      ])

      return {
        posiciones: resultado.movimientos
          .filter((movimiento) =>
            asignaturas.some((a) => a.id === movimiento.asignatura_id),
          )
          .map((movimiento) => posicionDe(movimiento.asignatura_id)),
        creadas: [],
        seriaciones: asignaturas
          .filter((a) => tocadas.has(a.id))
          .map((a) => ({
            id: a.id,
            prerrequisito: a.prerrequisito_asignatura_id ?? null,
          })),
      }
    },
    aplicar: (resultado, snapshot) =>
      aplicarReorganizacion(resultado, snapshot),
    restaurar: (snapshot) => deshacerReorganizacion(snapshot),
  })

  const agenteReorganizarTodo = useAccionAgente(opcionesReorganizar())

  // "Agregar línea" en modo agente NO abre el diálogo: el diálogo existe para
  // que el usuario elija de un catálogo, y aquí quien elige es la IA. El
  // snapshot es el id de la línea creada, así que deshacer la borra.
  const agenteAgregarLinea = useAccionAgente<
    ResultadoProponerLinea,
    { id: string | null }
  >({
    id: 'mapa:agregar-linea',
    accion: 'proponer_linea',
    etiqueta: 'Agregar una línea curricular',
    ariaLabel: 'Agregar la línea curricular que proponga la IA',
    modo: 'boton',
    disabled: !puedeAgentar,
    colores: coloresLineas,
    payload: () => contextoMapa() satisfies PayloadProponerLinea,
    // El id sólo existe después de crearla: `aplicar` lo anota en el snapshot.
    snapshot: () => ({ id: null }),
    aplicar: async (resultado, snapshot) => {
      const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
        ? await requestAdminOverrideReason(
            'agregar una linea curricular fuera de la etapa normal del plan',
          )
        : null
      if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason) {
        throw new Error('Falta el motivo para agregar la línea fuera de etapa.')
      }

      const { hex, hue } = generarColorContrastante(ultimoHue)
      const color = resultado.color ?? hex
      const orden =
        lineas.reduce((max, linea) => Math.max(max, linea.orden || 0), 0) + 1

      const creada = await createLineaAsync({
        nombre: resultado.nombre,
        plan_estudio_id: planId,
        orden,
        area: 'sin asignar',
        color,
        adminOverrideReason,
      })

      snapshot.id = creada.id
      setUltimoHue(hue)
      setLineas((prev) => [
        ...prev,
        {
          id: creada.id,
          nombre: creada.nombre,
          orden: creada.orden,
          color: creada.color ?? color,
          descripcion: descripcionDeLinea(creada),
        },
      ])
      notify.success(
        resultado.justificacion
          ? `Línea «${creada.nombre}» agregada: ${resultado.justificacion}`
          : `Línea «${creada.nombre}» agregada.`,
      )
    },
    restaurar: async (snapshot) => {
      if (!snapshot.id) return
      await eliminarLineasCreadas([snapshot.id])
      snapshot.id = null
    },
  })

  const agenteNombreAsignatura = useAccionAgente<ResultadoMejorarCampo, string>(
    {
      id: `mapa:nombre:${editingData?.id ?? 'ninguna'}`,
      accion: 'mejorar_campo',
      etiqueta: 'Ajustar el nombre de la asignatura',
      ariaLabel: 'Ajustar el nombre de la asignatura con IA',
      disabled: !puedeAgentar || !editingData,
      colores: coloresLineas,
      // El título ya es un campo con subrayado (`rounded-none border-b`): el
      // halo enciende esa misma rayita en vez de dibujarle una caja.
      varianteHalo: 'subrayado',
      payload: () =>
        ({
          entidad: 'asignatura',
          entidad_id: editingData?.id ?? '',
          clave: 'nombre',
          label: 'Nombre de la asignatura',
          contenido_actual: editingData?.nombre ?? '',
          es_richtext: false,
        }) satisfies PayloadMejorarCampo,
      snapshot: () => editingData?.nombre ?? '',
      aplicar: (resultado) =>
        editarAsignaturaConIA(editingData?.id ?? '', {
          nombre: resultado.contenido,
        }),
      restaurar: (previo) =>
        editarAsignaturaConIA(editingData?.id ?? '', { nombre: previo }),
    },
  )

  const agenteTipoAsignatura = useAccionAgente<ResultadoMejorarCampo, string>({
    id: `mapa:tipo:${editingData?.id ?? 'ninguna'}`,
    accion: 'mejorar_campo',
    etiqueta: 'Ajustar el tipo de la asignatura',
    ariaLabel: 'Ajustar el tipo de la asignatura con IA',
    disabled: !puedeAgentar || !editingData,
    colores: coloresLineas,
    payload: () =>
      ({
        entidad: 'asignatura',
        entidad_id: editingData?.id ?? '',
        clave: 'tipo',
        label: 'Tipo de asignatura',
        contenido_actual: editingData?.tipo ?? '',
        es_richtext: false,
        opciones: ['OBLIGATORIA', 'OPTATIVA'],
      }) satisfies PayloadMejorarCampo,
    snapshot: () => editingData?.tipo ?? 'OBLIGATORIA',
    aplicar: (resultado) =>
      editarAsignaturaConIA(editingData?.id ?? '', {
        tipo: resultado.contenido as TipoAsignatura,
      }),
    restaurar: (previo) =>
      editarAsignaturaConIA(editingData?.id ?? '', {
        tipo: previo as TipoAsignatura,
      }),
  })

  const agenteCargaAsignatura = useAccionAgente<
    ResultadoAjustarCreditosHoras,
    { hd: number; hi: number }
  >({
    id: `mapa:carga:${editingData?.id ?? 'ninguna'}`,
    accion: 'ajustar_creditos_horas',
    etiqueta: 'Ajustar horas y créditos',
    ariaLabel: 'Ajustar las horas y los créditos con IA',
    disabled: !puedeAgentar || !editingData,
    colores: coloresLineas,
    // Las cifras ya viven sobre un subrayado: encerrarlas además en una caja
    // añadía un borde donde ya había uno. Basta con encender la rayita.
    varianteHalo: 'subrayado',
    payload: () =>
      ({
        asignatura_id: editingData?.id ?? '',
        nombre: editingData?.nombre ?? '',
        horas_academicas: editingData?.hd ?? 0,
        horas_independientes: editingData?.hi ?? 0,
        creditos: editingData?.creditos ?? 0,
        horas_por_credito: HORAS_POR_CREDITO,
      }) satisfies PayloadAjustarCreditosHoras,
    snapshot: () => ({ hd: editingData?.hd ?? 0, hi: editingData?.hi ?? 0 }),
    aplicar: (resultado) =>
      editarAsignaturaConIA(editingData?.id ?? '', {
        hd: resultado.horas_academicas,
        hi: resultado.horas_independientes,
      }),
    restaurar: (previo) =>
      editarAsignaturaConIA(editingData?.id ?? '', {
        hd: previo.hd,
        hi: previo.hi,
      }),
  })

  const agentePosicionAsignatura = useAccionAgente<
    ResultadoAsignarAsignatura,
    PosicionAsignatura
  >({
    ...opcionesAsignar(
      editingData ?? {
        id: '',
        clave: '',
        nombre: '',
        creditos: 0,
        ciclo: null,
        lineaCurricularId: null,
        tipo: 'OBLIGATORIA',
        estado: 'borrador',
        hd: 0,
        hi: 0,
        prerrequisito_asignatura_id: null,
      },
    ),
    disabled: !puedeAgentar || !editingData || lineas.length === 0,
  })

  /**
   * «Añadir seriación» abre un buscador de asignaturas: en modo agente ese
   * menú sobra, porque quien elige entre las candidatas es la IA. Se aplica
   * sobre el formulario abierto —no escribe por su cuenta— para que el usuario
   * siga confirmando el cambio como cualquier otra edición del editor.
   */
  const agenteSeriacion = useAccionAgente<
    ResultadoProponerPrerrequisito,
    string | null
  >({
    id: `mapa:seriacion:${editingData?.id ?? 'sin-asignatura'}`,
    accion: 'proponer_prerrequisito',
    etiqueta: editingData
      ? `Ajustar la seriación de «${editingData.nombre}»`
      : 'Ajustar la seriación',
    ariaLabel: editingData
      ? `Proponer la seriación de ${editingData.nombre} con IA`
      : 'Proponer la seriación con IA',
    disabled:
      !puedeAgentar || !editingData || seriacionesElegibles.length === 0,
    colores: coloresLineas,
    payload: () =>
      ({
        asignatura_id: editingData?.id ?? '',
        asignatura_nombre: editingData?.nombre ?? '',
        numero_ciclo: editingData?.ciclo ?? null,
        nombre_ciclo: nombreTipoCiclo(data?.tipo_ciclo),
        prerrequisito_actual: editingData?.prerrequisito_asignatura_id ?? null,
        candidatas: seriacionesElegibles.map((candidata) => ({
          id: candidata.id,
          nombre: candidata.nombre,
          clave: candidata.clave || null,
          numero_ciclo: candidata.ciclo,
          misma_linea:
            candidata.lineaCurricularId !== null &&
            candidata.lineaCurricularId === editingData?.lineaCurricularId,
        })),
      }) satisfies PayloadProponerPrerrequisito,
    snapshot: () => editingData?.prerrequisito_asignatura_id ?? null,
    aplicar: (resultado) => {
      setEditingData((previo) =>
        previo
          ? { ...previo, prerrequisito_asignatura_id: resultado.asignatura_id }
          : previo,
      )
    },
    restaurar: (previo) => {
      setEditingData((actual) =>
        actual ? { ...actual, prerrequisito_asignatura_id: previo } : actual,
      )
    },
  })

  const borrarLinea = async (id: string) => {
    if (!canEditMapa) return
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'eliminar una linea curricular fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    const confirmed = await showAppConfirm({
      title: 'Eliminar línea curricular',
      description: 'Las materias asignadas volverán a la bandeja de entrada.',
      confirmLabel: 'Eliminar línea',
      variant: 'destructive',
    })
    if (!confirmed) {
      return
    }

    deleteLineaApi(
      { lineaId: id, planId, adminOverrideReason },
      {
        onSuccess: () => {
          // Primero: Las materias que estaban en esa línea pasan a ser "huérfanas"
          setAsignaturas((prev) =>
            prev.map((asig) =>
              asig.lineaCurricularId === id
                ? { ...asig, ciclo: null, lineaCurricularId: null }
                : asig,
            ),
          )
          setLineas((prev) => prev.filter((l) => l.id !== id))
        },
        onError: async (error) => {
          console.error(error)
          await showAppAlert({
            title: 'No se pudo eliminar la línea',
            description: 'Verifica si tiene dependencias.',
            variant: 'destructive',
          })
        },
      },
    )
  }

  // --- Selectores/Cálculos ---
  const getTotalesCiclo = (cicloNumero: number) => {
    return asignaturas
      .filter((m) => m.ciclo === cicloNumero)
      .reduce(
        (acc, m) => ({
          cr: acc.cr + (m.creditos || 0),
          hd: acc.hd + (m.hd || 0),
          hi: acc.hi + (m.hi || 0),
        }),
        { cr: 0, hd: 0, hi: 0 },
      )
  }

  const getSubtotalLinea = (lineaId: string) => {
    return asignaturas
      .filter((m) => m.lineaCurricularId === lineaId && m.ciclo !== null) // Aseguramos que pertenezca a la línea Y tenga ciclo
      .reduce(
        (acc, m) => ({
          cr: acc.cr + (m.creditos || 0),
          hd: acc.hd + (m.hd || 0),
          hi: acc.hi + (m.hi || 0),
        }),
        { cr: 0, hd: 0, hi: 0 },
      )
  }

  const limpiarArrastre = () => {
    setDraggedAsignatura(null)
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!canEditMapa) {
      e.preventDefault()
      return
    }
    setDraggedAsignatura(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragEnd = () => {
    limpiarArrastre()
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!canEditMapa) return
    e.preventDefault()
  }

  const handleDrop = async (
    e: React.DragEvent,
    cicloDestino: number | null,
    lineaId: string | null,
  ) => {
    e.preventDefault()
    if (!canEditMapa) return
    const asignaturaId =
      draggedAsignatura || e.dataTransfer.getData('text/plain')
    if (!asignaturaId) return

    try {
      // Solo disparamos la lógica si realmente hay un cambio de posición
      await procesarCambioAsignatura(asignaturaId, {
        ciclo: cicloDestino,
        lineaCurricularId: lineaId,
      })
    } finally {
      limpiarArrastre()
    }
  }

  useEffect(() => {
    // Fallback global: limpia estado incluso si sueltan fuera de cualquier dropzone React.
    const resetDragState = () => {
      limpiarArrastre()
    }

    window.addEventListener('drop', resetDragState)
    window.addEventListener('dragend', resetDragState)

    return () => {
      window.removeEventListener('drop', resetDragState)
      window.removeEventListener('dragend', resetDragState)
    }
  }, [])

  const stats = useMemo(
    () =>
      asignaturas.reduce(
        (acc, m) => {
          if (m.ciclo !== null) {
            acc.cr += m.creditos || 0
            acc.hd += m.hd || 0
            acc.hi += m.hi || 0
          }
          return acc
        },
        { cr: 0, hd: 0, hi: 0 },
      ),
    [asignaturas],
  )

  const confirmarEdicionLinea = async (id: string, nuevoNombreRaw: string) => {
    const nuevoNombre = nuevoNombreRaw.trim()
    const lineaOriginal = lineas.find((l) => l.id === id)

    if (!nuevoNombre) {
      setEditingLineaId(null)
      return
    }

    if (nuevoNombre !== lineaOriginal?.nombre) {
      await guardarEdicionLinea(id, nuevoNombre)
      return
    }

    setEditingLineaId(null)
  }

  const generateExcel = async () => {
    try {
      const formato = 'xlsx'
      const blob = await fetchPlanExcel({
        plan_estudio_id: planId,
        convertTo: formato,
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${data ? getPlanDisplayName(data) : 'plan'}.${formato}`
      document.body.appendChild(link)
      link.click()

      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      await showAppAlert({
        title: 'No se pudo generar el Excel',
        description: 'Intenta exportar el mapa curricular nuevamente.',
        variant: 'destructive',
      })
    }
  }

  /**
   * Cada trazo de seriación lleva el color de la línea curricular a la que
   * pertenece la asignatura: un gris único para todos obligaba a seguir la
   * curva con la vista hasta sus dos extremos para saber de qué parte del plan
   * hablaba. Cuando el antecedente y la seriada viven en líneas distintas —el
   * caso interesante, el que cruza el mapa— el trazo va en degradado del color
   * de origen al de destino, para que el cruce se lea como tal y no como una
   * línea de una de las dos.
   */
  const seriacionEdges = useMemo(() => {
    const colorPorLinea = new Map(
      lineas.map((linea) => [linea.id, linea.color]),
    )
    const lineaPorAsignatura = new Map(
      asignaturas.map((asignatura) => [
        asignatura.id,
        asignatura.lineaCurricularId,
      ]),
    )
    const colorDe = (asignaturaId: string): string | null => {
      const lineaId = lineaPorAsignatura.get(asignaturaId) ?? null
      if (!lineaId) return null
      return colorPorLinea.get(lineaId) ?? null
    }

    return asignaturas
      .filter((asignatura) => asignatura.prerrequisito_asignatura_id)
      .map((asignatura) => {
        const source = asignatura.prerrequisito_asignatura_id as string
        const colorOrigen = colorDe(source)
        const colorDestino = colorDe(asignatura.id)
        return {
          source,
          target: asignatura.id,
          colorOrigen,
          colorDestino,
          // Sin línea asignada en alguno de los dos extremos no hay degradado
          // que contar: se cae al color que sí exista, o al trazo neutro.
          degradado: Boolean(
            colorOrigen && colorDestino && colorOrigen !== colorDestino,
          ),
        }
      })
  }, [asignaturas, lineas])

  const highlightedChainIds = useMemo(
    () => buildChainIds(hoveredAsignaturaId, asignaturas),
    [hoveredAsignaturaId, asignaturas],
  )

  const refreshCardRects = useCallback(() => {
    const overlay = mapOverlayRef.current
    if (!overlay) return

    const overlayBox = overlay.getBoundingClientRect()
    const nextRects: Record<string, CardRect> = {}

    Object.entries(cardRefs.current).forEach(([id, element]) => {
      if (!element) return

      const box = element.getBoundingClientRect()
      nextRects[id] = {
        x: box.left - overlayBox.left,
        y: box.top - overlayBox.top,
        width: box.width,
        height: box.height,
      }
    })

    setCardRects(nextRects)
  }, [])

  useLayoutEffect(() => {
    if (!asignaturas.length) return

    const frame = window.requestAnimationFrame(() => {
      refreshCardRects()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [asignaturas, lineas, totalCiclos, refreshCardRects])

  useEffect(() => {
    const overlay = mapOverlayRef.current
    if (!overlay) return

    const observer = new ResizeObserver(() => {
      refreshCardRects()
    })

    observer.observe(overlay)
    window.addEventListener('resize', refreshCardRects)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', refreshCardRects)
    }
  }, [refreshCardRects])

  // Reacomodo animado: cuando la IA mueve asignaturas, saltar de una celda a
  // otra sin transición hace imposible seguir qué se movió. `Flip` compara la
  // foto tomada antes de mutar con el DOM ya pintado y reproduce el trayecto;
  // el emparejamiento va por `data-flip-id`, no por nodo, porque React
  // desmonta la tarjeta de una celda y monta otra en la de destino.
  useLayoutEffect(() => {
    const estado = flipMapaRef.current
    if (!estado) return
    flipMapaRef.current = null

    const animacion = Flip.from(estado, {
      duration: organicDuration.slow,
      ease: organicEase,
      stagger: 0.015,
      absolute: true,
      onEnter: (elementos) =>
        gsap.fromTo(
          elementos,
          { opacity: 0, scale: 0.92 },
          {
            opacity: 1,
            scale: 1,
            duration: organicDuration.base,
            ease: organicEase,
          },
        ),
      onLeave: (elementos) =>
        gsap.to(elementos, { opacity: 0, duration: organicDuration.quick }),
      // Las curvas de seriación se dibujan desde los rectángulos de las
      // tarjetas: hay que recalcularlas cuando ya están en su sitio final.
      onComplete: refreshCardRects,
    })

    return () => {
      animacion.kill()
    }
  }, [asignaturas, lineas, refreshCardRects])

  if (loadingAsig || loadingLineas) return <MapTabSkeleton />

  return (
    <div ref={contenedorMapaRef} className="space-y-6">
      {/* Toolbar: créditos como dato principal; horas consultables en discreto */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {unassignedCount > 0 && (
          <Badge className="border-border bg-accent/50 text-accent-foreground hover:bg-accent/50">
            <AlertTriangle size={14} className="mr-1" />
            {unassignedCount} sin asignar
          </Badge>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-foreground/80 text-2l font-medium">
            {nombreTipoCiclo(data?.tipo_ciclo)}s
          </span>
          <EditableNumber
            value={ciclosTotales}
            min={minCiclos}
            max={99}
            editable={canEditMapa}
            underline
            ariaLabel={`Número de ${nombreTipoCiclo(data?.tipo_ciclo).toLowerCase()}s del plan`}
            onSave={(value) => void handleCambiarCiclos(value)}
            className="text-foreground text-base font-semibold"
          />

          {agenteReorganizarTodo.enModoAgente && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    'h-9 w-9',
                    agenteReorganizarTodo.halo.className,
                  )}
                  style={agenteReorganizarTodo.halo.style}
                  {...agenteReorganizarTodo.props}
                >
                  <Sparkles
                    className={cn(
                      'h-4 w-4',
                      agenteReorganizarTodo.ejecutando && 'animate-pulse',
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Reorganizar todo el mapa con la IA
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Líneas curriculares"
                onClick={() => setIsLineasSheetOpen(true)}
              >
                <Layers className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Líneas curriculares</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Exportar a Excel"
                onClick={() => generateExcel()}
                disabled={
                  asignaturas.length === 0 ||
                  lineas.length === 0 ||
                  asignaturas.every(
                    (a) => a.ciclo === null || a.lineaCurricularId === null,
                  )
                }
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Exportar a Excel</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="overflow-x-auto pb-6">
        <div ref={mapOverlayRef} className="relative">
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            {seriacionEdges.map((edge) => {
              const sourceRect = cardRects[edge.source]
              const targetRect = cardRects[edge.target]

              if (!sourceRect || !targetRect) return null

              const isHighlighted =
                highlightedChainIds !== null &&
                highlightedChainIds.has(edge.source) &&
                highlightedChainIds.has(edge.target)

              const colorTrazo =
                edge.colorDestino ?? edge.colorOrigen ?? SERIACION_COLOR_NEUTRO
              const gradienteId = `seriacion-degradado-${edge.source}-${edge.target}`
              const puntaId = `seriacion-punta-${edge.source}-${edge.target}`

              return (
                <g key={`${edge.source}-${edge.target}`}>
                  <defs>
                    {edge.degradado && (
                      /* `userSpaceOnUse` con los extremos reales del trazo: con
                         el `objectBoundingBox` por defecto, el degradado se
                         orienta según la caja de la curva y se invierte cuando
                         la seriada queda por encima del antecedente. */
                      <linearGradient
                        id={gradienteId}
                        gradientUnits="userSpaceOnUse"
                        x1={sourceRect.x + sourceRect.width}
                        y1={sourceRect.y + sourceRect.height / 2}
                        x2={targetRect.x}
                        y2={targetRect.y + targetRect.height / 2}
                      >
                        <stop offset="0%" stopColor={edge.colorOrigen ?? ''} />
                        <stop
                          offset="100%"
                          stopColor={edge.colorDestino ?? ''}
                        />
                      </linearGradient>
                    )}
                    <marker
                      id={puntaId}
                      viewBox="0 0 10 10"
                      refX="5"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                    >
                      <circle cx="5" cy="5" r="3.5" fill={colorTrazo} />
                    </marker>
                  </defs>
                  <path
                    d={getBezierPath(sourceRect, targetRect)}
                    fill="none"
                    stroke={
                      edge.degradado ? `url(#${gradienteId})` : colorTrazo
                    }
                    strokeWidth={isHighlighted ? 2.2 : 1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={`url(#${puntaId})`}
                    opacity={isHighlighted ? 1 : 0.35}
                  />
                </g>
              )
            })}
          </svg>

          <div
            className="grid gap-3 pl-1"
            style={{
              gridTemplateColumns: `140px repeat(${ciclosTotales}, 178px) 110px`,
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() =>
                    void navigate({
                      search: (prev) => ({ ...prev, creditos: true }),
                      resetScroll: false,
                    })
                  }
                  className="hover:bg-muted/50 focus-visible:ring-ring/40 flex items-baseline gap-2 rounded-lg px-2 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Calculator
                    className="text-muted-foreground h-4 w-4 self-center"
                    aria-hidden
                  />
                  <span className="text-foreground text-2xl font-bold tabular-nums">
                    {stats.cr.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground text-xs font-medium">
                    CR
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Ver desglose de créditos</TooltipContent>
            </Tooltip>

            {ciclosArray.map((n) => (
              <div
                key={`header-${n}`}
                className="bg-card dark:bg-muted/70 text-muted-foreground border-border/80 dark:border-border/70 rounded-xl border p-2 text-center text-sm font-bold shadow-xs dark:shadow-none"
              >
                {formatCiclo(data?.tipo_ciclo, n)}
              </div>
            ))}

            <div className="text-muted-foreground self-end text-center text-xs font-bold">
              SUBTOTAL
            </div>

            {lineas.map((linea) => {
              const sub = getSubtotalLinea(linea.id)

              return (
                <Fragment key={linea.id}>
                  <AccionAgente opciones={opcionesOrdenarLineas(linea)}>
                    {(agenteLinea) => (
                      <div
                        className={cn(
                          'group relative flex flex-col gap-2 rounded-xl border p-3 transition-all',
                          editingLineaId === linea.id
                            ? 'ring-primary/30 ring-2'
                            : 'cursor-text',
                          agenteLinea.enModoAgente && 'cursor-pointer',
                          agenteLinea.halo.className,
                        )}
                        style={{
                          borderColor: hexToRgba(
                            linea.color || '#1976d2',
                            0.24,
                          ),
                          backgroundColor:
                            editingLineaId === linea.id
                              ? hexToRgba(linea.color || '#1976d2', 0.12)
                              : hexToRgba(linea.color || '#1976d2', 0.08),
                          ...agenteLinea.halo.style,
                        }}
                        {...agenteLinea.props}
                      >
                        <div className="min-w-0 flex-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                contentEditable={!agenteLinea.enModoAgente}
                                role={
                                  agenteLinea.enModoAgente
                                    ? 'button'
                                    : 'textbox'
                                }
                                tabIndex={0}
                                aria-label={
                                  agenteLinea.enModoAgente
                                    ? `Reordenar las líneas curriculares con IA, tomando ${linea.nombre} como referencia`
                                    : `Nombre de línea ${linea.nombre}`
                                }
                                suppressContentEditableWarning
                                spellCheck={false}
                                onFocus={() => setEditingLineaId(linea.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    e.currentTarget.blur()
                                  }
                                  if (e.key === 'Escape') {
                                    e.preventDefault()
                                    e.currentTarget.textContent = linea.nombre
                                    e.currentTarget.blur()
                                  }
                                }}
                                onBlur={(e) => {
                                  void confirmarEdicionLinea(
                                    linea.id,
                                    e.currentTarget.textContent,
                                  )
                                }}
                                className={cn(
                                  'text-foreground hover:text-foreground/85 block w-full text-sm leading-snug wrap-break-word transition-colors outline-none',
                                  agenteLinea.enModoAgente
                                    ? 'cursor-pointer'
                                    : 'cursor-text',
                                )}
                              >
                                {linea.nombre}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-xs text-sm"
                            >
                              {agenteLinea.enModoAgente
                                ? 'Reordenar las líneas con la IA'
                                : linea.nombre}
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        <div
                          className="mt-auto h-1.5 w-8 rounded-full"
                          style={{ backgroundColor: linea.color || '#1976d2' }}
                          aria-hidden
                        />
                      </div>
                    )}
                  </AccionAgente>

                  {ciclosArray.map((cicloNumero) => (
                    <div
                      key={`${linea.id}-${cicloNumero}`}
                      onDragOver={handleDragOver}
                      onDrop={(e) =>
                        canEditMapa
                          ? handleDrop(e, cicloNumero, linea.id)
                          : undefined
                      }
                      className={`flex min-h-48 flex-col gap-2 rounded-xl border border-dashed p-1.5 transition-colors ${
                        draggedAsignatura
                          ? 'border-primary/35 bg-primary/6'
                          : 'border-border/80 bg-secondary/30 dark:border-border/70 dark:bg-muted/15'
                      }`}
                    >
                      {asignaturas
                        .filter(
                          (m) =>
                            m.ciclo === cicloNumero &&
                            m.lineaCurricularId === linea.id,
                        )
                        .map((m) => (
                          <div
                            key={m.id}
                            data-flip-id={m.id}
                            ref={(element) => {
                              cardRefs.current[m.id] = element
                            }}
                            onMouseEnter={() => setHoveredAsignaturaId(m.id)}
                            onMouseLeave={() => setHoveredAsignaturaId(null)}
                            className={[
                              'w-fit shrink-0 transition-opacity duration-200',
                              highlightedChainIds &&
                              !highlightedChainIds.has(m.id)
                                ? 'opacity-25'
                                : 'opacity-100',
                            ].join(' ')}
                          >
                            <AsignaturaCardItem
                              asignatura={m}
                              lineaColor={linea.color || '#1976d2'}
                              lineaNombre={linea.nombre}
                              isDragging={draggedAsignatura === m.id}
                              onDragStart={handleDragStart}
                              onClick={() => {
                                if (!canEditMapa) return
                                setEditingData(m)
                                setIsEditModalOpen(true)
                              }}
                              onViewSeriacion={handleViewSeriacion}
                              hasSeriacion={
                                !!m.prerrequisito_asignatura_id ||
                                asignaturas.some(
                                  (a) => a.prerrequisito_asignatura_id === m.id,
                                )
                              }
                            />
                          </div>
                        ))}

                      {canEditMapa && unassignedAsignaturas.length > 0 && (
                        <CeldaAgregarAsignatura
                          disponibles={unassignedAsignaturas}
                          ariaLabel={`Asignar una asignatura pendiente a ${linea.nombre}, ${formatCiclo(data?.tipo_ciclo, cicloNumero)}`}
                          opcionesAgente={opcionesCelda(linea, cicloNumero)}
                          onSelect={(asignaturaId) =>
                            void procesarCambioAsignatura(asignaturaId, {
                              ciclo: cicloNumero,
                              lineaCurricularId: linea.id,
                            })
                          }
                        />
                      )}
                    </div>
                  ))}

                  {/* El subtotal es donde se ve que una línea quedó irregular
                      (un ciclo cargadísimo y el siguiente vacío), así que es
                      donde se ofrece reacomodarla. */}
                  <AccionAgente opciones={opcionesReorganizar(linea)}>
                    {(agenteFila) => {
                      const vacia = sub.cr === 0 && sub.hd === 0 && sub.hi === 0

                      const celda = (
                        <div
                          className={cn(
                            'flex flex-col justify-center rounded-xl border p-4 text-[11px] font-medium',
                            vacia
                              ? 'border-border/50 bg-muted/20 text-muted-foreground/70'
                              : 'border-border bg-card text-muted-foreground',
                            agenteFila.enModoAgente &&
                              'hover:border-primary/40 cursor-pointer transition-colors',
                            agenteFila.halo.className,
                          )}
                          style={agenteFila.halo.style}
                          {...(agenteFila.enModoAgente
                            ? { role: 'button' as const, tabIndex: 0 }
                            : {})}
                          {...agenteFila.props}
                        >
                          {vacia ? (
                            <div className="text-muted-foreground">—</div>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="text-foreground text-base font-bold tabular-nums">
                                {sub.cr}
                                <span className="text-muted-foreground ml-1 text-[10px] font-medium">
                                  cr
                                </span>
                              </div>
                              {/* Fuera del modo agente el desglose vive en su
                                  propio tooltip; dentro, el de la celda explica
                                  qué hará el clic y no se anidan dos. */}
                              {agenteFila.enModoAgente ? (
                                <span className="text-muted-foreground/80 tabular-nums">
                                  {sub.hd + sub.hi} h
                                </span>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-muted-foreground/80 tabular-nums">
                                      {sub.hd + sub.hi} h
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="bottom"
                                    className="max-w-xs text-sm"
                                  >
                                    HD {sub.hd} + HI {sub.hi} ={' '}
                                    {sub.hd + sub.hi} h
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          )}
                        </div>
                      )

                      if (!agenteFila.enModoAgente) return celda

                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>{celda}</TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            Reorganizar «{linea.nombre}» con la IA
                          </TooltipContent>
                        </Tooltip>
                      )
                    }}
                  </AccionAgente>
                </Fragment>
              )
            })}

            <div className="border-border col-span-full my-2 border-t"></div>

            <div className="text-foreground self-center p-2 font-bold">
              Totales por {nombreTipoCiclo(data?.tipo_ciclo)}
            </div>

            {ciclosArray.map((cicloNumero) => {
              const t = getTotalesCiclo(cicloNumero)
              const isEmpty = t.cr === 0 && t.hd === 0 && t.hi === 0

              return (
                <div
                  key={`footer-${cicloNumero}`}
                  className={`rounded-xl border p-2 text-center text-[11px] ${
                    isEmpty
                      ? 'border-border/50 bg-muted/30 text-muted-foreground'
                      : 'border-border bg-card'
                  }`}
                >
                  {isEmpty ? (
                    <div className="text-muted-foreground py-1 text-xs">—</div>
                  ) : (
                    <>
                      <div className="text-foreground text-base font-bold tabular-nums">
                        {t.cr}
                        <span className="text-muted-foreground ml-1 text-[10px] font-medium">
                          cr
                        </span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground/80 tabular-nums">
                            {t.hd + t.hi} h
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="max-w-xs text-sm"
                        >
                          HD {t.hd} + HI {t.hi} = {t.hd + t.hi} h
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              )
            })}

            <div className="text-accent-foreground border-accent/40 bg-accent flex flex-col justify-center rounded-xl border p-2 text-center shadow-sm">
              <div className="text-base font-bold tabular-nums">
                {stats.cr} cr
              </div>
              <div className="text-accent-foreground/80 text-[11px] tabular-nums">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>{stats.hd + stats.hi} h</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-sm">
                    HD {stats.hd} + HI {stats.hi} = {stats.hd + stats.hi} h
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asignaturas sin asignar: bandeja plana, también es dropzone para desasignar */}
      {unassignedAsignaturas.length > 0 && (
        <div
          onDragOver={handleDragOver}
          onDrop={(e) => (canEditMapa ? handleDrop(e, null, null) : undefined)}
          aria-label="Asignaturas pendientes de asignar"
          className={[
            'rounded-2xl border-2 border-dashed p-4 transition-colors',
            draggedAsignatura
              ? 'border-primary/35 bg-primary/6'
              : 'border-border bg-muted/20',
          ].join(' ')}
        >
          <p className="text-muted-foreground mb-3 text-[10px] font-bold tracking-widest uppercase">
            Pendientes
          </p>
          <div className="flex flex-wrap gap-4">
            {unassignedAsignaturas.map((m) => (
              <AccionAgente key={m.id} opciones={opcionesAsignar(m)}>
                {(agenteTarjeta) => (
                  <div
                    data-flip-id={m.id}
                    className={cn(
                      'w-fit shrink-0 transition-opacity duration-200',
                      highlightedChainIds && !highlightedChainIds.has(m.id)
                        ? 'opacity-25'
                        : 'opacity-100',
                      agenteTarjeta.halo.className,
                    )}
                    style={agenteTarjeta.halo.style}
                    {...agenteTarjeta.props}
                  >
                    <AsignaturaCardItem
                      asignatura={m}
                      lineaColor="#94A3B8"
                      lineaNombre="Sin asignar"
                      isDragging={draggedAsignatura === m.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      ariaLabel={
                        agenteTarjeta.enModoAgente
                          ? `Colocar ${m.nombre} en el mapa con IA`
                          : undefined
                      }
                      onClick={() => {
                        if (!canEditMapa) return
                        setEditingData(m)
                        setIsEditModalOpen(true)
                      }}
                    />
                    {agenteTarjeta.rechazo && (
                      <p className="text-muted-foreground animate-in fade-in mt-1 max-w-44 text-[11px] leading-snug">
                        {agenteTarjeta.rechazo}
                      </p>
                    )}
                  </div>
                )}
              </AccionAgente>
            ))}
          </div>
        </div>
      )}

      {/* Gestión de líneas curriculares */}
      <Sheet open={isLineasSheetOpen} onOpenChange={setIsLineasSheetOpen}>
        <SheetContent
          side="right"
          // El cierre viaja dentro de la cabecera, en la misma fila que el
          // título, en vez de flotar sobre ella. Ver `PanelLateralHeader`.
          showCloseButton={false}
          className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        >
          <PanelLateralHeader
            icono={Layers}
            titulo="Líneas curriculares"
            descripcion="Gestión de las líneas curriculares del plan: nombre, color, descripción y orden."
            onCerrar={() => setIsLineasSheetOpen(false)}
            className="px-5"
          />

          <div
            className="flex-1 space-y-1 overflow-y-auto px-3 py-3"
            data-guia="lineas-curriculares"
          >
            {lineas.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-12 text-center text-sm">
                <span>
                  Este plan aún no tiene líneas curriculares; las asignaturas no
                  pueden colocarse en el mapa sin una línea.
                </span>
              </div>
            ) : (
              lineas.map((linea, indice) => {
                const asignadas = asignaturas.filter(
                  (a) => a.lineaCurricularId === linea.id,
                ).length
                const sub = getSubtotalLinea(linea.id)

                return (
                  <div
                    key={linea.id}
                    className="hover:bg-muted/40 rounded-lg px-2 py-2.5 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
                        style={{
                          borderColor: hexToRgba(linea.color || '#1976d2', 0.4),
                          backgroundColor: hexToRgba(
                            linea.color || '#1976d2',
                            0.12,
                          ),
                        }}
                      >
                        <input
                          type="color"
                          aria-label={`Cambiar color de ${linea.nombre}`}
                          value={linea.color || '#1976d2'}
                          disabled={!canEditMapa}
                          onChange={(e) => {
                            void cambiarColorLinea(linea.id, e.target.value)
                          }}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
                        />
                        <Palette
                          className="h-4 w-4"
                          style={{ color: linea.color || '#1976d2' }}
                          aria-hidden
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* El nombre del bloque manda: va primero y con más peso
                          que su descripción y que sus cifras. */}
                        <EditableText
                          value={linea.nombre}
                          editable={canEditMapa}
                          ariaLabel={`Nombre de la línea ${linea.nombre}`}
                          className="block text-base font-semibold"
                          onSave={(val) =>
                            void guardarEdicionLinea(linea.id, val)
                          }
                        />
                        <p className="text-muted-foreground px-1 text-xs tabular-nums">
                          {asignadas === 1
                            ? '1 asignatura'
                            : `${asignadas} asignaturas`}
                          {sub.cr > 0 ? ` · ${sub.cr} cr` : ''}
                        </p>
                      </div>

                      {canEditMapa && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground h-8 w-8"
                                aria-label={`Subir la línea ${linea.nombre}`}
                                disabled={indice === 0}
                                onClick={() => {
                                  void moverLinea(linea.id, -1)
                                }}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Subir</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground h-8 w-8"
                                aria-label={`Bajar la línea ${linea.nombre}`}
                                disabled={indice === lineas.length - 1}
                                onClick={() => {
                                  void moverLinea(linea.id, 1)
                                }}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Bajar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                aria-label={`Eliminar línea ${linea.nombre}`}
                                onClick={() => {
                                  void borrarLinea(linea.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Eliminar línea</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>

                    {/* La línea ES el bloque de conocimiento: aquí se escribe
                        qué organiza. Un solo texto libre en vez de tres campos
                        obligatorios; las tres preguntas viven en el placeholder
                        como guía, no como formulario. */}
                    <EditableText
                      value={linea.descripcion}
                      editable={canEditMapa}
                      multiline
                      placeholder={PLACEHOLDER_BLOQUE}
                      ariaLabel={`Descripción de la línea ${linea.nombre}`}
                      className="text-muted-foreground mt-1 ml-11 block text-sm leading-relaxed whitespace-pre-wrap"
                      onSave={(val) =>
                        void guardarDescripcionLinea(linea.id, val)
                      }
                    />
                  </div>
                )
              })
            )}
          </div>

          {canEditMapa && (
            <div className="border-t px-5 py-4">
              {/* En modo agente el diálogo sobra: sirve para elegir de un
                  catálogo, y aquí quien elige es la IA a partir del mapa. */}
              <Button
                className={cn('w-full', agenteAgregarLinea.halo.className)}
                style={agenteAgregarLinea.halo.style}
                {...(agenteAgregarLinea.enModoAgente
                  ? agenteAgregarLinea.props
                  : { onClick: () => setIsAddLineaDialogOpen(true) })}
              >
                {agenteAgregarLinea.ejecutando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {agenteAgregarLinea.enModoAgente
                  ? 'Agregar línea con IA'
                  : 'Agregar línea'}
              </Button>
              {agenteAgregarLinea.rechazo && (
                <p className="text-muted-foreground animate-in fade-in mt-2 text-xs leading-relaxed">
                  {agenteAgregarLinea.rechazo}
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal de Edición */}
      <Dialog
        open={isAddLineaDialogOpen}
        onOpenChange={(open) => {
          setIsAddLineaDialogOpen(open)
          if (!open) {
            setSelectedLineaOption('')
            setCustomLineaNombre('')
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:w-full sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg font-bold sm:text-xl">
              Agregar línea curricular
            </DialogTitle>
          </DialogHeader>

          <RadioGroup
            value={selectedLineaOption}
            onValueChange={(val) => setSelectedLineaOption(val)}
            className={cn(
              'grid grid-cols-1 gap-6 py-4',
              hayCatalogoDisponible && 'md:grid-cols-[1fr_auto_1fr] md:gap-8',
            )}
          >
            {/* Columna Izquierda: Sugerencias de la facultad (solo licenciatura). */}
            {hayCatalogoDisponible && (
              <div className="space-y-4">
                <div className="text-foreground mb-3 text-sm font-semibold">
                  Sugerencias de la facultad
                </div>

                {/* Sugerencias por facultad (catálogo administrable). */}
                {sugeridasDisponibles.map((sug) => (
                  <div
                    key={sug.id}
                    className="border-input has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 hover:bg-muted/50 relative flex w-full items-start gap-3 rounded-md border p-4 shadow-sm transition-all outline-none"
                  >
                    <RadioGroupItem
                      id={`linea-sug-${sug.id}`}
                      value={`sug:${sug.id}`}
                      className="mt-0.5 size-5 after:absolute after:inset-0 [&_svg]:size-3"
                    />
                    <div className="grid grow gap-1">
                      <Label
                        htmlFor={`linea-sug-${sug.id}`}
                        className="flex cursor-pointer items-center gap-2 font-semibold"
                      >
                        {sug.color && (
                          <span
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: sug.color }}
                          />
                        )}
                        {sug.nombre}
                      </Label>
                      {sug.area && (
                        <p className="text-muted-foreground text-xs">
                          {sug.area}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Tarjeta: Área Común (global, solo licenciatura). */}
                {mostrarAreaComun && (
                  <div className="border-input has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 hover:bg-muted/50 relative flex w-full items-start gap-3 rounded-md border p-4 shadow-sm transition-all outline-none">
                    <RadioGroupItem
                      id="linea-area-comun"
                      value="area_comun"
                      className="mt-0.5 size-5 after:absolute after:inset-0 [&_svg]:size-3"
                    />
                    <div className="grid grow gap-1">
                      <Label
                        htmlFor="linea-area-comun"
                        className="cursor-pointer font-semibold"
                      >
                        Área Común
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Materias compartidas entre programas.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Separador: horizontal en móvil, vertical en escritorio */}
            {hayCatalogoDisponible && (
              <div className="flex items-center justify-center">
                <Separator orientation="horizontal" className="md:hidden" />
                <Separator orientation="vertical" className="hidden md:block" />
              </div>
            )}

            {/* Columna Derecha: Personalizada */}
            <div className="space-y-4">
              <div className="text-foreground mb-3 text-sm font-semibold">
                Línea personalizada
              </div>

              {/* Tarjeta: Custom */}
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault() // Evita que la página haga scroll con el espacio
                    setSelectedLineaOption('custom')
                    inputRef.current?.focus()
                  }
                }}
                onClick={() => {
                  setSelectedLineaOption('custom')
                  inputRef.current?.focus()
                }}
                className={`focus-visible:ring-primary relative flex w-full cursor-pointer items-start gap-3 rounded-md border p-4 shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  selectedLineaOption === 'custom'
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-input hover:bg-muted/50'
                }`}
              >
                {/* Omitimos after:absolute para no tapar el input */}
                <RadioGroupItem
                  id="linea-custom"
                  value="custom"
                  className="mt-0.5 size-5 [&_svg]:size-3"
                />
                <div className="grid w-full grow gap-3">
                  <Label
                    htmlFor="linea-custom"
                    className="cursor-pointer font-semibold"
                  >
                    Otra línea...
                  </Label>
                  <Input
                    ref={inputRef}
                    value={customLineaNombre}
                    onChange={(e) =>
                      setCustomLineaNombre(e.target.value.slice(0, 200))
                    }
                    placeholder="Escribe el nombre aquí"
                    maxLength={200}
                    disabled={selectedLineaOption !== 'custom'}
                    className="bg-background h-9 w-full"
                  />
                </div>
              </div>
            </div>
          </RadioGroup>

          <div className="mt-2 flex items-center justify-end gap-3 border-t pt-4">
            <Button
              className="shadow-md"
              onClick={handleAgregarLinea}
              disabled={!canAddLinea || isCreatingLinea}
            >
              <Plus size={16} /> Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open)
          if (!open) {
            setIsLineaEditorOpen(false)
            setIsSeriacionEditorOpen(false)
            setEditingCarga(null)
            setIsEditingCiclo(false)
          }
        }}
      >
        <DialogContent
          className="w-full overflow-hidden p-0 sm:max-w-4xl"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Editar asignatura</DialogTitle>
          </DialogHeader>

          {editingData ? (
            <div className="max-h-[88vh] overflow-y-auto">
              <div className="space-y-7 px-6 pt-7 pb-5 sm:px-8">
                <div className="space-y-2 pr-8">
                  {/* En modo agente el clic no abre el editor: lo intercepta la
                      IA y reescribe el nombre con las palabras de contexto. */}
                  <span
                    className={cn(
                      'block',
                      agenteNombreAsignatura.halo.className,
                    )}
                    style={agenteNombreAsignatura.halo.style}
                    {...agenteNombreAsignatura.props}
                  >
                    <EditableText
                      value={editingData.nombre}
                      maxLength={200}
                      editable={canEditMapa}
                      ariaLabel={
                        agenteNombreAsignatura.enModoAgente
                          ? 'Ajustar el nombre de la asignatura con IA'
                          : 'Nombre de la asignatura'
                      }
                      placeholder="Nombre de la asignatura"
                      onSave={(nombre) =>
                        setEditingData((current) =>
                          current ? { ...current, nombre } : current,
                        )
                      }
                      className="border-border/70 focus:border-primary block w-full rounded-none border-b px-0 pb-2 text-3xl leading-tight font-bold"
                    />
                  </span>

                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Hash className="size-4" aria-hidden />
                    <span>Clave</span>
                    <EditableText
                      value={editingData.clave}
                      maxLength={100}
                      editable={canEditMapa}
                      ariaLabel="Clave de la asignatura"
                      placeholder="Pendiente"
                      onSave={(clave) =>
                        setEditingData((current) =>
                          current ? { ...current, clave } : current,
                        )
                      }
                      className="text-foreground min-w-16 font-mono font-medium"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 py-3 text-2xl sm:text-3xl">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          'inline-flex items-baseline gap-1 transition-opacity',
                          editingCarga === 'hi' && 'opacity-20',
                          agenteCargaAsignatura.halo.className,
                        )}
                        style={agenteCargaAsignatura.halo.style}
                        {...agenteCargaAsignatura.props}
                      >
                        <EditableNumber
                          value={editingData.hd}
                          min={0}
                          max={999}
                          size="lg"
                          underline
                          overlayControls
                          editable={canEditMapa}
                          ariaLabel={
                            agenteCargaAsignatura.enModoAgente
                              ? 'Ajustar las horas y los créditos con IA'
                              : 'Horas docente'
                          }
                          onEditStart={() => setEditingCarga('hd')}
                          onEditEnd={() => setEditingCarga(null)}
                          onSave={(hd) =>
                            setEditingData((current) =>
                              current ? { ...current, hd: hd ?? 0 } : current,
                            )
                          }
                        />
                        <span
                          className={cn(
                            'text-muted-foreground text-sm font-semibold transition-opacity',
                            editingCarga !== null && 'opacity-20',
                          )}
                        >
                          HD
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {agenteCargaAsignatura.enModoAgente
                        ? 'Ajustar horas y créditos con la IA'
                        : 'Horas docente'}
                    </TooltipContent>
                  </Tooltip>

                  <span
                    className={cn(
                      'inline-flex items-baseline gap-2 transition-opacity',
                      editingCarga === 'hd' && 'opacity-20',
                    )}
                  >
                    <span
                      className={cn(
                        'text-muted-foreground/50 transition-opacity',
                        editingCarga !== null && 'opacity-20',
                      )}
                      aria-hidden
                    >
                      +
                    </span>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            'inline-flex items-baseline gap-1',
                            agenteCargaAsignatura.halo.className,
                          )}
                          style={agenteCargaAsignatura.halo.style}
                          {...agenteCargaAsignatura.props}
                        >
                          <EditableNumber
                            value={editingData.hi}
                            min={0}
                            max={999}
                            size="lg"
                            underline
                            overlayControls
                            editable={canEditMapa}
                            ariaLabel={
                              agenteCargaAsignatura.enModoAgente
                                ? 'Ajustar las horas y los créditos con IA'
                                : 'Horas independientes'
                            }
                            onEditStart={() => setEditingCarga('hi')}
                            onEditEnd={() => setEditingCarga(null)}
                            onSave={(hi) =>
                              setEditingData((current) =>
                                current ? { ...current, hi: hi ?? 0 } : current,
                              )
                            }
                          />
                          <span
                            className={cn(
                              'text-muted-foreground text-sm font-semibold transition-opacity',
                              editingCarga !== null && 'opacity-20',
                            )}
                          >
                            HI
                          </span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {agenteCargaAsignatura.enModoAgente
                          ? 'Ajustar horas y créditos con la IA'
                          : 'Horas independientes'}
                      </TooltipContent>
                    </Tooltip>
                  </span>

                  <span
                    className={cn(
                      'text-muted-foreground/50 transition-opacity',
                      editingCarga !== null && 'opacity-20',
                    )}
                    aria-hidden
                  >
                    =
                  </span>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          'inline-flex items-baseline gap-1 font-bold tabular-nums transition-opacity',
                          editingCarga !== null && 'opacity-20',
                        )}
                      >
                        {(
                          Math.floor(
                            ((editingData.hd + editingData.hi) / 16) * 100,
                          ) / 100
                        ).toFixed(2)}
                        <span className="text-primary text-sm font-semibold">
                          CR
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Créditos calculados</TooltipContent>
                  </Tooltip>
                </div>

                <div className="border-border grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-y py-5 sm:grid-cols-[minmax(11rem,0.7fr)_minmax(16rem,1.3fr)_2.5rem] sm:gap-4">
                  {/* Ciclo y línea son una sola decisión curricular: en modo
                      agente ambos disparan la misma acción, que devuelve la
                      pareja completa. */}
                  <div
                    className={cn(
                      'border-border/70 bg-muted/10 col-span-2 flex h-14 min-w-0 items-center justify-center gap-1 rounded-xl border px-4 sm:col-span-1',
                      agentePosicionAsignatura.enModoAgente && 'cursor-pointer',
                      agentePosicionAsignatura.halo.className,
                    )}
                    style={agentePosicionAsignatura.halo.style}
                    {...agentePosicionAsignatura.props}
                  >
                    <span
                      className={cn(
                        'text-foreground/80 text-sm font-medium transition-opacity',
                        isEditingCiclo && 'opacity-20',
                      )}
                    >
                      {nombreTipoCiclo(data?.tipo_ciclo)}
                    </span>
                    {editingData.ciclo === null ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canEditMapa}
                        onClick={() =>
                          setEditingData({ ...editingData, ciclo: minCiclos })
                        }
                      >
                        <Plus className="size-4" />
                        Añadir
                      </Button>
                    ) : (
                      <EditableNumber
                        value={editingData.ciclo}
                        min={1}
                        max={Math.max(1, ciclosTotales || 1)}
                        underline
                        overlayControls
                        editable={canEditMapa}
                        ariaLabel={
                          agentePosicionAsignatura.enModoAgente
                            ? 'Recolocar la asignatura en el mapa con IA'
                            : nombreTipoCiclo(data?.tipo_ciclo)
                        }
                        onEditStart={() => setIsEditingCiclo(true)}
                        onEditEnd={() => setIsEditingCiclo(false)}
                        onSave={(ciclo) =>
                          setEditingData((current) =>
                            current ? { ...current, ciclo } : current,
                          )
                        }
                        className="text-foreground text-lg font-semibold"
                      />
                    )}
                  </div>

                  <Select
                    value={editingData.lineaCurricularId ?? ''}
                    onValueChange={(lineaCurricularId) =>
                      setEditingData({ ...editingData, lineaCurricularId })
                    }
                    open={isLineaEditorOpen}
                    onOpenChange={setIsLineaEditorOpen}
                    disabled={!canEditMapa || lineas.length === 0}
                  >
                    <SelectTrigger
                      size="lg"
                      className={cn(
                        'relative w-full min-w-0 overflow-hidden border px-4 text-left shadow-none',
                        agentePosicionAsignatura.halo.className,
                      )}
                      style={{
                        ...(editingLinea
                          ? {
                              borderColor: hexToRgba(editingLinea.color, 0.45),
                              backgroundColor: hexToRgba(
                                editingLinea.color,
                                0.1,
                              ),
                            }
                          : {}),
                        ...agentePosicionAsignatura.halo.style,
                      }}
                      {...agentePosicionAsignatura.props}
                    >
                      <SelectValue placeholder="Elegir línea curricular" />
                    </SelectTrigger>
                    <SelectContent>
                      {lineas.map((linea) => (
                        <SelectItem
                          key={linea.id}
                          value={linea.id}
                          className="focus:text-foreground! py-3 transition-colors focus:bg-[var(--linea-hover)]!"
                          style={
                            {
                              '--linea-hover': hexToRgba(linea.color, 0.16),
                            } as CSSProperties
                          }
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className="h-6 w-1 rounded-full"
                              style={{ backgroundColor: linea.color }}
                            />
                            {linea.nombre}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(editingData.ciclo !== null ||
                    editingData.lineaCurricularId !== null) &&
                  canEditMapa ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Quitar asignatura del mapa"
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-10 shrink-0"
                          onClick={() => {
                            setIsLineaEditorOpen(false)
                            setEditingData({
                              ...editingData,
                              ciclo: null,
                              lineaCurricularId: null,
                              prerrequisito_asignatura_id: null,
                            })
                          }}
                        >
                          <X className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Quitar del mapa y de la línea
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="hidden size-10 sm:block" aria-hidden />
                  )}
                </div>

                <div
                  className={cn(
                    'grid items-center gap-4',
                    muestraControlSeriacion
                      ? 'md:grid-cols-[minmax(0,1fr)_15rem]'
                      : 'justify-items-center',
                  )}
                >
                  {muestraControlSeriacion && (
                    <Popover
                      open={
                        agenteSeriacion.enModoAgente
                          ? false
                          : isSeriacionEditorOpen
                      }
                      onOpenChange={setIsSeriacionEditorOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={!canEditMapa}
                          className={cn(
                            'min-w-0 justify-start px-2',
                            agenteSeriacion.halo.className,
                          )}
                          style={agenteSeriacion.halo.style}
                          {...(agenteSeriacion.enModoAgente
                            ? agenteSeriacion.props
                            : {})}
                        >
                          {agenteSeriacion.ejecutando ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Proponiendo seriación…
                            </>
                          ) : editingSeriada ? (
                            <>
                              <GitBranch className="size-4" />
                              <span className="truncate">
                                <span className="text-muted-foreground">
                                  Seriación
                                </span>
                                <span className="mx-2" aria-hidden>
                                  ←
                                </span>
                                <span className="text-foreground font-medium">
                                  {editingSeriada.clave
                                    ? `[${editingSeriada.clave}] `
                                    : ''}
                                  {editingSeriada.nombre}
                                </span>
                              </span>
                            </>
                          ) : (
                            <>
                              <Plus className="size-4" />
                              {agenteSeriacion.enModoAgente
                                ? 'Proponer seriación con IA'
                                : 'Añadir seriación'}
                            </>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-96 p-0">
                        <Command>
                          <CommandInput placeholder="Buscar asignatura…" />
                          <CommandList>
                            <CommandEmpty>
                              No hay asignaturas elegibles.
                            </CommandEmpty>
                            <CommandGroup>
                              {seriacionesElegibles.map((asignatura) => (
                                <CommandItem
                                  key={asignatura.id}
                                  value={`${asignatura.clave} ${asignatura.nombre}`}
                                  onSelect={() => {
                                    setEditingData({
                                      ...editingData,
                                      prerrequisito_asignatura_id:
                                        asignatura.id,
                                    })
                                    setIsSeriacionEditorOpen(false)
                                  }}
                                  className="items-start py-2.5"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium">
                                      {asignatura.nombre}
                                    </span>
                                    <span className="text-muted-foreground block text-xs">
                                      {asignatura.clave || 'Sin clave'} ·{' '}
                                      {formatCiclo(
                                        data?.tipo_ciclo,
                                        asignatura.ciclo,
                                      )}
                                    </span>
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            {editingSeriada && (
                              <>
                                <CommandSeparator />
                                <CommandGroup>
                                  <CommandItem
                                    value="quitar seriación"
                                    className="text-destructive data-[selected=true]:text-destructive"
                                    onSelect={() => {
                                      setEditingData({
                                        ...editingData,
                                        prerrequisito_asignatura_id: null,
                                      })
                                      setIsSeriacionEditorOpen(false)
                                    }}
                                  >
                                    <X className="size-4" />
                                    Quitar seriación
                                  </CommandItem>
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                  {agenteSeriacion.rechazo && (
                    <p className="text-muted-foreground animate-in fade-in text-[11px] leading-snug">
                      {agenteSeriacion.rechazo}
                    </p>
                  )}

                  {/* `rounded-xl` iguala el radio del botón que envuelve: el
                      halo lo hereda, y sin él se dibujaba un marco cuadrado
                      alrededor de un control redondeado. */}
                  <span
                    className={cn(
                      'block rounded-xl',
                      agenteTipoAsignatura.halo.className,
                    )}
                    style={agenteTipoAsignatura.halo.style}
                    {...agenteTipoAsignatura.props}
                  >
                    <EditableSelect
                      value={editingData.tipo}
                      options={['OBLIGATORIA', 'OPTATIVA', 'TRONCAL', 'OTRA']}
                      editable={canEditMapa}
                      ariaLabel={
                        agenteTipoAsignatura.enModoAgente
                          ? 'Ajustar el tipo de la asignatura con IA'
                          : 'Tipo de asignatura'
                      }
                      onSave={(tipo) =>
                        setEditingData((current) =>
                          current
                            ? {
                                ...current,
                                tipo: tipo as
                                  | 'OBLIGATORIA'
                                  | 'OPTATIVA'
                                  | 'TRONCAL'
                                  | 'OTRA',
                              }
                            : current,
                        )
                      }
                      className="justify-center px-2 py-2"
                    />
                  </span>
                </div>
              </div>

              <div className="border-border bg-background/95 sticky bottom-0 flex justify-end border-t px-6 py-4 backdrop-blur sm:px-8">
                <Button
                  onClick={handleSaveChanges}
                  disabled={!canEditMapa}
                  className="h-10 px-5"
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center">No hay datos seleccionados</div>
          )}
        </DialogContent>
      </Dialog>

      {confirmState && (
        <AlertaConflicto
          isOpen={confirmState.isOpen}
          onOpenChange={(open) => {
            if (!open) {
              confirmState.resolve(false)
              setConfirmState(null)
            }
          }}
          onConfirm={() => {
            confirmState.resolve(true)
          }}
          titulo="Conflicto de Seriación"
          descripcion={confirmState.mensaje}
        />
      )}

      <Suspense fallback={null}>
        <VisualizadorSeriacionModal
          asignatura={selectedVisualizacion}
          todasLasAsignaturas={asignaturas}
          lineas={lineas}
          isOpen={isVisualizadorOpen}
          onClose={() => setIsVisualizadorOpen(false)}
        />
      </Suspense>
    </div>
  )
}
