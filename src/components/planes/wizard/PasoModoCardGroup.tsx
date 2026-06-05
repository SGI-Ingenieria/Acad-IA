import { Copy, Database, Pencil, Sparkles, Upload } from 'lucide-react'

import type { TipoOrigen } from '@/data/types/domain'
import type { NewPlanWizardState } from '@/features/planes/nuevo/types'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function PasoModoCardGroup({
  wizard,
  onChange,
}: {
  wizard: NewPlanWizardState
  onChange: React.Dispatch<React.SetStateAction<NewPlanWizardState>>
}) {
  const isSelected = (m: TipoOrigen) => wizard.tipoOrigen === m
  const handleKeyActivate = (e: React.KeyboardEvent, cb: () => void) => {
    const key = e.key
    if (
      key === 'Enter' ||
      key === ' ' ||
      key === 'Spacebar' ||
      key === 'Space'
    ) {
      e.preventDefault()
      e.stopPropagation()
      cb()
    }
  }
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card
        className={isSelected('MANUAL') ? 'ring-ring ring-2' : ''}
        onClick={() =>
          onChange(
            (w): NewPlanWizardState => ({
              ...w,
              tipoOrigen: 'MANUAL',
            }),
          )
        }
        onKeyDown={(e: React.KeyboardEvent) =>
          handleKeyActivate(e, () =>
            onChange(
              (w): NewPlanWizardState => ({
                ...w,
                tipoOrigen: 'MANUAL',
              }),
            ),
          )
        }
        role="button"
        tabIndex={0}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pencil className="text-primary h-5 w-5" /> Manual
          </CardTitle>
          <CardDescription>Plan vacío con estructura mínima.</CardDescription>
        </CardHeader>
      </Card>

      <Card
        className={isSelected('IA') ? 'ring-ring ring-2' : ''}
        onClick={() =>
          onChange(
            (w): NewPlanWizardState => ({
              ...w,
              tipoOrigen: 'IA',
            }),
          )
        }
        onKeyDown={(e: React.KeyboardEvent) =>
          handleKeyActivate(e, () =>
            onChange(
              (w): NewPlanWizardState => ({
                ...w,
                tipoOrigen: 'IA',
              }),
            ),
          )
        }
        role="button"
        tabIndex={0}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-primary h-5 w-5" /> Con IA
          </CardTitle>
          <CardDescription>
            Borrador completo a partir de datos base.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card
        className={isSelected('OTRO') ? 'ring-ring ring-2' : ''}
        onClick={() =>
          onChange((w): NewPlanWizardState => ({ ...w, tipoOrigen: 'OTRO' }))
        }
        onKeyDown={(e: React.KeyboardEvent) =>
          handleKeyActivate(e, () =>
            onChange((w): NewPlanWizardState => ({ ...w, tipoOrigen: 'OTRO' })),
          )
        }
        role="button"
        tabIndex={0}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="text-primary h-5 w-5" /> Clonado
          </CardTitle>
          <CardDescription>Desde un plan existente o archivos.</CardDescription>
        </CardHeader>
        {(wizard.tipoOrigen === 'OTRO' ||
          wizard.tipoOrigen === 'CLONADO_INTERNO' ||
          wizard.tipoOrigen === 'CLONADO_TRADICIONAL') && (
          <CardContent className="flex flex-col gap-3">
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onChange(
                  (w): NewPlanWizardState => ({
                    ...w,
                    tipoOrigen: 'CLONADO_INTERNO',
                  }),
                )
              }}
              onKeyDown={(e: React.KeyboardEvent) =>
                handleKeyActivate(e, () =>
                  onChange(
                    (w): NewPlanWizardState => ({
                      ...w,
                      tipoOrigen: 'CLONADO_INTERNO',
                    }),
                  ),
                )
              }
              className={`hover:border-primary/50 hover:bg-accent flex cursor-pointer flex-row items-center justify-center gap-2 rounded-lg border p-4 text-center transition-all sm:flex-col ${
                isSelected('CLONADO_INTERNO')
                  ? 'border-primary bg-primary/5 ring-primary text-primary ring-1'
                  : 'border-border text-muted-foreground'
              } `}
            >
              <Database className="mb-1 h-6 w-6" />
              <span className="text-sm font-medium">Del sistema</span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onChange(
                  (w): NewPlanWizardState => ({
                    ...w,
                    tipoOrigen: 'CLONADO_TRADICIONAL',
                  }),
                )
              }}
              onKeyDown={(e: React.KeyboardEvent) =>
                handleKeyActivate(e, () =>
                  onChange(
                    (w): NewPlanWizardState => ({
                      ...w,
                      tipoOrigen: 'CLONADO_TRADICIONAL',
                    }),
                  ),
                )
              }
              className={`hover:border-primary/50 hover:bg-accent flex cursor-pointer flex-row items-center justify-center gap-2 rounded-lg border p-4 text-center transition-all sm:flex-col ${
                isSelected('CLONADO_TRADICIONAL')
                  ? 'border-primary bg-primary/5 ring-primary text-primary ring-1'
                  : 'border-border text-muted-foreground'
              } `}
            >
              <Upload className="mb-1 h-6 w-6" />
              <span className="text-sm font-medium">Desde archivos</span>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
