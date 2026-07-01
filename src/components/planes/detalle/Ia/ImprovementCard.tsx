import { Check, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useUpdatePlanFields, useUpdateRecommendationApplied } from '@/data'
import {
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
  useGSAP,
} from '@/lib/animations'

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
  const listRef = useRef<HTMLDivElement>(null)

  // Entrada escalonada de las tarjetas (§7.3): aparecen con ritmo, no de golpe.
  useGSAP(
    () => {
      if (!getOrganicMotion()) return

      const cards = listRef.current?.querySelectorAll('.improvement-card')
      if (!cards || cards.length === 0) return

      gsap.fromTo(
        cards,
        { y: 10, opacity: 0, filter: 'blur(6px)' },
        {
          y: 0,
          opacity: 1,
          filter: 'blur(0px)',
          duration: organicDuration.slow,
          ease: organicEase,
          stagger: 0.06,
          overwrite: 'auto',
        },
      )
    },
    { scope: listRef, dependencies: [suggestions.length] },
  )

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
        planId: planId,
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
    <div ref={listRef} className="mt-2 flex w-full flex-col gap-4">
      {suggestions.map((sug) => {
        const isApplied = sug.applied === true || localApplied.includes(sug.key)
        const isUpdating =
          updatePlan.isPending &&
          updatePlan.variables.patch.datos?.[sug.key] !== undefined

        return (
          <div
            key={sug.key}
            role="group"
            aria-label={`Sugerencia ${sug.label}`}
            aria-busy={!!isUpdating}
            className={`improvement-card relative transform-gpu rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 ${
              isApplied
                ? 'border-primary/30 bg-primary/5 ring-primary/20 border-l-2 pl-5 opacity-80 ring-1'
                : isUpdating
                  ? 'pointer-events-none bg-transparent opacity-70'
                  : 'bg-transparent'
            }`}
          >
            {/* left accent when applied */}

            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-foreground text-sm leading-snug font-semibold">
                  {sug.label}
                </h3>
                {sug.hint ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {sug.hint}
                  </p>
                ) : null}
              </div>

              <div className="shrink-0">
                <Button
                  size="sm"
                  onClick={() => handleApply(sug.key, sug.newValue)}
                  disabled={isApplied || !!isUpdating}
                  variant={isApplied ? 'secondary' : 'default'}
                  aria-busy={isUpdating}
                  className="focus-visible:ring-primary/40 h-8 transform-gpu rounded-full px-4 text-xs transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {isUpdating ? (
                    <span className="inline-flex items-center gap-2 text-xs font-semibold">
                      <Loader2 size={14} className="animate-spin" /> Aplicando…
                    </span>
                  ) : isApplied ? (
                    <span className="text-primary inline-flex items-center gap-2 text-xs font-semibold">
                      <Check size={14} /> Aplicado
                    </span>
                  ) : (
                    'Aplicar mejora'
                  )}
                </Button>
                <span className="sr-only" aria-live="polite">
                  {isApplied ? 'Sugerencia aplicada' : 'Sugerencia sin aplicar'}
                </span>
              </div>
            </div>

            <div
              className={`rounded-md p-3 text-sm transition-colors duration-300 ${
                isApplied
                  ? 'bg-primary/10 text-foreground'
                  : 'bg-muted/20 text-muted-foreground'
              }`}
            >
              <div className="leading-relaxed wrap-break-word whitespace-pre-wrap">
                {sug.newValue}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
