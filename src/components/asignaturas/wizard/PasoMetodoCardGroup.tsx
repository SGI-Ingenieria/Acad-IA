import { Copy, Database, Pencil, Upload } from 'lucide-react'

import type { TipoOrigenCreacion } from '@/features/asignaturas/nueva/types'

import { withForm } from '@/components/form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  nuevaAsignaturaFormOpts,
  primerError,
  tipoOrigenSchema,
} from '@/features/asignaturas/nueva/schema'

export const PasoMetodoCardGroup = withForm({
  ...nuevaAsignaturaFormOpts,
  render: function Render({ form }) {
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
      <form.AppField
        name="tipoOrigen"
        validators={{
          onChange: ({ value }) => primerError(tipoOrigenSchema, value),
        }}
      >
        {(field) => {
          const tipoOrigen = field.state.value
          const isSelected = (modo: TipoOrigenCreacion) => tipoOrigen === modo
          const seleccionar = (modo: TipoOrigenCreacion) =>
            field.handleChange(modo)
          const invalid =
            field.state.meta.isTouched && !field.state.meta.isValid

          return (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card
                className={isSelected('MANUAL') ? 'ring-ring ring-2' : ''}
                onClick={() => seleccionar('MANUAL')}
                onKeyDown={(e: React.KeyboardEvent) =>
                  handleKeyActivate(e, () => seleccionar('MANUAL'))
                }
                role="button"
                tabIndex={0}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pencil className="text-primary h-5 w-5" /> Crear nueva
                  </CardTitle>
                  <CardDescription>
                    Captura primero sus datos básicos.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card
                className={isSelected('CLONADO') ? 'ring-ring ring-2' : ''}
                onClick={() => seleccionar('CLONADO')}
                role="button"
                tabIndex={0}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Copy className="text-primary h-5 w-5" /> Clonado
                  </CardTitle>
                  <CardDescription>
                    De otra asignatura o archivo Word.
                  </CardDescription>
                </CardHeader>
                {(tipoOrigen === 'CLONADO' ||
                  tipoOrigen === 'CLONADO_INTERNO' ||
                  tipoOrigen === 'CLONADO_TRADICIONAL') && (
                  <CardContent className="flex flex-col gap-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        seleccionar('CLONADO_INTERNO')
                      }}
                      onKeyDown={(e: React.KeyboardEvent) =>
                        handleKeyActivate(e, () =>
                          seleccionar('CLONADO_INTERNO'),
                        )
                      }
                      className={`hover:border-primary/50 hover:bg-accent flex cursor-pointer items-center gap-4 rounded-lg border p-4 text-left transition-all ${
                        isSelected('CLONADO_INTERNO')
                          ? 'bg-primary/5 text-primary ring-primary border-primary ring-1'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      <Database className="h-6 w-6 flex-none" />
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
                        seleccionar('CLONADO_TRADICIONAL')
                      }}
                      onKeyDown={(e: React.KeyboardEvent) =>
                        handleKeyActivate(e, () =>
                          seleccionar('CLONADO_TRADICIONAL'),
                        )
                      }
                      className={`hover:border-primary/50 hover:bg-accent flex cursor-pointer items-center gap-4 rounded-lg border p-4 text-left transition-all ${
                        isSelected('CLONADO_TRADICIONAL')
                          ? 'bg-primary/5 text-primary ring-primary border-primary ring-1'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      <Upload className="h-6 w-6 flex-none" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          Desde archivos
                        </span>
                        <span className="text-xs opacity-70">
                          Subir Word o PDF (hasta 10)
                        </span>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {invalid ? (
                <p
                  className="text-destructive text-sm sm:col-span-2"
                  role="alert"
                >
                  {typeof field.state.meta.errors[0] === 'string'
                    ? field.state.meta.errors[0]
                    : 'Selecciona un método de creación para continuar.'}
                </p>
              ) : null}
            </div>
          )
        }}
      </form.AppField>
    )
  },
})
