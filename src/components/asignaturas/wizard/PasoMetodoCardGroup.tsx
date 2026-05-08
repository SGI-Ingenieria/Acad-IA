import * as Icons from 'lucide-react'

import type { NewSubjectWizardState } from '@/features/asignaturas/nueva/types'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function PasoMetodoCardGroup({
  wizard,
  onChange,
}: {
  wizard: NewSubjectWizardState
  onChange: React.Dispatch<React.SetStateAction<NewSubjectWizardState>>
}) {
  const isSelected = (modo: NewSubjectWizardState['tipoOrigen']) =>
    wizard.tipoOrigen === modo
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
            (w): NewSubjectWizardState => ({
              ...w,
              tipoOrigen: 'MANUAL',
            }),
          )
        }
        role="button"
        tabIndex={0}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.Pencil className="text-primary h-5 w-5" /> Manual
          </CardTitle>
          <CardDescription>
            Asignatura vacía con estructura base.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card
        className={isSelected('IA') ? 'ring-ring ring-2' : ''}
        onClick={() =>
          onChange(
            (w): NewSubjectWizardState => ({
              ...w,
              tipoOrigen: 'IA',
            }),
          )
        }
        role="button"
        tabIndex={0}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.Sparkles className="text-primary h-5 w-5" /> Con IA
          </CardTitle>
          <CardDescription>Generar contenido automático.</CardDescription>
        </CardHeader>
        {(wizard.tipoOrigen === 'IA' ||
          wizard.tipoOrigen === 'IA_SIMPLE' ||
          wizard.tipoOrigen === 'IA_MULTIPLE') && (
          <CardContent className="flex flex-col gap-3">
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onChange(
                  (w): NewSubjectWizardState => ({
                    ...w,
                    tipoOrigen: 'IA_SIMPLE',
                  }),
                )
              }}
              onKeyDown={(e: React.KeyboardEvent) =>
                handleKeyActivate(e, () =>
                  onChange(
                    (w): NewSubjectWizardState => ({
                      ...w,
                      tipoOrigen: 'IA_SIMPLE',
                    }),
                  ),
                )
              }
              className={`hover:border-primary/50 hover:bg-accent flex cursor-pointer items-center gap-4 rounded-lg border p-4 text-left transition-all ${
                isSelected('IA_SIMPLE')
                  ? 'bg-primary/5 text-primary ring-primary border-primary ring-1'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <Icons.Edit3 className="h-6 w-6 flex-none" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Una asignatura</span>
                <span className="text-xs opacity-70">
                  Crear una asignatura con control detallado de metadatos.
                </span>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onChange(
                  (w): NewSubjectWizardState => ({
                    ...w,
                    tipoOrigen: 'IA_MULTIPLE',
                  }),
                )
              }}
              onKeyDown={(e: React.KeyboardEvent) =>
                handleKeyActivate(e, () =>
                  onChange(
                    (w): NewSubjectWizardState => ({
                      ...w,
                      tipoOrigen: 'IA_MULTIPLE',
                    }),
                  ),
                )
              }
              className={`hover:border-primary/50 hover:bg-accent flex cursor-pointer items-center gap-4 rounded-lg border p-4 text-left transition-all ${
                isSelected('IA_MULTIPLE')
                  ? 'bg-primary/5 text-primary ring-primary border-primary ring-1'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <Icons.List className="h-6 w-6 flex-none" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Varias asignaturas</span>
                <span className="text-xs opacity-70">
                  Generar varias asignaturas a partir de sugerencias de la IA.
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card
        className={isSelected('CLONADO') ? 'ring-ring ring-2' : ''}
        onClick={() =>
          onChange(
            (w): NewSubjectWizardState => ({ ...w, tipoOrigen: 'CLONADO' }),
          )
        }
        role="button"
        tabIndex={0}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.Copy className="text-primary h-5 w-5" /> Clonado
          </CardTitle>
          <CardDescription>De otra asignatura o archivo Word.</CardDescription>
        </CardHeader>
        {(wizard.tipoOrigen === 'CLONADO' ||
          wizard.tipoOrigen === 'CLONADO_INTERNO' ||
          wizard.tipoOrigen === 'CLONADO_TRADICIONAL') && (
          <CardContent className="flex flex-col gap-3">
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onChange(
                  (w): NewSubjectWizardState => ({
                    ...w,
                    tipoOrigen: 'CLONADO_INTERNO',
                  }),
                )
              }}
              onKeyDown={(e: React.KeyboardEvent) =>
                handleKeyActivate(e, () =>
                  onChange(
                    (w): NewSubjectWizardState => ({
                      ...w,
                      tipoOrigen: 'CLONADO_INTERNO',
                    }),
                  ),
                )
              }
              className={`hover:border-primary/50 hover:bg-accent flex cursor-pointer items-center gap-4 rounded-lg border p-4 text-left transition-all ${
                isSelected('CLONADO_INTERNO')
                  ? 'bg-primary/5 text-primary ring-primary border-primary ring-1'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <Icons.Database className="h-6 w-6 flex-none" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Del sistema</span>
                <span className="text-xs opacity-70">
                  Buscar en otros planes
                </span>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onChange(
                  (w): NewSubjectWizardState => ({
                    ...w,
                    tipoOrigen: 'CLONADO_TRADICIONAL',
                  }),
                )
              }}
              onKeyDown={(e: React.KeyboardEvent) =>
                handleKeyActivate(e, () =>
                  onChange(
                    (w): NewSubjectWizardState => ({
                      ...w,
                      tipoOrigen: 'CLONADO_TRADICIONAL',
                    }),
                  ),
                )
              }
              className={`hover:border-primary/50 hover:bg-accent flex cursor-pointer items-center gap-4 rounded-lg border p-4 text-left transition-all ${
                isSelected('CLONADO_TRADICIONAL')
                  ? 'bg-primary/5 text-primary ring-primary border-primary ring-1'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <Icons.Upload className="h-6 w-6 flex-none" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Desde archivos</span>
                <span className="text-xs opacity-70">
                  Subir Word o PDF (hasta 10)
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
