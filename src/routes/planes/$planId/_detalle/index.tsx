import { createFileRoute, useLocation } from '@tanstack/react-router'
import { ChevronDown, ScanEye } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'

import type { CommentHighlight } from '@/components/editor/comment-highlights'
import type { ComentarioReferencia } from '@/data/types/domain'
import type { FundamentoPlan } from '@/lib/plan-fundamentos'
import type { DatosGeneralesField } from '@/types/plan'

import { CampoCanvasCard } from '@/components/editor/CampoCanvasCard'
import { CampoValorCard } from '@/components/editor/CampoValorCard'
import { Button } from '@/components/ui/button'
import { lateralConfetti } from '@/components/ui/lateral-confetti'
import { TabPanelSkeleton } from '@/components/ui/route-pending-skeleton'
import { useFieldDrafts, usePlan, useUpdatePlanFields } from '@/data'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import { useComentariosPlan } from '@/data/hooks/useWorkflow'
import { ejemploDeEsquema } from '@/lib/campo-ejemplos'
import {
  coerceValueForSchema,
  resolveFieldAccess,
} from '@/lib/field-restrictions'
import { mapearFundamentos, ordenFundamento } from '@/lib/plan-fundamentos'

/**
 * Datos Generales es la ruta índice del plan, no una subruta.
 *
 * Abrir un plan es abrir su identidad —de qué carrera es, qué perfiles declara,
 * qué versión normativa aplica—, así que `/planes/<id>` la sirve directamente:
 * el mapa, la tabla y el documento son vistas derivadas y ésas sí llevan
 * segmento propio. Antes este índice era un redirector que mandaba al mapa
 * según la fase de diseño; eso rompía la expectativa de volver siempre al mismo
 * sitio y dejaba una URL intermedia en el historial.
 */
export const Route = createFileRoute('/planes/$planId/_detalle/')({
  component: DatosGeneralesPage,
})

const formatLabel = (key: string) => {
  const result = key.replace(/_/g, ' ')
  return result.charAt(0).toUpperCase() + result.slice(1)
}

type CampoDelPlan = DatosGeneralesField & { fundamento?: FundamentoPlan }

function DatosGeneralesPage() {
  const { planId } = Route.useParams()
  const { data, isLoading } = usePlan(planId)
  const { data: draftsMap } = useFieldDrafts('plan', planId)
  const capabilities = usePlanCapabilities(data)
  const canEditPlan = capabilities.canEditPlan
  const canUseIA = capabilities.canUseIA

  const location = useLocation()
  const updatePlan = useUpdatePlanFields()
  const { data: comentarios } = useComentariosPlan(planId)

  // Decide únicamente dónde se leen los fundamentos: dentro del flujo normal
  // de tarjetas o juntos, como una comparación. No modifica datos ni URL.
  const [fundamentosEnfocados, setFundamentosEnfocados] = useState(false)

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

  /**
   * Campos de la estructura, derivados de la query (no copiados a estado
   * local: `useUpdatePlanFields` es optimista y escribe en `qk.plan`, así que
   * el valor guardado vuelve por aquí sin una segunda fuente de verdad).
   *
   * Conservamos el orden íntegro de la estructura para el estado habitual de
   * la pantalla. Los fundamentos se separan además para poder enfocarlos como
   * una comparación temporal, sin dejar de pertenecer a la misma rejilla.
   */
  const { todos, fundamentos, resto } = useMemo(() => {
    const definicion = data?.estructuras_plan?.definicion as any
    const properties = definicion?.properties
    const requiredOrder = definicion?.required as Array<string> | undefined

    const valores = (data?.datos as Record<string, unknown> | undefined) ?? {}

    if (!properties || typeof properties !== 'object') {
      return {
        todos: [] as Array<CampoDelPlan>,
        fundamentos: [] as Array<CampoDelPlan>,
        resto: [] as Array<CampoDelPlan>,
      }
    }

    const porClave = mapearFundamentos(properties)

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

    const camposVisibles: Array<CampoDelPlan> = keys
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
          holder: ejemploDeEsquema(schema),
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
          fundamento: porClave.get(key),
        }
      })
      .filter(Boolean) as Array<CampoDelPlan>

    return {
      todos: camposVisibles,
      fundamentos: camposVisibles
        .filter((campo) => campo.fundamento)
        .sort(
          (a, b) =>
            ordenFundamento(a.fundamento!) - ordenFundamento(b.fundamento!),
        ),
      resto: camposVisibles.filter((campo) => !campo.fundamento),
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

    return true
  }

  const renderCampo = (campo: CampoDelPlan, destacado = false) => {
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
          destacado={destacado}
          placeholder={campo.fundamento?.placeholder}
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
  }

  if (isLoading) return <TabPanelSkeleton />

  return (
    <div className="animate-in fade-in space-y-10 duration-500">
      {fundamentos.length > 0 && (
        <section
          aria-labelledby="titulo-fundamentos"
          data-guia="fundamentos"
          className="space-y-4"
        >
          <div className="flex items-center justify-between gap-4">
            <h2
              id="titulo-fundamentos"
              className="text-muted-foreground text-sm font-semibold"
            >
              Fundamentos del plan
            </h2>
            <Button
              variant="ghost"
              size="sm"
              data-guia="enfocar-fundamentos"
              aria-expanded={fundamentosEnfocados}
              aria-controls="fundamentos-enfocados"
              onClick={() => setFundamentosEnfocados((actual) => !actual)}
            >
              <ScanEye />
              {fundamentosEnfocados
                ? 'Desenfocar los tres'
                : 'Enfocar los tres'}
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${
                  fundamentosEnfocados ? 'rotate-180' : ''
                }`}
              />
            </Button>
          </div>

          {fundamentosEnfocados ? (
            <div
              id="fundamentos-enfocados"
              className="animate-in fade-in slide-in-from-top-2 grid items-stretch gap-6 duration-200 md:grid-cols-2 xl:grid-cols-3"
            >
              {fundamentos.map((campo) => renderCampo(campo, true))}
            </div>
          ) : null}
      </section>
      )}

      <div className="masonry-grid" data-guia="campos-plan">
        {(fundamentosEnfocados ? resto : todos).map((campo) =>
          renderCampo(campo),
        )}
      </div>
    </div>
  )
}
