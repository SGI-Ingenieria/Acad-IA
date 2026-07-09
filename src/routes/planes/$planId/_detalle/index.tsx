import {
  createFileRoute,
  useNavigate,
  useLocation,
} from '@tanstack/react-router'
import { Pencil, X, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'

import type { DatosGeneralesField } from '@/types/plan'

import { EditorCampoModal } from '@/components/editor/EditorCampoModal'
import { RichTextContent } from '@/components/editor/RichTextContent'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EditableNumber } from '@/components/ui/editable-number'
import { EditableText } from '@/components/ui/editable-text'
import { lateralConfetti } from '@/components/ui/lateral-confetti'
import { TabPanelSkeleton } from '@/components/ui/route-pending-skeleton'
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
import { useFieldDrafts, usePlan, useUpdatePlanFields } from '@/data'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import {
  coerceValueForSchema,
  resolveFieldAccess,
} from '@/lib/field-restrictions'

export const Route = createFileRoute('/planes/$planId/_detalle/')({
  component: DatosGeneralesPage,
})

const formatLabel = (key: string) => {
  const result = key.replace(/_/g, ' ')
  return result.charAt(0).toUpperCase() + result.slice(1)
}

function looksLikeHtml(value: string) {
  return /<[^>]+>/.test(value)
}

