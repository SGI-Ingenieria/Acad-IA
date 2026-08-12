import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  Calculator,
  Download,
  GitBranch,
  Hash,
  Layers,
  Loader2,
  Plus,
  Sparkles,
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
  PayloadProponerPrerrequisito,
  PayloadProponerParaCelda,
  PayloadReorganizarMapa,
  ResultadoAjustarCreditosHoras,
  ResultadoAsignarAsignatura,
  ResultadoMejorarCampo,
  ResultadoProponerPrerrequisito,
  ResultadoProponerParaCelda,
  ResultadoReorganizarMapa,
  TipoAsignatura,
} from '@/data'
import type { OpcionesAccionAgente } from '@/features/agente'
import type { Asignatura } from '@/types/plan'
import type { CSSProperties } from 'react'

import { AlertaConflicto } from '@/components/asignaturas/detalle/mapa/AlertaConflicto'
import AsignaturaCardItem from '@/components/planes/detalle/mapa/AsignaturaCardItem'
import { showAppAlert } from '@/components/ui/app-alert-dialog'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { MapTabSkeleton } from '@/components/ui/route-pending-skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  usePlan,
  usePlanAsignaturas,
  usePlanLineas,
  useUpdateAsignatura,
  useUpdatePlanFields,
  useUpdatePlanDesignPhase,
} from '@/data'
import { fetchPlanExcel } from '@/data/api/document.api'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import { AccionAgente, useAccionAgente } from '@/features/agente'
import { BarraVistaCurricular } from '@/features/planes/curriculo/BarraVistaCurricular'
import {
  Flip,
  gsap,
  organicDuration,
  organicEase,
  prefersReducedMotion,
} from '@/lib/animations'
import { descripcionBloque } from '@/lib/bloques-conocimiento'
import { formatCiclo, nombreTipoCiclo } from '@/lib/ciclo-utils'
import { HORAS_POR_CREDITO } from '@/lib/creditos-utils'
import {
  colorLineaCurricular,
  PALETA_LINEAS_CURRICULARES,
} from '@/lib/linea-curricular-colors'
import { getPlanDisplayName } from '@/lib/plan-display'
import { cn } from '@/lib/utils'

const VisualizadorSeriacionModal = lazy(() =>
  import('@/components/planes/detalle/mapa/VisualizadorSeriacionModal').then(
    (m) => ({ default: m.VisualizadorSeriacionModal }),
  ),
)

