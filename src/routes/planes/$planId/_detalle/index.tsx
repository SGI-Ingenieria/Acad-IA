import { createFileRoute, useLocation } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'

import type { CommentHighlight } from '@/components/editor/comment-highlights'
import type { ComentarioReferencia } from '@/data/types/domain'
import type { DatosGeneralesField } from '@/types/plan'

import { CampoCanvasCard } from '@/components/editor/CampoCanvasCard'
import { CampoValorCard } from '@/components/editor/CampoValorCard'
import { lateralConfetti } from '@/components/ui/lateral-confetti'
import { TabPanelSkeleton } from '@/components/ui/route-pending-skeleton'
import { useFieldDrafts, usePlan, useUpdatePlanFields } from '@/data'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import { useComentariosPlan } from '@/data/hooks/useWorkflow'
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

function DatosGeneralesPage() {
  const { planId } = Route.useParams()
  const { data, isLoading } = usePlan(planId)
  const { data: draftsMap } = useFieldDrafts('plan', planId)
  const capabilities = usePlanCapabilities(data)
  const canEditPlan = capabilities.canEditPlan
  const canUseIA = capabilities.canUseIA

  const [campos, setCampos] = useState<Array<DatosGeneralesField>>([])
  const location = useLocation()
  const updatePlan = useUpdatePlanFields()
  const { data: comentarios } = useComentariosPlan(planId)

  // Comentarios anclados a un campo (referencia con offsets) → marcatextos.
  const highlightsByClave = useMemo(() => {
    const map = new Map<string, Array<CommentHighlight>>()
    for (const comentario of comentarios ?? []) {
      if (comentario.resuelto) continue
      const referencia = comentario.referencia as ComentarioReferencia | null
      if (
        !referencia?.contenedor?.includes('data-comment-scope="plan-field"') ||
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

  /**
   * Única vía de escritura de un campo, la use el usuario a mano o el agente de
   * IA: ambos necesitan el mismo override de administrador, la misma
   * conservación de la forma `{ description }` del valor y la misma promesa
   * resuelta para poder encadenar (aplicar / deshacer).
   *
   * Devuelve `false` cuando el usuario cancela el motivo del override; lanza si
   * la escritura falla, para que quien la disparó pueda reaccionar.
   */
  const guardarCampo = async (campo: DatosGeneralesField, valor: string) => {
    if (!data?.datos) return false
    if (valor === campo.value) return true

    const adminOverrideReason = campo.requiresAdminOverride
      ? await requestAdminOverrideReason(
          'editar un campo del plan fuera de su etapa normal',
        )
      : null
    if (campo.requiresAdminOverride && !adminOverrideReason) return false

    const datosActualizados = prepararDatosActualizados(data, campo, valor)
    await updatePlan.mutateAsync({
      planId,
      patch: { datos: datosActualizados },
      adminOverrideReason,
    })

    setCampos((prev) =>
      prev.map((c) => (c.id === campo.id ? { ...c, value: valor } : c)),
    )
    return true
  }

  if (isLoading) return <TabPanelSkeleton />

  return (
    <div className="animate-in fade-in duration-500">
      <div className="masonry-grid">
        {campos.map((campo) => {
          const borrador = draftsMap?.get(campo.clave) ?? null

          // Todo campo de texto usa la tarjeta-canvas (edición + IA integradas),
          // tenga o no HTML guardado.
          if (campo.tipo === 'richtext') {
            return (
              <CampoCanvasCard
                key={campo.id}
                campo={campo}
                entidad="plan"
                entidadId={planId}
                borrador={borrador}
                highlights={highlightsByClave.get(campo.clave) ?? []}
                onAplicar={(html) => guardarCampo(campo, html)}
              />
            )
          }

          return (
            <CampoValorCard
              key={campo.id}
              campo={campo}
              entidad="plan"
              entidadId={planId}
              onGuardar={(valor) => guardarCampo(campo, valor)}
            />
          )
        })}
      </div>
    </div>
  )
}
