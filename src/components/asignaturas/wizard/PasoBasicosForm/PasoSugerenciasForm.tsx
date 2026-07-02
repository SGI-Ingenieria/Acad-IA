import { RefreshCw, Sparkles, X } from 'lucide-react'
import { useState } from 'react'

import type { NewSubjectWizardState } from '@/features/asignaturas/nueva/types'
import type { Dispatch, SetStateAction } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { generate_subject_suggestions, usePlan } from '@/data'
import { AIProgressLoader } from '@/features/asignaturas/nueva/AIProgressLoader'
import { getPlanDisplayName } from '@/lib/plan-display'
import { cn } from '@/lib/utils'

export default function PasoSugerenciasForm({
  wizard,
  onChange,
}: {
  wizard: NewSubjectWizardState
  onChange: Dispatch<SetStateAction<NewSubjectWizardState>>
}) {
  const enfoque = wizard.iaMultiple?.enfoque ?? ''
  const cantidadDeSugerencias = wizard.iaMultiple?.cantidadDeSugerencias ?? 5
  const isLoading = wizard.iaMultiple?.isLoading ?? false

  const [showConservacionTooltip, setShowConservacionTooltip] = useState(false)

  const setIaMultiple = (
    patch: Partial<NonNullable<NewSubjectWizardState['iaMultiple']>>,
  ) =>
    onChange(
      (w): NewSubjectWizardState => ({
        ...w,
        iaMultiple: {
          enfoque: w.iaMultiple?.enfoque ?? '',
          cantidadDeSugerencias: w.iaMultiple?.cantidadDeSugerencias ?? 10,
          isLoading: w.iaMultiple?.isLoading ?? false,
          ...patch,
        },
      }),
    )

  const { data: plan } = usePlan(wizard.plan_estudio_id)

  const toggleAsignatura = (id: string, checked: boolean) => {
    onChange((w) => ({
      ...w,
      sugerencias: w.sugerencias.map((s) =>
        s.id === id ? { ...s, selected: checked } : s,
      ),
    }))
  }

  const onGenerarSugerencias = async () => {
    const hadNoSugerenciasBefore = wizard.sugerencias.length === 0
    const sugerenciasConservadas = wizard.sugerencias.filter((s) => s.selected)

    onChange((w) => ({
      ...w,
      errorMessage: null,
      sugerencias: sugerenciasConservadas,
      iaMultiple: {
        enfoque: w.iaMultiple?.enfoque ?? '',
        cantidadDeSugerencias: w.iaMultiple?.cantidadDeSugerencias ?? 10,
        isLoading: true,
      },
    }))

    try {
      const cantidad = wizard.iaMultiple?.cantidadDeSugerencias ?? 10
      if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 15) {
        onChange((w) => ({
          ...w,
          errorMessage: 'La cantidad de sugerencias debe ser entre 1 y 15.',
          iaMultiple: {
            enfoque: w.iaMultiple?.enfoque ?? '',
            cantidadDeSugerencias: w.iaMultiple?.cantidadDeSugerencias ?? 10,
            isLoading: false,
          },
        }))
        return
      }

      const enfoqueTrim = wizard.iaMultiple?.enfoque.trim() ?? ''

      const nuevasSugerencias = await generate_subject_suggestions({
        plan_estudio_id: wizard.plan_estudio_id,
        enfoque: enfoqueTrim ? enfoqueTrim : undefined,
        cantidad_de_sugerencias: cantidad,
        sugerencias_conservadas: sugerenciasConservadas.map((s) => ({
          nombre: s.nombre,
          descripcion: s.descripcion,
        })),
      })

      if (hadNoSugerenciasBefore && nuevasSugerencias.length > 0) {
        setShowConservacionTooltip(true)
      }

      onChange(
        (w): NewSubjectWizardState => ({
          ...w,
          sugerencias: [...nuevasSugerencias, ...sugerenciasConservadas],
          iaMultiple: {
            enfoque: w.iaMultiple?.enfoque ?? '',
            cantidadDeSugerencias: w.iaMultiple?.cantidadDeSugerencias ?? 10,
            isLoading: false,
          },
        }),
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error generando sugerencias.'
      onChange(
        (w): NewSubjectWizardState => ({
          ...w,
          errorMessage: message,
          iaMultiple: {
            enfoque: w.iaMultiple?.enfoque ?? '',
            cantidadDeSugerencias: w.iaMultiple?.cantidadDeSugerencias ?? 10,
            isLoading: false,
          },
        }),
      )
    }
  }

  return (
    <>
      {/* --- BLOQUE SUPERIOR: PARÁMETROS --- */}
      <div className="border-border/60 bg-muted/30 mb-4 rounded-xl border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="text-primary h-4 w-4" />
          <span className="text-sm font-semibold">
            Parámetros de sugerencia
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="w-full">
            <Label className="text-muted-foreground mb-1 block text-xs">
              Enfoque (opcional)
            </Label>
            <Textarea
              placeholder="Ej. Enfocado en normativa mexicana y tecnología"
              value={enfoque}
              maxLength={7000}
              rows={4}
              onChange={(e) => setIaMultiple({ enfoque: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-3 flex w-full flex-col items-end justify-between gap-3 sm:flex-row">
          <div className="w-full sm:w-44">
            <Label className="text-muted-foreground mb-1 block text-xs">
              Cantidad de sugerencias
            </Label>
            <Input
              placeholder="Ej. 5"
              value={cantidadDeSugerencias}
              type="number"
              min={1}
              max={15}
              step={1}
              inputMode="numeric"
              onKeyDown={(e) => {
                if (['.', ',', '-', 'e', 'E', '+'].includes(e.key)) {
                  e.preventDefault()
                }
              }}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') return
                const asNumber = Number(raw)
                if (!Number.isFinite(asNumber)) return
                const n = Math.floor(Math.abs(asNumber))
                const capped = Math.min(n >= 1 ? n : 1, 15)
                setIaMultiple({ cantidadDeSugerencias: capped })
              }}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-9 gap-1.5"
            onClick={onGenerarSugerencias}
            disabled={isLoading}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {wizard.sugerencias.length > 0
              ? 'Generar más sugerencias'
              : 'Generar sugerencias'}
          </Button>
        </div>
      </div>

      <AIProgressLoader
        isLoading={isLoading}
        cantidadDeSugerencias={cantidadDeSugerencias}
      />

      {/* --- HEADER LISTA --- */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-base font-semibold">
            Asignaturas sugeridas
          </h3>
          <p className="text-muted-foreground text-xs">
            Basadas en el plan{' '}
            {plan ? getPlanDisplayName(plan) : '...'}
          </p>
        </div>
        <Tooltip open={showConservacionTooltip}>
          <TooltipTrigger asChild>
            <div className="bg-muted text-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold">
              <span aria-hidden>📌</span>
              {wizard.sugerencias.filter((s) => s.selected).length}{' '}
              seleccionadas
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8} className="max-w-xs">
            <div className="flex items-start gap-2">
              <span className="flex-1 text-sm">
                Al generar más sugerencias, se conservarán las asignaturas
                seleccionadas.
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => setShowConservacionTooltip(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* --- LISTA DE ASIGNATURAS --- */}
      <div className="max-h-100 space-y-1 overflow-y-auto pr-1">
        {wizard.sugerencias.map((asignatura) => {
          const isSelected = asignatura.selected

          return (
            <Label
              key={asignatura.id}
              aria-checked={isSelected}
              className={cn(
                'border-border hover:border-primary/30 hover:bg-accent/50 m-0.5 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-aria-checked:border-blue-600 has-aria-checked:bg-blue-50 dark:has-aria-checked:border-blue-900 dark:has-aria-checked:bg-blue-950',
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) =>
                  toggleAsignatura(asignatura.id, !!checked)
                }
                className={cn(
                  'peer border-primary ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:ring-ring mt-0.5 h-5 w-5 shrink-0 border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  // isSelected ? '' : 'invisible',
                )}
              />

              {/* Contenido de la tarjeta */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground text-sm font-medium">
                    {asignatura.nombre}
                  </span>

                  {/* Badges de Tipo */}
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
                      asignatura.tipo === 'OBLIGATORIA'
                        ? 'border-blue-200 bg-transparent text-blue-700 dark:border-blue-800 dark:text-blue-300'
                        : 'border-yellow-200 bg-transparent text-yellow-700 dark:border-yellow-800 dark:text-yellow-300',
                    )}
                  >
                    {asignatura.tipo}
                  </span>

                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {asignatura.creditos} cred. · {asignatura.horasAcademicas}h
                    acad. · {asignatura.horasIndependientes}h indep.
                  </span>
                </div>

                <p className="text-muted-foreground mt-1 text-sm">
                  {asignatura.descripcion}
                </p>
              </div>
            </Label>
          )
        })}
      </div>
    </>
  )
}