function DatosGeneralesPage() {
  const { planId } = Route.useParams()
  const { data, isLoading } = usePlan(planId)
  const { data: draftsMap } = useFieldDrafts('plan', planId)
  const navigate = useNavigate()
  const capabilities = usePlanCapabilities(data)
  const canEditPlan = capabilities.canEditPlan
  const canUseIA = capabilities.canUseIA

  const [campos, setCampos] = useState<Array<DatosGeneralesField>>([])
  const [editingSelectId, setEditingSelectId] = useState<string | null>(null)
  const [richModalCampo, setRichModalCampo] =
    useState<DatosGeneralesField | null>(null)
  const [richModalInitialTab, setRichModalInitialTab] = useState<
    'editor' | 'stats' | 'ia'
  >('editor')
  const location = useLocation()
  const updatePlan = useUpdatePlanFields()

  useEffect(() => {
    if (location.state.showConfetti) {
      lateralConfetti()
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  useEffect(() => {
    const definicion = data?.estructuras_plan?.definicion as any
    const properties = definicion?.properties
    const requiredOrder = definicion?.required as Array<string> | undefined

    const valores = (data?.datos as Record<string, unknown> | undefined) ?? {}

    if (properties && typeof properties === 'object') {
      let keys = Object.keys(properties)

      if (Array.isArray(requiredOrder)) {
        keys = keys.sort((a, b) => {
          const indexA = requiredOrder.indexOf(a)
          const indexB = requiredOrder.indexOf(b)
          if (indexA !== -1 && indexB === -1) return -1
          if (indexA === -1 && indexB !== -1) return 1
          if (indexA !== -1 && indexB !== -1) return indexA - indexB
          return 0
        })
      }

      const datosTransformados: Array<DatosGeneralesField> = keys
        .map((key, index) => {
          const schema = properties[key]
          const rawValue = valores[key]
          const access = resolveFieldAccess({
            schema,
            value: rawValue,
            estadoClave: capabilities.estadoClave,
            canEditBase: canEditPlan,
          })

          if (!access.visible) return null

          const valueForDisplay =
            rawValue &&
            typeof rawValue === 'object' &&
            !Array.isArray(rawValue) &&
            'description' in rawValue
              ? (rawValue as any).description
              : rawValue

          return {
            clave: key,
            id: (index + 1).toString(),
            label: schema?.title || formatLabel(key),
            helperText: schema?.description || '',
            holder: schema?.examples || '',
            value:
              valueForDisplay !== undefined && valueForDisplay !== null
                ? String(valueForDisplay)
                : '',

            requerido: true,

            tipo: Array.isArray(schema?.enum)
              ? 'select'
              : schema?.type === 'integer' || schema?.type === 'number'
                ? 'number'
                : 'richtext', // todo texto (string) es rich text

            opciones: schema?.enum || [],
            minimum: schema?.minimum,
            maximum: schema?.maximum,
            schema,
            canEdit: access.canEdit,
            canUseIA: canUseIA && access.canEdit,
            requiresAdminOverride:
              capabilities.requiresAdminOverrideForEdit && !access.restricted,
            restricted: access.restricted,
          }
        })
        .filter(Boolean) as Array<DatosGeneralesField>

      setCampos(datosTransformados)
    }
  }, [canEditPlan, canUseIA, capabilities, data])

  const prepararDatosActualizados = (
    planData: any,
    campo: DatosGeneralesField,
    valor: string,
  ) => {
    const currentValue = planData.datos[campo.clave]
    let newValue: any

    if (
      typeof currentValue === 'object' &&
      currentValue !== null &&
      'description' in currentValue
    ) {
      newValue = {
        ...currentValue,
        description: String(coerceValueForSchema(valor, campo.schema) ?? ''),
      }
    } else {
      newValue = coerceValueForSchema(valor, campo.schema)
    }

    return {
      ...planData.datos,
      [campo.clave]: newValue,
    }
  }

  const ejecutarGuardadoSilencioso = async (
    campo: DatosGeneralesField,
    valor: string,
  ) => {
    if (!data?.datos) return
    const adminOverrideReason = campo.requiresAdminOverride
      ? await requestAdminOverrideReason(
          'editar un campo del plan fuera de su etapa normal',
        )
      : null
    if (campo.requiresAdminOverride && !adminOverrideReason) return

    const datosActualizados = prepararDatosActualizados(data, campo, valor)

    updatePlan.mutate({
      planId,
      patch: { datos: datosActualizados },
      adminOverrideReason,
    })

    setCampos((prev) =>
      prev.map((c) => (c.id === campo.id ? { ...c, value: valor } : c)),
    )
  }

  const handleTextSave = (campo: DatosGeneralesField, value: string) => {
    const trimmed = value.trim()
    if (trimmed === campo.value) return
    void ejecutarGuardadoSilencioso(campo, trimmed)
  }

  const handleNumberSave = (
    campo: DatosGeneralesField,
    value: number | null,
  ) => {
    const nextValue = value === null ? '' : String(value)
    if (nextValue === campo.value) return
    void ejecutarGuardadoSilencioso(campo, nextValue)
  }

  const handleSelectSave = async (
    campo: DatosGeneralesField,
    valor: string,
  ) => {
    if (!data?.datos) return
    const adminOverrideReason = campo.requiresAdminOverride
      ? await requestAdminOverrideReason(
          'editar un campo del plan fuera de su etapa normal',
        )
      : null
    if (campo.requiresAdminOverride && !adminOverrideReason) return

    const datosActualizados = {
      ...(data.datos as Record<string, unknown>),
      [campo.clave]: valor,
    }

    updatePlan.mutate({
      planId,
      patch: { datos: datosActualizados },
      adminOverrideReason,
    })

    setCampos((prev) =>
      prev.map((c) => (c.id === campo.id ? { ...c, value: valor } : c)),
    )
    setEditingSelectId(null)
  }

  const handleIARequest = (campo: DatosGeneralesField) => {
    if (!campo.canUseIA) return
    if (campo.tipo === 'richtext') {
      setRichModalInitialTab('ia')
      setRichModalCampo(campo)
      return
    }

    navigate({
      to: '/planes/$planId/iaplan',
      params: {
        planId: planId,
      },
      state: {
        campo_edit: campo.clave,
      } as any,
    })
  }

  const handleRichApply = async (campo: DatosGeneralesField, html: string) => {
    if (!data?.datos) return false

    const adminOverrideReason = campo.requiresAdminOverride
      ? await requestAdminOverrideReason(
          'editar un campo del plan fuera de su etapa normal',
        )
      : null
    if (campo.requiresAdminOverride && !adminOverrideReason) return false

    const datosActualizados = prepararDatosActualizados(data, campo, html)
    await updatePlan.mutateAsync({
      planId,
      patch: { datos: datosActualizados },
      adminOverrideReason,
    })

    setCampos((prev) =>
      prev.map((c) => (c.id === campo.id ? { ...c, value: html } : c)),
    )
    return true
  }

  if (isLoading) return <TabPanelSkeleton />

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6">
        <h2 className="text-foreground text-lg font-semibold">
          Datos Generales del Plan
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Información estructural y descriptiva del plan de estudios
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {campos.map((campo) => {
          const isEditingSelect = editingSelectId === campo.id
          const isRichtext = campo.tipo === 'richtext'
          const borrador = draftsMap?.get(campo.clave) ?? null
          const isHtml = isRichtext && looksLikeHtml(campo.value)
          const canEditInline = campo.canEdit && !isHtml

          return (
            <div
              key={campo.id}
              className={`bg-card rounded-2xl border transition-all ${
                isEditingSelect
                  ? 'border-primary/50 ring-primary/20 shadow-lg ring-2'
                  : 'border-border/70 hover:border-border hover:shadow-md'
              }`}
            >
              {/* Header de la Card */}
              <TooltipProvider>
                <div className="bg-muted/30 flex items-center justify-between gap-4 border-b px-6 py-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <h3 className="text-foreground cursor-help text-base font-semibold tracking-tight">
                          {campo.label}
                        </h3>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs leading-relaxed">
                        {campo.helperText || 'Información del campo'}
                      </TooltipContent>
                    </Tooltip>

                    {campo.requerido && (
                      <span className="text-destructive text-xs leading-none font-semibold">
                        *
                      </span>
                    )}
                    {isRichtext && borrador && (
                      <Badge className="bg-amber-100 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        Edición pendiente
                      </Badge>
                    )}
                  </div>

                  {!isEditingSelect && (campo.canEdit || campo.canUseIA) && (
                    <div className="flex shrink-0 items-center gap-1">
                      {campo.canUseIA && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-primary hover:text-primary/90 h-8 w-8 rounded-full"
                              onClick={() => handleIARequest(campo)}
                            >
                              <Sparkles size={14} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Generar con IA</TooltipContent>
                        </Tooltip>
                      )}

                      {campo.canEdit && (isHtml || campo.tipo === 'select') && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-full"
                              onClick={() => {
                                if (isHtml) {
                                  setRichModalInitialTab('editor')
                                  setRichModalCampo(campo)
                                  return
                                }
                                setEditingSelectId(campo.id)
                              }}
                            >
                              <Pencil size={14} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar campo</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </div>
              </TooltipProvider>

              {/* Contenido de la Card */}
              <div className="px-6 py-5">
                {isEditingSelect ? (
                  <div className="space-y-3">
                    <Select
                      value={campo.value || undefined}
                      onValueChange={(val) => handleSelectSave(campo, val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona una opción" />
                      </SelectTrigger>
                      <SelectContent>
                        {(campo.opciones ?? []).map((op) => (
                          <SelectItem key={op} value={op}>
                            {op}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingSelectId(null)}
                      >
                        <X size={14} className="mr-1" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-25 pt-0.5">
                    {campo.value || campo.value === '0' ? (
                      <div className="text-muted-foreground text-sm leading-6">
                        {campo.tipo === 'select' ? (
                          <Badge
                            variant="secondary"
                            className="text-sm font-medium"
                          >
                            {campo.value}
                          </Badge>
                        ) : campo.tipo === 'number' ? (
                          <EditableNumber
                            value={Number(campo.value)}
                            min={campo.minimum}
                            max={campo.maximum}
                            editable={canEditInline}
                            onSave={(n) => handleNumberSave(campo, n)}
                            ariaLabel={campo.label}
                            className="text-foreground font-medium"
                          />
                        ) : isHtml ? (
                          <RichTextContent html={campo.value} />
                        ) : (
                          <EditableText
                            value={campo.value}
                            onSave={(value) => handleTextSave(campo, value)}
                            editable={canEditInline}
                            placeholder="Sin contenido."
                            ariaLabel={campo.label}
                            className="whitespace-pre-wrap"
                          />
                        )}
                      </div>
                    ) : (
                      <EditableText
                        value=""
                        onSave={(value) => handleTextSave(campo, value)}
                        editable={canEditInline}
                        placeholder={
                          campo.tipo === 'number'
                            ? 'Sin valor.'
                            : 'Sin contenido.'
                        }
                        ariaLabel={campo.label}
                        className="text-muted-foreground/70 italic"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {richModalCampo && (
        <EditorCampoModal
          open={Boolean(richModalCampo)}
          onOpenChange={(open) => {
            if (!open) setRichModalCampo(null)
          }}
          entidad="plan"
          entidadId={planId}
          clave={richModalCampo.clave}
          title={richModalCampo.label}
          description={richModalCampo.helperText}
          valorActual={richModalCampo.value}
          borrador={draftsMap?.get(richModalCampo.clave) ?? null}
          campoSchema={richModalCampo.schema}
          canUseIA={richModalCampo.canUseIA ?? false}
          initialTab={richModalInitialTab}
          onAplicar={async (html) => {
            const applied = await handleRichApply(richModalCampo, html)
            if (!applied) throw new Error('Aplicación cancelada.')
          }}
        />
      )}
    </div>
  )
}
