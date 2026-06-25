import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { Minus, Pencil, Plus, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { AsignaturaDetail } from '@/data'
import type { Asignatura } from '@/data/types/domain'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { usePlan, usePlanAsignaturas } from '@/data'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import { useSubject, useUpdateAsignatura } from '@/data/hooks/useSubjects'
import {
  getOrganicMotion,
  gsap,
  organicEase,
  organicDuration,
  useGSAP,
} from '@/lib/animations'
import { nombreTipoCiclo } from '@/lib/ciclo-utils'

export interface BibliografiaEntry {
  id: string
  tipo: 'BASICA' | 'COMPLEMENTARIA'
  cita: string
  fuenteBibliotecaId?: string
  fuenteBiblioteca?: any
}
export interface BibliografiaTabProps {
  id: string
  bibliografia: Array<BibliografiaEntry>
  onSave: (bibliografia: Array<BibliografiaEntry>) => void
  isSaving: boolean
}

export interface AsignaturaDatos {
  [key: string]: string
}

export interface AsignaturaResponse {
  datos: AsignaturaDatos
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type CriterioEvaluacionRow = {
  criterio: string
  porcentaje: number
}

type CriterioEvaluacionRowDraft = {
  id: string
  criterio: string
  porcentaje: string // allow empty while editing
}

type RequisitoAsignatura = {
  type: 'Pre-requisito'
  code: string | null
  name: string
  id: string
}

export const Route = createFileRoute(
  '/planes/$planId/asignaturas/$asignaturaId',
)({
  component: AsignaturaDetailPage,
})

export default function AsignaturaDetailPage() {
  const { asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { planId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { data: asignaturaApi, refetch: refetchAsignatura } =
    useSubject(asignaturaId)
  const { data: asignaturasApi } = usePlanAsignaturas(planId)
  const [asignatura, setAsignatura] = useState<AsignaturaDetail | null>(null)
  const updateAsignatura = useUpdateAsignatura()

  const handlePersistDatoGeneral = (
    clave: string,
    value: string,
    adminOverrideReason?: string | null,
  ) => {
    const baseDatos = asignatura?.datos ?? (asignaturaApi as any)?.datos ?? {}
    const mergedDatos = { ...baseDatos, [clave]: value }

    // Mantener estado local coherente para merges posteriores.
    setAsignatura((prev) => ({
      ...((prev ?? asignaturaApi ?? {}) as any),
      datos: mergedDatos,
    }))

    updateAsignatura.mutate({
      asignaturaId,
      patch: {
        datos: mergedDatos,
      },
      adminOverrideReason,
    })
  }

  const asignaturaSeriada = useMemo(() => {
    if (!asignaturaApi?.prerrequisito_asignatura_id || !asignaturasApi)
      return null
    return asignaturasApi.find(
      (asig) => asig.id === asignaturaApi.prerrequisito_asignatura_id,
    )
  }, [asignaturaApi, asignaturasApi])
  const requisitosFormateados: Array<RequisitoAsignatura> = useMemo(() => {
    if (!asignaturaSeriada) return []
    return [
      {
        type: 'Pre-requisito',
        code: asignaturaSeriada.codigo,
        name: asignaturaSeriada.nombre,
        id: asignaturaSeriada.id, // Guardamos el ID para el select
      },
    ]
  }, [asignaturaSeriada])

  /* ---------- sincronizar API ---------- */
  useEffect(() => {
    if (
      asignaturaApi &&
      !asignaturaApi.estructuras_asignatura &&
      asignaturaApi.estructura_id
    ) {
      console.log('REFETCH ASIGNATURA...')

      const t = setTimeout(() => {
        refetchAsignatura()
      }, 1000)

      return () => clearTimeout(t)
    }
  }, [asignaturaApi, refetchAsignatura])

  useEffect(() => {
    if (asignaturaApi) setAsignatura(asignaturaApi)
  }, [asignaturaApi, requisitosFormateados])

  return (
    <DatosGenerales
      pre={requisitosFormateados}
      availableSubjects={asignaturasApi}
      onPersistDato={handlePersistDatoGeneral}
    />
  )
}

function DatosGenerales({
  onPersistDato,
  pre,
  availableSubjects,
}: {
  onPersistDato: (
    clave: string,
    value: string,
    adminOverrideReason?: string | null,
  ) => void
  pre: Array<RequisitoAsignatura>
  availableSubjects?: Array<Asignatura>
}) {
  const { asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { data: data, isLoading: isLoading } = useSubject(asignaturaId)
  const updateAsignatura = useUpdateAsignatura()

  // 1. Extraemos la definición de la estructura (los metadatos)
  const definicionRaw = data?.estructuras_asignatura?.definicion
  const definicion = isRecord(definicionRaw)
    ? (definicionRaw as Record<string, unknown>)
    : null

  const propertiesRaw = definicion ? (definicion as any).properties : undefined
  const structureProps = isRecord(propertiesRaw)
    ? (propertiesRaw as Record<string, any>)
    : {}

  // 2. Extraemos los valores reales (el contenido redactado)
  const datosRaw = data?.datos
  const valoresActuales = isRecord(datosRaw)
    ? (datosRaw as Record<string, any>)
    : {}

  const criteriosEvaluacion: Array<CriterioEvaluacionRow> = useMemo(() => {
    const raw = (data as any)?.criterios_de_evaluacion

    if (!Array.isArray(raw)) return []

    const rows: Array<CriterioEvaluacionRow> = []
    for (const item of raw) {
      if (!isRecord(item)) continue
      const criterio = typeof item.criterio === 'string' ? item.criterio : ''
      const porcentajeNum =
        typeof item.porcentaje === 'number'
          ? item.porcentaje
          : typeof item.porcentaje === 'string'
            ? Number(item.porcentaje)
            : NaN

      if (!criterio.trim()) continue
      if (!Number.isFinite(porcentajeNum)) continue
      const porcentaje = Math.trunc(porcentajeNum)
      if (porcentaje < 1 || porcentaje > 100) continue

      rows.push({ criterio: criterio.trim(), porcentaje: porcentaje })
    }

    return rows
  }, [data])

  const numeroCicloActual =
    typeof data?.numero_ciclo === 'number' ? data.numero_ciclo : null

  // Scope para animar la entrada de la sección de datos generales.
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const cardCount = Object.keys(structureProps).length

  // Entrada del encabezado y aparición escalonada de las tarjetas (columna
  // principal + lateral) una vez que los datos de la asignatura están listos.
  useGSAP(
    () => {
      if (!getOrganicMotion() || isLoading) return

      const tl = gsap.timeline({
        defaults: { ease: organicEase, duration: organicDuration.base },
      })

      tl.fromTo(
        '[data-asig-header]',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0 },
      ).fromTo(
        sectionRef.current?.querySelectorAll('[data-slot="card"]') ?? [],
        { opacity: 0, y: 18, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.06,
          ease: 'back.out(1.2)',
          overwrite: 'auto',
        },
        '-=0.18',
      )
    },
    { scope: sectionRef, dependencies: [isLoading, cardCount] },
  )

  const persistCriteriosEvaluacion = async (
    rows: Array<CriterioEvaluacionRow>,
    adminOverrideReason?: string | null,
  ) => {
    await updateAsignatura.mutateAsync({
      asignaturaId: asignaturaId,
      patch: {
        criterios_de_evaluacion: rows,
      } as any,
      adminOverrideReason,
    })
  }
  if (isLoading) return <p>Cargando información...</p>

  return (
    <div ref={sectionRef} className="space-y-6 pb-8">
      {/* Encabezado de la Sección */}
      <div
        data-asig-header
        className="flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-center"
      >
        <div>
          <h2 className="text-foreground text-2xl font-bold tracking-tight">
            Datos Generales
          </h2>
          <p className="text-muted-foreground mt-1">
            Información oficial estructurada bajo los lineamientos de la SEP.
          </p>
        </div>
      </div>

      {/* Grid de Información */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Columna Principal (Más ancha) */}
        <div className="space-y-6 md:col-span-2">
          {Object.entries(structureProps).map(
            ([key, config]: [string, any]) => {
              const cardTitle = config.title || key
              const description = config.description || ''

              // Placeholder del arreglo 'examples' de la estructura
              const placeholder =
                config.examples && config.examples.length > 0
                  ? config.examples[0]
                  : ''

              const currentContent = valoresActuales[key] ?? ''
              const schemaEnum = Array.isArray(config.enum)
                ? (config.enum as Array<string>)
                : undefined
              const schemaType: string | undefined = config.type

              return (
                <InfoCard
                  asignaturaId={asignaturaId}
                  key={key}
                  clave={key}
                  title={cardTitle}
                  initialContent={currentContent}
                  placeholder={placeholder}
                  description={description}
                  schemaType={schemaType}
                  schemaEnum={schemaEnum}
                  schemaMin={
                    typeof config.minimum === 'number'
                      ? config.minimum
                      : undefined
                  }
                  schemaMax={
                    typeof config.maximum === 'number'
                      ? config.maximum
                      : undefined
                  }
                  onPersist={({ clave, value, adminOverrideReason }) =>
                    onPersistDato(
                      String(clave ?? key),
                      String(value ?? ''),
                      adminOverrideReason,
                    )
                  }
                  onClickEditButton={({ startEditing }) => startEditing()}
                />
              )
            },
          )}
        </div>

        {/* Columna Lateral (Información Secundaria) */}
        <div className="space-y-6">
          <div className="space-y-6">
            {/* Tarjeta de Requisitos */}
            <InfoCard
              asignaturaId={asignaturaId}
              title="Requisitos y Seriación"
              type="requirements"
              initialContent={pre}
              // Pasamos las materias del plan para el Select (excluyendo la actual)
              availableSubjects={
                availableSubjects?.filter(
                  (a: Asignatura) =>
                    a.id !== asignaturaId &&
                    typeof a.numero_ciclo === 'number' &&
                    numeroCicloActual !== null &&
                    a.numero_ciclo < numeroCicloActual,
                ) ?? []
              }
              onPersist={({ value, adminOverrideReason }) => {
                updateAsignatura.mutate({
                  asignaturaId,
                  patch: {
                    prerrequisito_asignatura_id: value, // value ya viene como ID o null desde handleSave
                  },
                  adminOverrideReason,
                })
              }}
            />

            {/* Tarjeta de Evaluación */}
            <InfoCard
              asignaturaId={asignaturaId}
              title="Sistema de Evaluación"
              type="evaluation"
              initialContent={criteriosEvaluacion}
              onPersist={({ value, adminOverrideReason }) =>
                persistCriteriosEvaluacion(value, adminOverrideReason)
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface InfoCardProps {
  asignaturaId?: string
  clave?: string
  title: string
  initialContent: any
  placeholder?: string
  description?: string
  required?: boolean // Nueva prop para el asterisco
  type?: 'text' | 'requirements' | 'evaluation'
  schemaType?: string
  schemaEnum?: Array<string>
  schemaMin?: number
  schemaMax?: number
  onEnhanceAI?: (content: any) => void
  onPersist?: (payload: {
    type: NonNullable<InfoCardProps['type']>
    clave?: string
    value: any
    adminOverrideReason?: string | null
  }) => void | Promise<void>
  onClickEditButton?: (helpers: { startEditing: () => void }) => void

  containerRef?: React.RefObject<HTMLDivElement | null>
  forceEditToken?: number
  highlightToken?: number
  availableSubjects?: Array<Asignatura>
}

function InfoCard({
  asignaturaId,
  clave,
  title,
  initialContent,
  placeholder,
  description,
  required,
  type = 'text',
  schemaType,
  schemaEnum,
  schemaMin,
  schemaMax,
  onPersist,
  onClickEditButton,
  containerRef,
  forceEditToken,
  highlightToken,
  availableSubjects,
}: InfoCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isHighlighted, setIsHighlighted] = useState(false)
  const [data, setData] = useState(initialContent)
  const [tempText, setTempText] = useState(initialContent)
  const [numError, setNumError] = useState<string | null>(null)

  const getNumError = (value: string): string | null => {
    if (schemaType !== 'integer' && schemaType !== 'number') return null
    if (value === '' || value === '-') return null
    const n = Number(value)
    if (!Number.isFinite(n)) return 'Ingresa un número válido'
    if (schemaMin !== undefined && n < schemaMin)
      return `El mínimo es ${schemaMin}`
    if (schemaMax !== undefined && n > schemaMax)
      return `El máximo es ${schemaMax}`
    return null
  }

  const [evalRows, setEvalRows] = useState<Array<CriterioEvaluacionRowDraft>>(
    [],
  )
  const navigate = useNavigate()
  const { planId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { data: plan } = usePlan(planId)
  const capabilities = usePlanCapabilities(plan)
  const canEdit = capabilities.canEditAsignaturas
  const canUseIA = capabilities.canUseIA

  useEffect(() => {
    setData(initialContent)
    setTempText(initialContent)

    if (type === 'evaluation') {
      const raw = Array.isArray(initialContent) ? initialContent : []
      const rows: Array<CriterioEvaluacionRowDraft> = raw
        .map((r: any): CriterioEvaluacionRowDraft | null => {
          const criterio = typeof r?.criterio === 'string' ? r.criterio : ''
          const porcentajeNum =
            typeof r?.porcentaje === 'number'
              ? r.porcentaje
              : typeof r?.porcentaje === 'string'
                ? Number(r.porcentaje)
                : NaN

          const porcentaje = Number.isFinite(porcentajeNum)
            ? String(Math.trunc(porcentajeNum))
            : ''

          return {
            id: crypto.randomUUID(),
            criterio,
            porcentaje,
          }
        })
        .filter(Boolean) as Array<CriterioEvaluacionRowDraft>

      setEvalRows(rows)
    }
  }, [initialContent, type])

  useEffect(() => {
    if (!forceEditToken) return
    setIsEditing(true)
  }, [forceEditToken])

  useEffect(() => {
    if (!highlightToken) return
    setIsHighlighted(true)
    const t = window.setTimeout(() => setIsHighlighted(false), 1500)
    return () => window.clearTimeout(t)
  }, [highlightToken])

  const handleSave = async () => {
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'editar una asignatura fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    if (type === 'evaluation') {
      const cleaned: Array<CriterioEvaluacionRow> = []
      for (const r of evalRows) {
        const criterio = String(r.criterio).trim()
        const porcentajeStr = String(r.porcentaje).trim()
        if (!criterio) continue
        if (!porcentajeStr) continue

        const n = Number(porcentajeStr)
        if (!Number.isFinite(n)) continue
        const porcentaje = Math.trunc(n)
        if (porcentaje < 1 || porcentaje > 100) continue

        cleaned.push({ criterio, porcentaje })
      }

      setData(cleaned)
      setEvalRows(
        cleaned.map((x) => ({
          id: crypto.randomUUID(),
          criterio: x.criterio,
          porcentaje: String(x.porcentaje),
        })),
      )
      setIsEditing(false)

      void onPersist?.({ type, clave, value: cleaned, adminOverrideReason })
      return
    }
    if (type === 'requirements') {
      // Si tempText es un array y tiene elementos, tomamos el ID del primero
      // Si es "none" o está vacío, mandamos null (para limpiar la seriación)
      const prerequisiteId =
        Array.isArray(tempText) && tempText.length > 0 ? tempText[0].id : null

      setData(tempText) // Actualiza la vista local
      setIsEditing(false)

      // Mandamos el ID específico a la base de datos
      void onPersist?.({
        type,
        clave: 'prerrequisito_asignatura_id', // Forzamos la columna correcta
        value: prerequisiteId,
        adminOverrideReason,
      })
      return
    }

    const err = getNumError(String(tempText ?? ''))
    if (err) {
      setNumError(err)
      return
    }

    setData(tempText)
    setIsEditing(false)
    setNumError(null)

    void onPersist?.({
      type,
      clave,
      value: String(tempText ?? ''),
      adminOverrideReason,
    })
  }

  const handleIARequest = (campoClave?: string) => {
    if (!canUseIA) return
    let targetClave = campoClave
    if (type === 'evaluation' && !targetClave) {
      targetClave = 'criterios_de_evaluacion'
    }

    if (targetClave === 'contenido') {
      targetClave = 'contenido_tematico'
    }

    navigate({
      to: '/planes/$planId/asignaturas/$asignaturaId/iaasignatura',
      params: { planId, asignaturaId: asignaturaId! },
      state: {
        activeTab: 'ia',
        prefillCampo: targetClave,
        prefillContenido: data,
        _ts: Date.now(),
      } as any,
    })
  }

  const evaluationTotal = useMemo(() => {
    if (type !== 'evaluation') return 0
    return evalRows.reduce((acc, r) => {
      const v = String(r.porcentaje).trim()
      if (!v) return acc
      const n = Number(v)
      if (!Number.isFinite(n)) return acc
      const porcentaje = Math.trunc(n)
      if (porcentaje < 1 || porcentaje > 100) return acc
      return acc + porcentaje
    }, 0)
  }, [type, evalRows])

  return (
    <div ref={containerRef}>
      <Card
        className={
          'hover:border-border overflow-hidden pt-0 transition-all ' +
          (isHighlighted ? 'ring-primary/40 ring-2' : '')
        }
      >
        <TooltipProvider>
          <CardHeader className="bg-muted/50 border-b px-5 pt-5 [.border-b]:pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-foreground cursor-help text-sm font-bold">
                      {title}
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {description || 'Información del campo'}
                  </TooltipContent>
                </Tooltip>

                {required && (
                  <span
                    className="text-destructive text-sm font-bold"
                    title="Requerido"
                  >
                    *
                  </span>
                )}
              </div>

              {!isEditing && (canEdit || canUseIA) && (
                <div className="flex gap-1">
                  {canUseIA && type !== 'requirements' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-primary hover:bg-primary/10 h-8 w-8"
                          onClick={() => handleIARequest(clave)}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Mejorar con IA</TooltipContent>
                    </Tooltip>
                  )}

                  {canEdit && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground h-8 w-8"
                          onClick={() => {
                            const startEditing = () => setIsEditing(true)

                            if (onClickEditButton) {
                              onClickEditButton({ startEditing })
                              return
                            }

                            startEditing()
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Editar campo</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
        </TooltipProvider>

        <CardContent className="pt-4">
          {isEditing ? (
            <div className="space-y-3">
              {/* Condicionales de edición según el tipo */}
              {type === 'requirements' ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-xs font-medium">
                    Materia de Seriación
                  </p>
                  <Select
                    value={
                      Array.isArray(tempText) && tempText.length > 0
                        ? tempText[0].id
                        : 'none'
                    }
                    onValueChange={(val) => {
                      const selected = availableSubjects?.find(
                        (s: Asignatura) => s.id === val,
                      )
                      if (val === 'none' || !selected) {
                        setTempText([])
                      } else {
                        setTempText([
                          {
                            id: selected.id,
                            type: 'Pre-requisito',
                            code: selected.codigo,
                            name: selected.nombre,
                          },
                        ])
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <div className="flex-1 truncate text-left">
                        <SelectValue placeholder="Selecciona una materia">
                          {Array.isArray(tempText) && tempText.length > 0
                            ? `${tempText[0].code} - ${tempText[0].name}`
                            : undefined}
                        </SelectValue>
                      </div>
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="none">
                        Ninguna (Sin seriación)
                      </SelectItem>

                      {availableSubjects?.map((asig: Asignatura) => (
                        <SelectItem
                          key={asig.id}
                          value={asig.id}
                          className="w-full max-w-75 sm:max-w-125"
                        >
                          <span className="text-primary font-bold">
                            [{nombreTipoCiclo(plan?.tipo_ciclo).charAt(0)}
                            {asig.numero_ciclo}]
                          </span>{' '}
                          <span className="inline-block truncate">
                            {asig.codigo} - {asig.nombre}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : type === 'evaluation' ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {evalRows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[2fr_1fr_1ch_32px] items-center gap-2"
                      >
                        <Input
                          value={row.criterio}
                          placeholder="Criterio"
                          onChange={(e) => {
                            const nextCriterio = e.target.value
                            setEvalRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? { ...r, criterio: nextCriterio }
                                  : r,
                              ),
                            )
                          }}
                        />
                        <Input
                          value={row.porcentaje}
                          placeholder="%"
                          type="number"
                          onChange={(e) => {
                            const raw = e.target.value
                            if (raw !== '' && !/^\d+$/.test(raw)) return

                            setEvalRows((prev) => {
                              const next = prev.map((r) =>
                                r.id === row.id ? { ...r, porcentaje: raw } : r,
                              )
                              const total = next.reduce(
                                (acc, r) => acc + (Number(r.porcentaje) || 0),
                                0,
                              )
                              return total > 100 ? prev : next
                            })
                          }}
                        />
                        <div className="text-muted-foreground text-sm">%</div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 h-8 w-8"
                          onClick={() =>
                            setEvalRows((prev) =>
                              prev.filter((r) => r.id !== row.id),
                            )
                          }
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm ${evaluationTotal === 100 ? 'text-muted-foreground' : 'text-destructive font-semibold'}`}
                    >
                      Total: {evaluationTotal}/100
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:bg-primary/10"
                      onClick={() =>
                        setEvalRows((prev) => [
                          ...prev,
                          {
                            id: crypto.randomUUID(),
                            criterio: '',
                            porcentaje: '',
                          },
                        ])
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" /> Agregar renglón
                    </Button>
                  </div>
                </div>
              ) : schemaEnum && schemaEnum.length > 0 ? (
                <Select
                  value={tempText || undefined}
                  onValueChange={setTempText}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una opción" />
                  </SelectTrigger>
                  <SelectContent>
                    {schemaEnum.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : schemaType === 'integer' || schemaType === 'number' ? (
                <div className="space-y-1">
                  <Input
                    type="number"
                    value={tempText}
                    onChange={(e) => {
                      setTempText(e.target.value)
                      setNumError(getNumError(e.target.value))
                    }}
                    min={schemaMin}
                    max={schemaMax}
                    placeholder={
                      schemaMin !== undefined && schemaMax !== undefined
                        ? `Entre ${schemaMin} y ${schemaMax}`
                        : schemaMin !== undefined
                          ? `Mínimo ${schemaMin}`
                          : schemaMax !== undefined
                            ? `Máximo ${schemaMax}`
                            : 'Valor numérico'
                    }
                    className={`text-sm ${numError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  />
                  {numError && (
                    <p className="text-destructive text-xs">{numError}</p>
                  )}
                </div>
              ) : (
                <Textarea
                  value={tempText}
                  placeholder={placeholder}
                  onChange={(e) => setTempText(e.target.value)}
                  className="min-h-30 text-sm leading-relaxed"
                />
              )}

              {/* Botones de acción comunes */}
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false)
                    // Lógica de reset si es necesario...
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onClick={handleSave}
                  disabled={
                    (type === 'evaluation' && evaluationTotal > 100) ||
                    !!numError
                  }
                >
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            /* Modo Visualización */
            <div className="text-muted-foreground text-sm leading-relaxed">
              {type === 'text' &&
                (data ? (
                  schemaEnum && schemaEnum.length > 0 ? (
                    <Badge variant="secondary" className="text-sm font-medium">
                      {data}
                    </Badge>
                  ) : schemaType === 'integer' || schemaType === 'number' ? (
                    <p className="text-foreground font-medium tabular-nums">
                      {data}
                    </p>
                  ) : (
                    <p className="whitespace-pre-wrap">{data}</p>
                  )
                ) : (
                  <p className="text-muted-foreground/70 italic">
                    Sin información.
                  </p>
                ))}
              {type === 'requirements' && <RequirementsView items={data} />}
              {type === 'evaluation' && <EvaluationView items={data} />}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Vista de Requisitos
function RequirementsView({ items }: { items: Array<any> }) {
  return (
    <div className="space-y-3">
      {items.map((req, i) => (
        <div
          key={i}
          className="border-border bg-muted/50 rounded-lg border p-3"
        >
          <p className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
            {req.type}
          </p>
          <p className="text-foreground text-sm font-medium">
            {req.code} {req.name}
          </p>
        </div>
      ))}
    </div>
  )
}

// Vista de Evaluación
function EvaluationView({ items }: { items: Array<CriterioEvaluacionRow> }) {
  const porcentajeTotal = items.reduce(
    (total, item) => total + Number(item.porcentaje),
    0,
  )
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="border-border/30 flex justify-between border-b pb-1.5 text-sm italic"
        >
          <span className="text-muted-foreground">{item.criterio}</span>
          <span className="text-primary font-bold">{item.porcentaje}%</span>
        </div>
      ))}
      {porcentajeTotal < 100 && (
        <p className="text-destructive text-sm font-medium">
          El porcentaje total es menor a 100%.
        </p>
      )}
    </div>
  )
}
