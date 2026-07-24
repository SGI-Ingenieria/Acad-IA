import { createFileRoute, useParams } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { CommentHighlight } from '@/components/editor/comment-highlights'
import type { BorradorCampo } from '@/data'
import type { Asignatura, ComentarioReferencia } from '@/data/types/domain'

import { CampoCanvasCard } from '@/components/editor/CampoCanvasCard'
import { EditorCampoModal } from '@/components/editor/EditorCampoModal'
import { RichTextContent } from '@/components/editor/RichTextContent'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EditableNumber } from '@/components/ui/editable-number'
import { EditableText } from '@/components/ui/editable-text'
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
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useFieldDrafts, usePlan } from '@/data'
import {
  requestAdminOverrideReason,
  useAsignaturaCapabilities,
} from '@/data/auth/planCapabilities'
import { useSubject, useUpdateAsignatura } from '@/data/hooks/useSubjects'
import { useComentariosPlan } from '@/data/hooks/useWorkflow'
import {
  getOrganicMotion,
  gsap,
  organicEase,
  organicDuration,
  useGSAP,
} from '@/lib/animations'
import { nombreTipoCiclo } from '@/lib/ciclo-utils'
import {
  coerceValueForSchema,
  resolveFieldAccess,
} from '@/lib/field-restrictions'

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

function looksLikeHtml(value: string) {
  return /<[^>]+>/.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  const { data: asignaturaApi, refetch: refetchAsignatura } =
    useSubject(asignaturaId)
  const updateAsignatura = useUpdateAsignatura()

  // La caché de `qk.asignatura` es la única fuente de verdad: la mutación
  // optimista la escribe al instante (con rollback), así que basta fusionar
  // el dato editado sobre los `datos` que reporta la query.
  const handlePersistDatoGeneral = async (
    clave: string,
    value: any,
    adminOverrideReason?: string | null,
  ) => {
    const datosActuales = (asignaturaApi as any)?.datos
    const baseDatos = isRecord(datosActuales) ? datosActuales : {}

    await updateAsignatura.mutateAsync({
      asignaturaId,
      patch: {
        datos: { ...baseDatos, [clave]: value },
      },
      adminOverrideReason,
    })
  }

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

  return <DatosGenerales onPersistDato={handlePersistDatoGeneral} />
}

