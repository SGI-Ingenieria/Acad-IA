import { Check, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useUpdatePlanFields, useUpdateRecommendationApplied } from '@/data'

export const ImprovementCard = ({
  suggestions,
  onApply,
  planId,
  dbMessageId,
  currentDatos,
  activeChatId,
  onApplySuccess,
}: {
  suggestions: Array<any>
  onApply?: (key: string, value: string) => void
  planId: string
  currentDatos: any
  dbMessageId: string
  activeChatId: any
  onApplySuccess?: (key: string) => void
}) => {
  const [localApplied, setLocalApplied] = useState<Array<string>>([])
  const updatePlan = useUpdatePlanFields()
  const updateAppliedStatus = useUpdateRecommendationApplied()

  const handleApply = (key: string, newValue: string) => {
    if (!currentDatos) return
    const currentValue = currentDatos[key]
    let finalValue: any

    if (
      typeof currentValue === 'object' &&
      currentValue !== null &&
      'description' in currentValue
    ) {
      finalValue = { ...currentValue, description: newValue }
    } else {
      finalValue = newValue
    }

    const datosActualizados = {
      ...currentDatos,
      [key]: finalValue,
    }

    updatePlan.mutate(
      {
        planId: planId as any,
        patch: { datos: datosActualizados },
      },
      {
        onSuccess: () => {
          setLocalApplied((prev) => [...prev, key])

          if (onApplySuccess) onApplySuccess(key)

          if (dbMessageId) {
            updateAppliedStatus.mutate({
              mensajeId: dbMessageId,
              campoAfectado: key,
              conversationId: activeChatId ?? undefined,
            })
          }

          if (onApply) onApply(key, newValue)
        },
      },
    )
  }

  return (
    <div className="mt-2 flex w-full flex-col gap-4">
      {suggestions.map((sug) => {
        const isApplied = sug.applied === true || localApplied.includes(sug.key)
        const isUpdating =
          updatePlan.isPending &&
          updatePlan.variables.patch.datos?.[sug.key] !== undefined

        return (
          <div
            key={sug.key}
            className={`bg-card rounded-2xl border p-5 shadow-sm transition-all ${
              isApplied ? 'border-primary/30 bg-primary/5' : 'border-border'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-foreground text-sm font-bold">{sug.label}</h3>
              <Button
                size="sm"
                onClick={() => handleApply(sug.key, sug.newValue)}
                disabled={isApplied || !!isUpdating}
                variant={isApplied ? 'secondary' : 'default'}
                className="h-8 rounded-full px-4 text-xs transition-all"
              >
                {isUpdating ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isApplied ? (
                  <span className="flex items-center gap-1">
                    <Check size={12} /> Aplicado
                  </span>
                ) : (
                  'Aplicar mejora'
                )}
              </Button>
            </div>

            <div
              className={`rounded-xl border p-3 text-sm transition-colors duration-300 ${
                isApplied
                  ? 'border-primary/20 bg-primary/10 text-foreground'
                  : 'border-border bg-muted/50 text-muted-foreground'
              }`}
            >
              {sug.newValue}
            </div>
          </div>
        )
      })}
    </div>
  )
}