// --- Mapeadores (Fuera del componente para mayor limpieza) ---
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
    color: colorLineaCurricular(linea, index),
    descripcion: descripcionBloque(linea),
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
        <p className="text-muted-foreground animate-in fade-in px-micro pb-micro text-[11px] leading-snug">
          {agente.rechazo}
        </p>
      )}
      <PopoverContent className="w-72" spacing="flush" align="start">
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
                  <span className="text-muted-foreground ml-relacionado shrink-0 text-xs tabular-nums">
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
  const { data: asignaturaApi, isLoading: loadingAsig } =
    usePlanAsignaturas(planId)
  const { data: lineasApi, isLoading: loadingLineas } = usePlanLineas(planId)
  const [asignaturas, setAsignaturas] = useState<Array<Asignatura>>([])
  const [lineas, setLineas] = useState<Array<LineaCurricularUI>>([])
  const [draggedAsignatura, setDraggedAsignatura] = useState<string | null>(
    null,
  )
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const { mutateAsync: updateAsignatura } = useUpdateAsignatura()
  const { mutate: updatePlanFields } = useUpdatePlanFields()
  const { mutate: actualizarFaseDiseno } = useUpdatePlanDesignPhase()
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
      if (
        cambioNormalizado.ciclo != null &&
        cambioNormalizado.lineaCurricularId != null &&
        data?.fase_diseno !== 'MAPA'
      ) {
        actualizarFaseDiseno({ planId, fase: 'MAPA' })
      }
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
      if (
        data?.fase_diseno !== 'MAPA' &&
        [...destinos.values()].some(
          (destino) =>
            destino.ciclo != null && destino.lineaCurricularId != null,
        )
      ) {
        actualizarFaseDiseno({ planId, fase: 'MAPA' })
      }
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
  const coloresLineas =
    lineas.length > 0 ? lineas.map((l) => l.color) : PALETA_LINEAS_CURRICULARES

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

  /**
   * Estado previo de un reacomodo. El mapa sólo mueve asignaturas entre los
   * bloques ya definidos; crear o reordenar la estructura corresponde a la
   * vista de Bloques de conocimiento.
   */
  type SnapshotReorganizacion = {
    posiciones: Array<PosicionAsignatura>
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

  const aplicarReorganizacion = async (resultado: ResultadoReorganizarMapa) => {
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'reorganizar el mapa curricular fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason) {
      throw new Error('Falta el motivo para reorganizar fuera de etapa.')
    }

    capturarLayoutMapa()

    // Una propuesta del mapa nunca crea estructura curricular. Si el modelo
    // sugiere líneas nuevas, se omiten y se mantienen visibles como trabajo
    // pendiente para la vista conceptual de Bloques de conocimiento.
    const lineasValidas = new Set(lineas.map((linea) => linea.id))
    const movimientos = resultado.movimientos
      .map((movimiento) => ({
        id: movimiento.asignatura_id,
        ciclo: movimiento.numero_ciclo,
        lineaCurricularId: movimiento.linea,
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
        seriaciones: asignaturas
          .filter((a) => tocadas.has(a.id))
          .map((a) => ({
            id: a.id,
            prerrequisito: a.prerrequisito_asignatura_id ?? null,
          })),
      }
    },
    aplicar: (resultado) => aplicarReorganizacion(resultado),
    restaurar: (snapshot) => deshacerReorganizacion(snapshot),
  })

  const agenteReorganizarTodo = useAccionAgente(opcionesReorganizar())

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

  const renderSeriacionEdges = (soloDestacadas: boolean) =>
    seriacionEdges.map((edge) => {
      const sourceRect = cardRects[edge.source]
      const targetRect = cardRects[edge.target]

      if (!sourceRect || !targetRect) return null

      const isHighlighted =
        highlightedChainIds !== null &&
        highlightedChainIds.has(edge.source) &&
        highlightedChainIds.has(edge.target)

      if (isHighlighted !== soloDestacadas) return null

      const colorTrazo =
        edge.colorDestino ?? edge.colorOrigen ?? SERIACION_COLOR_NEUTRO
      const capa = soloDestacadas ? 'destacada' : 'base'
      const gradienteId = `seriacion-degradado-${capa}-${edge.source}-${edge.target}`
      const puntaId = `seriacion-punta-${capa}-${edge.source}-${edge.target}`

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
                <stop offset="100%" stopColor={edge.colorDestino ?? ''} />
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
            stroke={edge.degradado ? `url(#${gradienteId})` : colorTrazo}
            strokeWidth={soloDestacadas ? 2.2 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={`url(#${puntaId})`}
            opacity={soloDestacadas ? 1 : 0.35}
          />
        </g>
      )
    })

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
    <div
      ref={contenedorMapaRef}
      className="space-y-seccion"
      data-guia="mapa-curricular"
    >
      {/* Toolbar: créditos como dato principal; horas consultables en discreto */}
      <BarraVistaCurricular
        contexto={
          unassignedCount > 0 ? (
            <Badge className="border-border bg-accent/50 text-accent-foreground hover:bg-accent/50">
              <AlertTriangle size={14} className="mr-micro" />
              {unassignedCount} sin asignar
            </Badge>
          ) : undefined
        }
      >
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
                className={cn('h-9 w-9', agenteReorganizarTodo.halo.className)}
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
            <TooltipContent>Reorganizar todo el mapa con la IA</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label="Ver bloques de conocimiento"
              data-guia="alternar-vista-curricular"
              onClick={() =>
                void navigate({
                  to: '/planes/$planId/bloques',
                  params: { planId },
                  resetScroll: false,
                  viewTransition: true,
                })
              }
            >
              <Layers className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver bloques de conocimiento</TooltipContent>
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
      </BarraVistaCurricular>

      <div className="pb-seccion overflow-x-auto">
        <div ref={mapOverlayRef} className="relative">
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            {renderSeriacionEdges(false)}
          </svg>

          <div
            className="gap-control pl-micro grid"
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
                  className="hover:bg-muted/50 focus-visible:ring-ring/40 gap-relacionado px-relacionado py-micro flex items-baseline rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
                className="bg-card dark:bg-muted/70 text-muted-foreground border-border/80 dark:border-border/70 p-relacionado rounded-xl border text-center text-sm font-bold shadow-xs dark:shadow-none"
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
                  <div
                    className="group gap-relacionado p-control relative flex flex-col rounded-xl border transition-all"
                    style={{
                      borderColor: hexToRgba(linea.color || '#1976d2', 0.24),
                      backgroundColor: hexToRgba(
                        linea.color || '#1976d2',
                        0.08,
                      ),
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-foreground block w-full cursor-default text-sm leading-snug wrap-break-word outline-none">
                            {linea.nombre}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-sm">
                          {linea.nombre}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div
                      className="mt-auto h-1.5 w-8 rounded-full"
                      style={{ backgroundColor: linea.color || '#1976d2' }}
                      aria-hidden
                    />
                  </div>

                  {ciclosArray.map((cicloNumero) => (
                    <div
                      key={`${linea.id}-${cicloNumero}`}
                      onDragOver={handleDragOver}
                      onDrop={(e) =>
                        canEditMapa
                          ? handleDrop(e, cicloNumero, linea.id)
                          : undefined
                      }
                      className={`gap-relacionado p-relacionado flex min-h-48 flex-col rounded-xl border border-dashed transition-colors ${
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
                              onDragEnd={handleDragEnd}
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
                            'p-grupo flex flex-col justify-center rounded-xl border text-[11px] font-medium',
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
                            <div className="space-y-micro">
                              <div className="text-foreground text-base font-bold tabular-nums">
                                {sub.cr}
                                <span className="text-muted-foreground ml-micro text-[10px] font-medium">
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

            <div className="border-border my-relacionado col-span-full border-t"></div>

            <div className="text-foreground p-relacionado self-center font-bold">
              Totales por {nombreTipoCiclo(data?.tipo_ciclo)}
            </div>

            {ciclosArray.map((cicloNumero) => {
              const t = getTotalesCiclo(cicloNumero)
              const isEmpty = t.cr === 0 && t.hd === 0 && t.hi === 0

              return (
                <div
                  key={`footer-${cicloNumero}`}
                  className={`p-relacionado rounded-xl border text-center text-[11px] ${
                    isEmpty
                      ? 'border-border/50 bg-muted/30 text-muted-foreground'
                      : 'border-border bg-card'
                  }`}
                >
                  {isEmpty ? (
                    <div className="text-muted-foreground py-micro text-xs">
                      —
                    </div>
                  ) : (
                    <>
                      <div className="text-foreground text-base font-bold tabular-nums">
                        {t.cr}
                        <span className="text-muted-foreground ml-micro text-[10px] font-medium">
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

            <div className="text-accent-foreground border-accent/40 bg-accent p-relacionado flex flex-col justify-center rounded-xl border text-center shadow-sm">
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

          {highlightedChainIds && (
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 z-60 h-full w-full overflow-visible"
            >
              {renderSeriacionEdges(true)}
            </svg>
          )}
        </div>
      </div>

      {/* Asignaturas sin asignar: bandeja plana, también es dropzone para desasignar */}
      {unassignedAsignaturas.length > 0 && (
        <div
          onDragOver={handleDragOver}
          onDrop={(e) => (canEditMapa ? handleDrop(e, null, null) : undefined)}
          aria-label="Asignaturas pendientes de asignar"
          className={[
            'p-grupo rounded-2xl border-2 border-dashed transition-colors',
            draggedAsignatura
              ? 'border-primary/35 bg-primary/6'
              : 'border-border bg-muted/20',
          ].join(' ')}
        >
          <p className="text-muted-foreground mb-control text-[10px] font-bold tracking-widest uppercase">
            Pendientes
          </p>
          <div className="gap-grupo flex flex-wrap">
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
                      <p className="text-muted-foreground animate-in fade-in mt-micro max-w-44 text-[11px] leading-snug">
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
            <div
              className="asignatura-acento max-h-[88vh] overflow-y-auto"
              style={
                {
                  '--asignatura-acento':
                    editingLinea?.color ?? 'var(--primary)',
                } as CSSProperties
              }
            >
              <div className="space-y-region px-seccion pt-region pb-seccion sm:px-region">
                <div className="space-y-relacionado pr-region">
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
                      className="subrayado-acento border-border/70 pb-relacionado block w-full rounded-none border-b px-0 text-3xl leading-tight font-bold"
                    />
                  </span>

                  <div className="text-muted-foreground gap-relacionado flex items-center text-sm">
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

                <div className="gap-x-relacionado gap-y-relacionado py-control flex flex-wrap items-center justify-center text-2xl sm:text-3xl">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          'gap-micro inline-flex items-baseline transition-opacity',
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
                          className="subrayado-acento"
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
                      'gap-relacionado inline-flex items-baseline transition-opacity',
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
                            'gap-micro inline-flex items-baseline',
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
                            className="subrayado-acento"
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
                          'gap-micro inline-flex items-baseline font-bold tabular-nums transition-opacity',
                          editingCarga !== null && 'opacity-20',
                        )}
                      >
                        {(
                          Math.floor(
                            ((editingData.hd + editingData.hi) / 16) * 100,
                          ) / 100
                        ).toFixed(2)}
                        <span
                          className="text-primary text-sm font-semibold"
                          style={
                            editingLinea
                              ? { color: editingLinea.color }
                              : undefined
                          }
                        >
                          CR
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Créditos calculados</TooltipContent>
                  </Tooltip>
                </div>

                <div className="border-border gap-control py-seccion sm:gap-grupo grid grid-cols-[minmax(0,1fr)_auto] items-center border-y sm:grid-cols-[minmax(11rem,0.7fr)_minmax(16rem,1.3fr)_2.5rem]">
                  {/* Ciclo y línea son una sola decisión curricular: en modo
                      agente ambos disparan la misma acción, que devuelve la
                      pareja completa. */}
                  <div
                    className={cn(
                      'border-border/70 bg-muted/10 gap-micro px-grupo col-span-2 flex h-14 min-w-0 items-center justify-center rounded-xl border sm:col-span-1',
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
                        className="subrayado-acento text-foreground text-lg font-semibold"
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
                        'subrayado-acento px-relacionado relative w-full min-w-0 overflow-hidden rounded-none border-0 border-b-2 bg-transparent text-left shadow-none',
                        agentePosicionAsignatura.halo.className,
                      )}
                      style={{
                        ...(editingLinea
                          ? {
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
                          className="focus:text-foreground! py-control transition-colors focus:bg-[var(--linea-hover)]!"
                          style={
                            {
                              '--linea-hover': hexToRgba(linea.color, 0.16),
                            } as CSSProperties
                          }
                        >
                          <span className="gap-control flex items-center">
                            <span
                              className="h-3 w-3 rounded-full"
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
                    'gap-grupo grid items-center',
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
                            'px-relacionado min-w-0 justify-start',
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
                                <span className="mx-relacionado" aria-hidden>
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
                      <PopoverContent
                        align="start"
                        spacing="flush"
                        className="w-96"
                      >
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
                                  className="py-control items-start"
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
                      underline
                      className="subrayado-acento px-relacionado py-relacionado justify-center"
                    />
                  </span>
                </div>
              </div>

              <div className="border-border bg-background/95 px-seccion py-grupo sm:px-region sticky bottom-0 flex justify-end border-t backdrop-blur">
                <Button
                  onClick={handleSaveChanges}
                  disabled={!canEditMapa}
                  className="px-seccion h-10"
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-exhibicion text-center">
              No hay datos seleccionados
            </div>
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