function DatosGenerales({
  onPersistDato,
}: {
  onPersistDato: (
    clave: string,
    value: any,
    adminOverrideReason?: string | null,
  ) => void | Promise<void>
}) {
  const { asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { data: data, isLoading: isLoading } = useSubject(asignaturaId)
  const { data: draftsMap } = useFieldDrafts('asignatura', asignaturaId)
  const { planId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { data: plan } = usePlan(planId)
  const capabilities = useAsignaturaCapabilities(plan, asignaturaId)
  const { data: comentarios } = useComentariosPlan(planId, asignaturaId)

  // Comentarios anclados a un campo (offsets) → marcatextos en la tarjeta.
  const highlightsByClave = useMemo(() => {
    const map = new Map<string, Array<CommentHighlight>>()
    for (const comentario of comentarios ?? []) {
      if (comentario.resuelto) continue
      const referencia = comentario.referencia as ComentarioReferencia | null
      if (
        !referencia?.contenedor?.includes(
          'data-comment-scope="subject-field"',
        ) ||
        typeof referencia.from !== 'number' ||
        typeof referencia.until !== 'number'
      ) {
        continue
      }
      const match = referencia.contenedor.match(/data-comment-key="([^"]+)"/)
      if (!match) continue
      map.set(match[1], [
        ...(map.get(match[1]) ?? []),
        { id: comentario.id, from: referencia.from, until: referencia.until },
      ])
    }
    return map
  }, [comentarios])

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

  if (isLoading) return <p>Cargando información...</p>

  return (
    <div ref={sectionRef} className="space-y-6 pb-8">
      {/* Tarjetas de la estructura a todo el ancho; la evaluación vive en su
          propia pestaña (`evaluacion`). */}
      <div className="space-y-6">
        {Object.entries(structureProps).map(([key, config]: [string, any]) => {
          const cardTitle = config.title || key
          const description = config.description || ''

          // Placeholder del arreglo 'examples' de la estructura
          const placeholder =
            config.examples && config.examples.length > 0
              ? config.examples[0]
              : ''

          const currentContent = valoresActuales[key] ?? ''
          const access = resolveFieldAccess({
            schema: config,
            value: currentContent,
            estadoClave: capabilities.estadoClave,
            canEditBase: capabilities.canEditAsignaturas,
            canEditRestricted: capabilities.canEditRestrictedFields,
          })
          if (!access.visible) return null

          const schemaEnum = Array.isArray(config.enum)
            ? (config.enum as Array<string>)
            : undefined
          const schemaType: string | undefined = config.type
          // Todo campo de texto (string sin enum) es rich text.
          const isRichtext = schemaType === 'string' && !schemaEnum

          // Campos de texto: tarjeta-canvas con edición e IA integradas.
          if (isRichtext) {
            const needsOverride =
              capabilities.requiresAdminOverrideForEdit && !access.restricted
            return (
              <CampoCanvasCard
                key={key}
                campo={{
                  id: key,
                  clave: key,
                  label: cardTitle,
                  helperText: description,
                  value: String(currentContent ?? ''),
                  requerido: true,
                  tipo: 'richtext',
                  schema: config,
                  canEdit: access.canEdit,
                  canUseIA: capabilities.canUseIA && access.canEdit,
                  requiresAdminOverride: needsOverride,
                  restricted: access.restricted,
                }}
                entidad="asignatura"
                entidadId={asignaturaId}
                borrador={draftsMap?.get(key) ?? null}
                highlights={highlightsByClave.get(key) ?? []}
                onAplicar={async (html) => {
                  const reason = needsOverride
                    ? await requestAdminOverrideReason(
                        'editar una asignatura fuera de la etapa normal del plan',
                      )
                    : null
                  if (needsOverride && !reason) return false
                  try {
                    await onPersistDato(key, html, reason)
                    return true
                  } catch {
                    return false
                  }
                }}
              />
            )
          }

          return (
            <InfoCard
              asignaturaId={asignaturaId}
              key={key}
              clave={key}
              title={cardTitle}
              content={currentContent}
              placeholder={placeholder}
              description={description}
              schemaType={schemaType}
              isRichtext={isRichtext}
              campoSchema={config}
              borrador={draftsMap?.get(key) ?? null}
              schemaEnum={schemaEnum}
              schemaMin={
                typeof config.minimum === 'number' ? config.minimum : undefined
              }
              schemaMax={
                typeof config.maximum === 'number' ? config.maximum : undefined
              }
              fieldCanEdit={access.canEdit}
              fieldCanUseIA={capabilities.canUseIA && access.canEdit}
              requiresAdminOverride={
                capabilities.requiresAdminOverrideForEdit && !access.restricted
              }
              onPersist={({ clave, value, adminOverrideReason }) =>
                onPersistDato(String(clave ?? key), value, adminOverrideReason)
              }
              onClickEditButton={({ startEditing }) => startEditing()}
            />
          )
        })}
      </div>
    </div>
  )
}

interface InfoCardProps {
  asignaturaId?: string
  clave?: string
  title: string
  /** Contenido vigente leído de la query; las mutaciones optimistas lo refrescan. */
  content: any
  placeholder?: string
  description?: string
  required?: boolean // Nueva prop para el asterisco
  type?: 'text' | 'requirements'
  schemaType?: string
  schemaEnum?: Array<string>
  schemaMin?: number
  schemaMax?: number
  isRichtext?: boolean
  campoSchema?: Record<string, unknown>
  borrador?: BorradorCampo | null
  fieldCanEdit?: boolean
  fieldCanUseIA?: boolean
  requiresAdminOverride?: boolean
  onPersist?: (payload: {
    type: NonNullable<InfoCardProps['type']>
    clave?: string
    value: any
    adminOverrideReason?: string | null
  }) => void | Promise<void>
  onClickEditButton?: (helpers: { startEditing: () => void }) => void

  availableSubjects?: Array<Asignatura>
}

function InfoCard({
  asignaturaId,
  clave,
  title,
  content,
  placeholder,
  description,
  required,
  type = 'text',
  schemaType,
  schemaEnum,
  schemaMin,
  schemaMax,
  isRichtext = false,
  campoSchema,
  borrador,
  fieldCanEdit,
  fieldCanUseIA,
  requiresAdminOverride,
  onPersist,
  onClickEditButton,
  availableSubjects,
}: InfoCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  // Borradores de edición en curso: se siembran al entrar en modo edición y
  // se descartan al guardar/cancelar. La vista siempre lee `content` (query).
  const [tempText, setTempText] = useState<any>(null)
  const [richModalOpen, setRichModalOpen] = useState(false)
  const [richModalInitialTab, setRichModalInitialTab] = useState<
    'editor' | 'stats' | 'ia'
  >('editor')

  const { planId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { data: plan } = usePlan(planId)
  const capabilities = useAsignaturaCapabilities(plan, asignaturaId)
  const canEdit = fieldCanEdit ?? capabilities.canEditAsignaturas
  const canUseIA = fieldCanUseIA ?? capabilities.canUseIA
  const needsAdminOverride =
    requiresAdminOverride ?? capabilities.requiresAdminOverrideForEdit

  const startEditing = () => {
    setTempText(content)
    setIsEditing(true)
  }

  const handleSave = async () => {
    const adminOverrideReason = needsAdminOverride
      ? await requestAdminOverrideReason(
          'editar una asignatura fuera de la etapa normal del plan',
        )
      : null
    if (needsAdminOverride && !adminOverrideReason) return

    // La escritura optimista de la mutación refresca `content` al instante y
    // hace rollback si el servidor rechaza; el toast global avisa del fallo.
    const persist = (payload: { clave?: string; value: any }) => {
      void Promise.resolve(
        onPersist?.({ type, adminOverrideReason, ...payload }),
      ).catch(() => {
        // Fallo ya gestionado: rollback optimista + toast global en español.
      })
    }

    if (type === 'requirements') {
      // Si tempText es un array y tiene elementos, tomamos el ID del primero
      // Si es "none" o está vacío, mandamos null (para limpiar la seriación)
      const prerequisiteId =
        Array.isArray(tempText) && tempText.length > 0 ? tempText[0].id : null

      setIsEditing(false)

      // Mandamos el ID específico a la base de datos
      persist({
        clave: 'prerrequisito_asignatura_id', // Forzamos la columna correcta
        value: prerequisiteId,
      })
      return
    }

    const valueForPersist =
      schemaType === 'integer' || schemaType === 'number'
        ? coerceValueForSchema(tempText, campoSchema)
        : String(tempText ?? '')

    setIsEditing(false)
    persist({ clave, value: valueForPersist })
  }

  const persistFieldValue = async (value: string | number) => {
    const adminOverrideReason = needsAdminOverride
      ? await requestAdminOverrideReason(
          'editar una asignatura fuera de la etapa normal del plan',
        )
      : null
    if (needsAdminOverride && !adminOverrideReason) return false

    const valueForPersist =
      schemaType === 'integer' || schemaType === 'number'
        ? coerceValueForSchema(String(value), campoSchema)
        : String(value)

    try {
      await onPersist?.({
        type,
        clave,
        value: valueForPersist,
        adminOverrideReason,
      })
      return true
    } catch {
      // Rollback optimista + toast global ya notificaron; la vista vuelve a
      // leer el valor vigente de la query.
      return false
    }
  }

  return (
    <div>
      {isRichtext && clave && (
        <EditorCampoModal
          open={richModalOpen}
          onOpenChange={setRichModalOpen}
          entidad="asignatura"
          entidadId={asignaturaId!}
          clave={clave}
          title={title}
          description={description}
          valorActual={content}
          borrador={borrador}
          campoSchema={campoSchema}
          canUseIA={canUseIA}
          initialTab={richModalInitialTab}
          onAplicar={async (html) => {
            const applied = await persistFieldValue(html)
            if (!applied) throw new Error('Aplicación cancelada.')
          }}
        />
      )}
      <Card className="hover:border-border overflow-hidden pt-0 transition-all">
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-destructive text-sm font-bold">
                        *
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Requerido</TooltipContent>
                  </Tooltip>
                )}
                {isRichtext && borrador && (
                  <Badge className="bg-amber-100 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    Edición pendiente
                  </Badge>
                )}
              </div>

              {!isEditing && canEdit && (
                <div className="flex gap-1">
                  {((isRichtext && looksLikeHtml(String(content))) ||
                    (schemaEnum && schemaEnum.length > 0) ||
                    type === 'requirements') && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground h-8 w-8"
                          onClick={() => {
                            if (isRichtext && type === 'text') {
                              setRichModalInitialTab('editor')
                              setRichModalOpen(true)
                              return
                            }

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

        <CardContent
          className="pt-4"
          data-comment-scope="subject-field"
          data-comment-key={clave ?? type}
        >
          {isEditing ? (
            <div className="space-y-3">
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
              ) : null}

              {(type === 'requirements' ||
                (schemaEnum && schemaEnum.length > 0)) && (
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false)
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90"
                    onClick={handleSave}
                  >
                    Guardar
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Modo Visualización */
            <div className="text-muted-foreground text-sm leading-relaxed">
              {type === 'text' &&
                (content || content === 0 ? (
                  schemaEnum && schemaEnum.length > 0 ? (
                    <Badge variant="secondary" className="text-sm font-medium">
                      {content}
                    </Badge>
                  ) : schemaType === 'integer' || schemaType === 'number' ? (
                    <EditableNumber
                      value={
                        typeof content === 'number'
                          ? content
                          : typeof content === 'string' && content.trim() !== ''
                            ? Number(content)
                            : null
                      }
                      min={schemaMin}
                      max={schemaMax}
                      editable={canEdit}
                      onSave={(n) => void persistFieldValue(n ?? '')}
                      ariaLabel={title}
                      className="text-foreground font-medium"
                    />
                  ) : isRichtext && looksLikeHtml(String(content)) ? (
                    <RichTextContent html={String(content)} />
                  ) : (
                    <EditableText
                      value={String(content ?? '')}
                      onSave={(value) => void persistFieldValue(value)}
                      editable={canEdit}
                      placeholder="Sin información."
                      ariaLabel={title}
                      className="whitespace-pre-wrap"
                    />
                  )
                ) : (
                  <EditableText
                    value=""
                    onSave={(value) => void persistFieldValue(value)}
                    editable={canEdit}
                    placeholder={placeholder}
                    ariaLabel={title}
                    className="whitespace-pre-wrap"
                  />
                ))}
              {type === 'requirements' && <RequirementsView items={content} />}
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
