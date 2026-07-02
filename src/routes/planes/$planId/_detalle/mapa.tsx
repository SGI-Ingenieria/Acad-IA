/* eslint-disable jsx-a11y/label-has-associated-control */
import { createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  CheckCheck,
  Download,
  Inbox,
  MoveDown,
  Palette,
  Plus,
  Trash2,
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

import type { TipoAsignatura } from '@/data'
import type { Asignatura } from '@/types/plan'

import { AlertaConflicto } from '@/components/asignaturas/detalle/mapa/AlertaConflicto'
import AsignaturaCardItem from '@/components/planes/detalle/mapa/AsignaturaCardItem'
import { showAppAlert, showAppConfirm } from '@/components/ui/app-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field'
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
import { formatCiclo, nombreTipoCiclo } from '@/lib/ciclo-utils'
import { getPlanDisplayName } from '@/lib/plan-display'
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
}

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

// --- Subcomponentes ---
function StatItem({
  label,
  value,
  total,
}: {
  label: string
  value: number
  total?: number
}) {
  const formattedValue = Number.isFinite(value) ? value.toFixed(2) : value

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="text-foreground font-bold">
        {formattedValue}
        {total ? ` / ${total}` : ''}
      </div>
    </div>
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
  const { data } = usePlan(planId)
  const capabilities = usePlanCapabilities(data)
  const canEditMapa = capabilities.canEditAsignaturas
  const [totalCiclos, setTotalCiclos] = useState(0)
  const [editingLineaId, setEditingLineaId] = useState<string | null>(null)
  const { mutate: createLinea, isPending: isCreatingLinea } = useCreateLinea()
  const { mutate: updateLineaApi } = useUpdateLinea()
  const { mutate: deleteLineaApi } = useDeleteLinea()
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
  // '' = nada; 'area_comun'; 'custom'; o `sug:<id>` para una sugerencia de facultad.
  const [selectedLineaOption, setSelectedLineaOption] = useState<string>('')
  const [customLineaNombre, setCustomLineaNombre] = useState('')
  const [ultimoHue, setUltimoHue] = useState<number | null>(null)
  const { mutate: updateAsignatura } = useUpdateAsignatura()
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

  const [selectedVisualizacion, setSelectedVisualizacion] =
    useState<Asignatura | null>(null)
  const [isVisualizadorOpen, setIsVisualizadorOpen] = useState(false)

  const handleViewSeriacion = (asignatura: Asignatura) => {
    setSelectedVisualizacion(asignatura)
    setIsVisualizadorOpen(true)
  }
  const validarConInterrupcion = async (
    asignaturaId: string,
    nuevoCiclo: number,
  ): Promise<boolean> => {
    const asignatura = asignaturas.find((a) => a.id === asignaturaId)
    if (!asignatura) return true

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
  const handleIntegerChange = (value: string) => {
    if (value === '') return value

    // Solo números, máximo 3 cifras
    const regex = /^\d{1,3}$/

    if (!regex.test(value)) return null

    return value
  }

  const procesarCambioAsignatura = async (
    asignaturaId: string,
    nuevosDatos: Partial<Asignatura>,
  ) => {
    if (!canEditMapa) return
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'modificar una asignatura fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    const asignaturaOriginal = asignaturas.find((a) => a.id === asignaturaId)
    if (!asignaturaOriginal) return

    // ¿Cambió el ciclo? Si es así, validamos seriación
    if (
      nuevosDatos.ciclo !== undefined &&
      nuevosDatos.ciclo !== asignaturaOriginal.ciclo
    ) {
      const acepto = await validarConInterrupcion(
        asignaturaId,
        nuevosDatos.ciclo ?? 0,
      )
      setConfirmState(null)
      if (!acepto) return // El usuario canceló, no guardamos nada
    }

    // Si llegamos aquí, o no cambió el ciclo o el usuario aceptó el conflicto
    const patch = {
      nombre: nuevosDatos.nombre ?? asignaturaOriginal.nombre,
      codigo: nuevosDatos.clave ?? asignaturaOriginal.clave,
      numero_ciclo: nuevosDatos.ciclo,
      linea_plan_id: nuevosDatos.lineaCurricularId,
      horas_academicas: nuevosDatos.hd,
      horas_independientes: nuevosDatos.hi,
      prerrequisito_asignatura_id: nuevosDatos.prerrequisito_asignatura_id,
      tipo: nuevosDatos.tipo?.toUpperCase() as TipoAsignatura,
    }

    const previousAsignaturas = asignaturas
    setAsignaturas((prev) =>
      prev.map((m) => (m.id === asignaturaId ? { ...m, ...nuevosDatos } : m)),
    )
    if (editingData?.id === asignaturaId) {
      setEditingData((prev) => (prev ? { ...prev, ...nuevosDatos } : prev))
    }

    updateAsignatura(
      { asignaturaId, patch: patch as any, adminOverrideReason },
      {
        onSuccess: () => {
          setIsEditModalOpen(false) // Cerramos el modal si estaba abierto
        },
        onError: (err) => {
          console.error('Error al guardar:', err)
          setAsignaturas(previousAsignaturas)
        },
      },
    )
  }
  const handleSaveChanges = () => {
    if (!editingData) return

    // Llamamos a la lógica centralizada que incluye la alerta
    void procesarCambioAsignatura(editingData.id, editingData)
  }
  const unassignedAsignaturas = asignaturas.filter(
    (m) => m.ciclo === null || m.lineaCurricularId === null,
  )
  const unassignedCount = unassignedAsignaturas.length

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
      { lineaId: id, adminOverrideReason },
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

  const seriacionEdges = useMemo(
    () =>
      asignaturas
        .filter((asignatura) => asignatura.prerrequisito_asignatura_id)
        .map((asignatura) => ({
          source: asignatura.prerrequisito_asignatura_id as string,
          target: asignatura.id,
        })),
    [asignaturas],
  )

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

  if (loadingAsig || loadingLineas) return <MapTabSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-border bg-card/70 rounded-2xl border p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold">Mapa Curricular</h2>
            <p className="text-muted-foreground text-sm">
              Organiza las asignaturas de la petición por línea y ciclo
            </p>

            {unassignedCount > 0 && (
              <Badge className="border-border bg-accent/50 text-accent-foreground hover:bg-accent/50 mt-2 inline-flex">
                <AlertTriangle size={14} className="mr-1" />
                {unassignedCount} sin asignar
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:flex-col lg:items-stretch">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium">
                Número de {nombreTipoCiclo(data?.tipo_ciclo).toLowerCase()}s
              </Label>
              <NumberField
                value={ciclosTotales}
                min={minCiclos}
                max={99}
                disabled={!canEditMapa}
                onValueChange={handleCambiarCiclos}
                className="w-full sm:w-44 lg:w-full"
              >
                <NumberFieldGroup className="h-11 shadow-sm">
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldGroup>
              </NumberField>
              {maxCicloUsado > 0 && (
                <p className="text-muted-foreground text-[11px]">
                  Mínimo {minCiclos} (hay materias en el{' '}
                  {nombreTipoCiclo(data?.tipo_ciclo).toLowerCase()}{' '}
                  {maxCicloUsado}).
                </p>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => generateExcel()}
              disabled={
                asignaturas.length === 0 ||
                lineas.length === 0 ||
                asignaturas.every(
                  (a) => a.ciclo === null || a.lineaCurricularId === null,
                )
              }
              className={cn(
                'inline-flex h-11 w-full items-center justify-start gap-2 rounded-md px-8 text-sm font-medium shadow-sm transition-colors sm:flex-1 lg:w-full lg:flex-none',
                'bg-green-100 text-green-900 hover:bg-green-200/80',
                'border border-green-600/30',
                'ring-offset-background focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:outline-none',
                'dark:border-green-500/40 dark:bg-green-900/30 dark:text-green-100 dark:hover:bg-green-900/50',
              )}
            >
              <Download
                size={16}
                className="text-green-700 dark:text-green-400"
              />{' '}
              Exportar a Excel
            </Button>
          </div>

          <div className="border-border bg-card/60 col-span-2 grid grid-cols-2 gap-3 rounded-2xl border p-3 shadow-sm md:grid-cols-4">
            <StatItem label="Total Créditos" value={stats.cr} total={320} />
            <StatItem label="Total HD" value={stats.hd} />
            <StatItem label="Total HI" value={stats.hi} />
            <StatItem label="Total Horas" value={stats.hd + stats.hi} />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-6">
        <div ref={mapOverlayRef} className="relative">
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <marker
                id="seriacion-circle-active"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
              >
                <circle
                  cx="5"
                  cy="5"
                  r="3.5"
                  fill="oklch(0.5332 0.2596 262.6358)"
                />
              </marker>
            </defs>

            {seriacionEdges.map((edge) => {
              const sourceRect = cardRects[edge.source]
              const targetRect = cardRects[edge.target]

              if (!sourceRect || !targetRect) return null

              const isHighlighted =
                highlightedChainIds !== null &&
                highlightedChainIds.has(edge.source) &&
                highlightedChainIds.has(edge.target)

              return (
                <path
                  key={`${edge.source}-${edge.target}`}
                  d={getBezierPath(sourceRect, targetRect)}
                  fill="none"
                  stroke={
                    isHighlighted
                      ? 'oklch(0.5332 0.2596 262.6358)'
                      : 'rgba(100, 116, 139, 0.24)'
                  }
                  strokeWidth={isHighlighted ? 2.2 : 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd={
                    isHighlighted
                      ? 'url(#seriacion-circle-active)'
                      : 'url(#seriacion-circle-low)'
                  }
                  opacity={isHighlighted ? 1 : 0.35}
                />
              )
            })}
          </svg>

          <div
            className="grid gap-3 pl-1"
            style={{
              gridTemplateColumns: `140px repeat(${ciclosTotales}, 188px) 120px`,
            }}
          >
            <div className="text-muted-foreground self-end px-2 text-xs font-bold">
              LÍNEA CURRICULAR
            </div>

            {ciclosArray.map((n) => (
              <div
                key={`header-${n}`}
                className="bg-muted/70 text-muted-foreground border-border/70 rounded-xl border p-2 text-center text-sm font-bold"
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
                    className={`group relative flex flex-col gap-2 rounded-xl border p-3 transition-all ${editingLineaId === linea.id ? 'ring-primary/30 ring-2' : 'cursor-text'}`}
                    style={{
                      borderColor: hexToRgba(linea.color || '#1976d2', 0.24),
                      backgroundColor:
                        editingLineaId === linea.id
                          ? hexToRgba(linea.color || '#1976d2', 0.12)
                          : hexToRgba(linea.color || '#1976d2', 0.08),
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            contentEditable
                            role="textbox"
                            tabIndex={0}
                            aria-label={`Nombre de línea ${linea.nombre}`}
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
                            className="text-foreground hover:text-foreground/85 block w-full cursor-text text-sm leading-snug wrap-break-word transition-colors outline-none"
                          >
                            {linea.nombre}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-sm">
                          {linea.nombre}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="border-border/70 bg-background relative inline-flex h-8 w-8 items-center justify-center rounded-md border"
                          style={{
                            borderColor: hexToRgba(
                              linea.color || '#1976d2',
                              0.35,
                            ),
                          }}
                        >
                          <input
                            type="color"
                            aria-label="Cambiar color de línea"
                            value={linea.color || '#1976d2'}
                            onChange={(e) => {
                              void cambiarColorLinea(linea.id, e.target.value)
                            }}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                          <Palette
                            className="text-muted-foreground h-4 w-4"
                            aria-hidden
                          />
                        </div>

                        <div
                          className="border-border/70 h-5 w-5 rounded-full border"
                          style={{ backgroundColor: linea.color || '#1976d2' }}
                          aria-hidden
                        />
                      </div>

                      <button
                        type="button"
                        aria-label="Eliminar línea"
                        onClick={() => {
                          void borrarLinea(linea.id)
                        }}
                        disabled={!canEditMapa}
                        className="text-destructive/80 hover:text-destructive hover:bg-destructive/10 inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
                      className={`min-h-54 space-y-2 rounded-xl border border-dashed p-1.5 transition-colors ${
                        draggedAsignatura
                          ? 'border-primary/35 bg-primary/6'
                          : 'border-border/70 bg-muted/15'
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
                    </div>
                  ))}

                  <div
                    className={`flex flex-col justify-center rounded-xl border p-4 text-[11px] font-medium ${
                      sub.cr === 0 && sub.hd === 0 && sub.hi === 0
                        ? 'border-border/50 bg-muted/20 text-muted-foreground/70'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    {sub.cr === 0 && sub.hd === 0 && sub.hi === 0 ? (
                      <div className="text-muted-foreground">—</div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-foreground font-bold">
                          Cr: {sub.cr}
                        </div>
                        <div>
                          HD: {sub.hd} • HI: {sub.hi}
                        </div>
                      </div>
                    )}
                  </div>
                </Fragment>
              )
            })}

            <div className="col-span-full">
              <div className="sticky left-0 z-10 w-35">
                <Button
                  className="shadow-md"
                  onClick={() => {
                    if (canEditMapa) setIsAddLineaDialogOpen(true)
                  }}
                  disabled={!canEditMapa}
                >
                  <Plus size={14} /> Agregar línea
                </Button>
              </div>
            </div>

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
                      <div className="text-foreground font-bold">
                        Cr: {t.cr}
                      </div>
                      <div>
                        HD: {t.hd} • HI: {t.hi}
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            <div className="text-accent-foreground border-accent/40 bg-accent flex flex-col justify-center rounded-xl border p-2 text-center text-xs font-bold shadow-sm">
              <div>{stats.cr} Cr</div>
              <div>{stats.hd + stats.hi} Hrs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Asignaturas Sin Asignar */}
      <div className="border-border bg-card/80 mt-6 rounded-[28px] border p-5 shadow-sm backdrop-blur-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="bg-muted text-muted-foreground flex h-9 w-9 items-center justify-center rounded-2xl">
                <Inbox className="h-4.5 w-4.5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-foreground text-sm font-bold tracking-wide uppercase">
                    Bandeja de entrada
                  </h3>

                  <div className="bg-muted text-muted-foreground inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-semibold">
                    {unassignedAsignaturas.length}
                  </div>
                </div>

                <p className="text-muted-foreground mt-0.5 text-sm">
                  Asignaturas sin ciclo o línea curricular
                </p>
              </div>
            </div>
          </div>

          <div className="border-border bg-background/80 text-muted-foreground flex items-center gap-2 rounded-full border border-dashed px-3 py-1.5 text-xs">
            <MoveDown className="h-3.5 w-3.5" />
            <span>Arrastra aquí para desasignar</span>
          </div>
        </div>

        <div
          onDragOver={handleDragOver}
          onDrop={(e) => (canEditMapa ? handleDrop(e, null, null) : undefined)}
          className={[
            'rounded-3xl border-2 border-dashed p-4 transition-all duration-300',
            'min-h-55',
            draggedAsignatura
              ? 'border-primary/35 bg-primary/6 shadow-inner'
              : 'border-border bg-muted/20',
          ].join(' ')}
        >
          {unassignedAsignaturas.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {unassignedAsignaturas.map((m) => (
                <div
                  key={m.id}
                  className={[
                    'w-fit shrink-0 transition-opacity duration-200',
                    highlightedChainIds && !highlightedChainIds.has(m.id)
                      ? 'opacity-25'
                      : 'opacity-100',
                  ].join(' ')}
                >
                  <AsignaturaCardItem
                    asignatura={m}
                    lineaColor="#94A3B8"
                    lineaNombre="Sin asignar"
                    isDragging={draggedAsignatura === m.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                      if (!canEditMapa) return
                      setEditingData(m)
                      setIsEditModalOpen(true)
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="border-border/70 bg-background/70 flex min-h-47 flex-col items-center justify-center rounded-[20px] border px-6 text-center">
              <div className="bg-muted text-muted-foreground mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
                <CheckCheck className="h-5 w-5" />
              </div>

              <p className="text-foreground text-sm font-semibold">
                No hay asignaturas pendientes
              </p>

              <p className="text-muted-foreground mt-1 max-w-md text-sm">
                Todo está colocado en el mapa. Arrastra una asignatura aquí para
                quitarle ciclo y línea curricular.
              </p>
            </div>
          )}
        </div>
      </div>

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

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent
          className="w-full overflow-hidden p-0 sm:max-w-5xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="border-border bg-card/60 border-b px-6 py-5">
            <DialogTitle className="text-foreground text-xl font-bold tracking-tight">
              Editar Asignatura
            </DialogTitle>
          </DialogHeader>

          {/* Verificación de seguridad: solo renderiza si hay datos */}
          {editingData ? (
            <div className="max-h-[calc(88vh-140px)] space-y-5 overflow-y-auto px-6 py-5">
              {/* Bloque 1: Identificación */}
              <section className="border-border/70 bg-background/40 space-y-4 rounded-2xl border p-4">
                <div className="text-foreground/90 text-sm font-semibold">
                  Identificación
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Clave
                    </label>
                    <Input
                      maxLength={100}
                      value={editingData.clave}
                      onChange={(e) =>
                        setEditingData({
                          ...editingData,
                          clave: e.target.value,
                        })
                      }
                      className="h-10 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Nombre
                    </label>
                    <Input
                      maxLength={200}
                      value={editingData.nombre}
                      onChange={(e) =>
                        setEditingData({
                          ...editingData,
                          nombre: e.target.value,
                        })
                      }
                      className="h-10 shadow-sm"
                    />
                  </div>
                </div>
              </section>

              {/* Bloque 2: Carga horaria */}
              <section className="border-border/70 bg-background/40 space-y-4 rounded-2xl border p-4">
                <div className="text-foreground/90 text-sm font-semibold">
                  Carga horaria
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      HD (Horas Docente)
                    </label>
                    <Input
                      type="number"
                      value={editingData.hd}
                      onChange={(e) => {
                        const val = handleIntegerChange(e.target.value)
                        if (val !== null) {
                          setEditingData({
                            ...editingData,
                            hd: Number(e.target.value),
                          })
                        }
                      }}
                      className="h-10 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      HI (Horas Indep.)
                    </label>
                    <Input
                      type="number"
                      value={editingData.hi}
                      onChange={(e) => {
                        const val = handleIntegerChange(e.target.value)
                        if (val !== null) {
                          setEditingData({
                            ...editingData,
                            hi: Number(e.target.value),
                          })
                        }
                      }}
                      className="h-10 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-muted-foreground text-xs font-medium tracking-wider uppercase dark:text-white/60">
                      Créditos
                    </label>
                    <div className="border-input bg-muted/40 flex h-10 items-center rounded-md border px-3 text-sm font-semibold shadow-sm">
                      {(
                        Math.floor(
                          ((editingData.hd + editingData.hi) / 16) * 100,
                        ) / 100
                      ).toFixed(2)}
                    </div>
                    <p className="text-muted-foreground text-[10px]">
                      (HD + HI) ÷ 16
                    </p>
                  </div>
                </div>
              </section>

              {/* Bloque 3: Organización */}
              <section className="border-border/70 bg-background/40 space-y-4 rounded-2xl border p-4">
                <div className="text-foreground/90 text-sm font-semibold">
                  Organización
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Ciclo
                    </label>
                    <div className="flex items-center gap-2">
                      <NumberField
                        value={editingData.ciclo}
                        min={1}
                        max={Math.max(1, ciclosTotales || 1)}
                        onValueChange={(value) =>
                          setEditingData({
                            ...editingData,
                            ciclo: value,
                          })
                        }
                        className="min-w-0 flex-1"
                      >
                        <NumberFieldGroup className="h-10 shadow-sm">
                          <NumberFieldDecrement />
                          <NumberFieldInput placeholder="Sin asignar" />
                          <NumberFieldIncrement />
                        </NumberFieldGroup>
                      </NumberField>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditingData({ ...editingData, ciclo: null })
                        }
                      >
                        Sin asignar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Línea Curricular
                    </label>
                    <Select
                      value={editingData.lineaCurricularId || 'unassigned'}
                      onValueChange={(val) =>
                        setEditingData({
                          ...editingData,
                          lineaCurricularId: val === 'unassigned' ? null : val,
                        })
                      }
                    >
                      <SelectTrigger className="h-10 shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          -- Sin Asignar --
                        </SelectItem>
                        {lineas.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Bloque 4: Dependencias y tipo */}
              <section className="border-border/70 bg-background/40 space-y-4 rounded-2xl border p-4">
                <div className="text-foreground/90 text-sm font-semibold">
                  Configuración académica
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Seriación (Prerrequisito)
                  </label>
                  <Select
                    value={editingData.prerrequisito_asignatura_id || undefined}
                    onValueChange={(val) => {
                      console.log(editingData)

                      setEditingData({
                        ...editingData,
                        prerrequisito_asignatura_id:
                          val === 'none' ? null : val,
                      })
                    }}
                  >
                    <SelectTrigger className="h-10 w-full bg-white shadow-sm">
                      <SelectValue placeholder="Seleccionar asignatura..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Sin Seriación --</SelectItem>

                      {asignaturas
                        .filter((asig) => {
                          const noEsMisma = asig.id !== editingData.id
                          const esCicloMenor =
                            asig.ciclo !== null &&
                            editingData.ciclo !== null &&
                            asig.ciclo < editingData.ciclo

                          return noEsMisma && esCicloMenor
                        })
                        .sort(
                          (a, b) =>
                            (a.ciclo || 0) - (b.ciclo || 0) ||
                            a.nombre.localeCompare(b.nombre),
                        )
                        .map((asig) => (
                          <SelectItem key={asig.id} value={asig.id}>
                            <span className="text-primary font-bold">
                              [C{asig.ciclo}]
                            </span>{' '}
                            {asig.nombre}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Tipo
                    </label>
                    <Select
                      value={editingData.tipo}
                      onValueChange={(val: 'OBLIGATORIA' | 'OPTATIVA') =>
                        setEditingData({ ...editingData, tipo: val })
                      }
                    >
                      <SelectTrigger className="h-10 shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OBLIGATORIA">Obligatoria</SelectItem>
                        <SelectItem value="OPTATIVA">Optativa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border-border/60 bg-muted/30 text-muted-foreground flex items-center rounded-xl border px-3 text-sm">
                    Ajusta ciclo y seriación con cuidado para evitar conflictos.
                  </div>
                </div>
              </section>

              <div className="border-border bg-background/95 sticky bottom-0 -mx-6 mt-2 flex justify-end gap-3 border-t px-6 py-4 backdrop-blur">
                <Button
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-10 px-5"
                >
                  Cancelar
                </Button>
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
