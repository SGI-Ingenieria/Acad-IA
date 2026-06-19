import {
  createFileRoute,
  useNavigate,
  useLocation,
} from '@tanstack/react-router'
import { Pencil, Check, X, Sparkles, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

import type { DatosGeneralesField } from '@/types/plan'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { lateralConfetti } from '@/components/ui/lateral-confetti'
import { TabPanelSkeleton } from '@/components/ui/route-pending-skeleton'
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
import { usePlan, useUpdatePlanFields } from '@/data'
import { usePermissions } from '@/data/hooks/usePermissions'

export const Route = createFileRoute('/planes/$planId/_detalle/')({
  component: DatosGeneralesPage,
})

const formatLabel = (key: string) => {
  const result = key.replace(/_/g, ' ')
  return result.charAt(0).toUpperCase() + result.slice(1)
}

function DatosGeneralesPage() {
  const { planId } = Route.useParams()
  const { data, isLoading } = usePlan(planId)
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canEditPlan = has('planes.editar')
  const canUseIA = has('ia.usar')

  const [campos, setCampos] = useState<Array<DatosGeneralesField>>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
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

      const datosTransformados: Array<DatosGeneralesField> = keys.map(
        (key, index) => {
          const schema = properties[key]
          const rawValue = valores[key]

          return {
            clave: key,
            id: (index + 1).toString(),
            label: schema?.title || formatLabel(key),
            helperText: schema?.description || '',
            holder: schema?.examples || '',
            value:
              rawValue !== undefined && rawValue !== null
                ? String(rawValue)
                : '',

            requerido: true,

            tipo: Array.isArray(schema?.enum)
              ? 'select'
              : schema?.type === 'integer' || schema?.type === 'number'
                ? 'number'
                : 'texto',

            opciones: schema?.enum || [],
            minimum: schema?.minimum,
            maximum: schema?.maximum,
          }
        },
      )

      setCampos(datosTransformados)
    }
  }, [data])

  const getNumError = (value: string, campo: DatosGeneralesField): string | null => {
    if (campo.tipo !== 'number') return null
    if (value === '' || value === '-') return null
    const n = Number(value)
    if (!Number.isFinite(n)) return 'Ingresa un número válido'
    if (campo.minimum !== undefined && n < campo.minimum)
      return `El mínimo es ${campo.minimum}`
    if (campo.maximum !== undefined && n > campo.maximum)
      return `El máximo es ${campo.maximum}`
    return null
  }

  const handleEdit = (nuevoCampo: DatosGeneralesField) => {
    if (editingId && editingId !== nuevoCampo.id) {
      const campoAnterior = campos.find((c) => c.id === editingId)
      if (campoAnterior && editValue !== campoAnterior.value && !validationError) {
        ejecutarGuardadoSilencioso(campoAnterior, editValue)
      }
    }

    setEditingId(nuevoCampo.id)
    setEditValue(nuevoCampo.value)
    setValidationError(null)
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditValue('')
    setValidationError(null)
  }

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
      newValue = { ...currentValue, description: valor }
    } else {
      newValue = valor
    }

    return {
      ...planData.datos,
      [campo.clave]: newValue,
    }
  }

  const ejecutarGuardadoSilencioso = (
    campo: DatosGeneralesField,
    valor: string,
  ) => {
    if (!data?.datos) return

    const datosActualizados = prepararDatosActualizados(data, campo, valor)
    console.log(datosActualizados)

    updatePlan.mutate({
      planId,
      patch: { datos: datosActualizados },
    })

    setCampos((prev) =>
      prev.map((c) => (c.id === campo.id ? { ...c, value: valor } : c)),
    )
  }

  const handleSave = (campo: DatosGeneralesField) => {
    if (!data?.datos) return
    const err = getNumError(editValue, campo)
    if (err) { setValidationError(err); return }

    const currentValue = (data.datos as any)[campo.clave]

    let newValue: any

    if (
      typeof currentValue === 'object' &&
      currentValue !== null &&
      'description' in currentValue
    ) {
      newValue = {
        ...currentValue,
        description: editValue,
      }
    } else {
      newValue = editValue
    }

    const datosActualizados = {
      ...(data.datos as Record<string, unknown>),
      [campo.clave]: newValue,
    }

    updatePlan.mutate({
      planId,
      patch: {
        datos: datosActualizados,
      },
    })

    setCampos((prev) =>
      prev.map((c) => (c.id === campo.id ? { ...c, value: editValue } : c)),
    )

    ejecutarGuardadoSilencioso(campo, editValue)
    setEditingId(null)
    setEditValue('')
  }

  const handleIARequest = (campo: DatosGeneralesField) => {
    console.log(campo)

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

  if (isLoading && !data) return <TabPanelSkeleton />

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
          const isEditing = editingId === campo.id

          return (
            <div
              key={campo.id}
              className={`bg-card rounded-2xl border transition-all ${
                isEditing
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
                  </div>

                  {!isEditing && (canEditPlan || canUseIA) && (
                    <div className="flex shrink-0 items-center gap-1">
                      {canUseIA && (
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

                      {canEditPlan && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-full"
                              onClick={() => handleEdit(campo)}
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
                {isEditing ? (
                  <div className="space-y-3">
                    {campo.tipo === 'select' ? (
                      <Select
                        value={editValue || undefined}
                        onValueChange={setEditValue}
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
                    ) : campo.tipo === 'number' ? (
                      <div className="space-y-1">
                        <Input
                          type="number"
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value)
                            setValidationError(getNumError(e.target.value, campo))
                          }}
                          min={campo.minimum}
                          max={campo.maximum}
                          placeholder={
                            campo.minimum !== undefined && campo.maximum !== undefined
                              ? `Entre ${campo.minimum} y ${campo.maximum}`
                              : campo.minimum !== undefined
                                ? `Mínimo ${campo.minimum}`
                                : campo.maximum !== undefined
                                  ? `Máximo ${campo.maximum}`
                                  : 'Valor numérico'
                          }
                          className={`text-sm ${validationError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        />
                        {validationError && (
                          <p className="text-destructive text-xs">{validationError}</p>
                        )}
                      </div>
                    ) : (
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="placeholder:text-muted-foreground/70 min-h-30 text-sm not-italic placeholder:italic"
                        placeholder={`Ej. ${campo.holder?.[0] ?? ''}`}
                      />
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                      >
                        <X size={14} className="mr-1" /> Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(campo)}
                        disabled={!!validationError}
                      >
                        <Check size={14} className="mr-1" /> Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-25 pt-0.5">
                    {campo.value ? (
                      <div className="text-muted-foreground text-sm leading-6">
                        {campo.tipo === 'lista' ? (
                          <ul className="space-y-1">
                            {campo.value.split('\n').map((item, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        ) : campo.tipo === 'select' ? (
                          <Badge variant="secondary" className="text-sm font-medium">
                            {campo.value}
                          </Badge>
                        ) : campo.tipo === 'number' ? (
                          <p className="text-foreground font-medium tabular-nums">
                            {campo.value}
                          </p>
                        ) : (
                          <p className="whitespace-pre-wrap">{campo.value}</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-muted-foreground/70 flex items-center gap-2 text-sm">
                        <AlertCircle size={14} />
                        <span>Sin contenido.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
