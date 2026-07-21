import {
  Copy,
  Database,
  Edit3,
  List,
  Pencil,
  Sparkles,
  Upload,
} from 'lucide-react'

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
            <div className="grid gap-4 sm:grid-cols-3">
              <Card
                className={isSelected('MANUAL') ? 'ring-ring ring-2' : ''}
                onClick={() => seleccionar('MANUAL')}
                role="button"
                tabIndex={0}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pencil className="text-primary h-5 w-5" /> Manual
                  </CardTitle>
                  <CardDescription>
                    Asignatura vacía con estructura base.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card
                className={isSelected('IA') ? 'ring-ring ring-2' : ''}
                onClick={() => seleccionar('IA')}
                role="button"
                tabIndex={0}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="text-primary h-5 w-5" /> Con IA
                  </CardTitle>
                  <CardDescription>
                    Generar contenido automático.
                  </CardDescription>
                </CardHeader>
                {(tipoOrigen === 'IA' ||
                  tipoOrigen === 'IA_SIMPLE' ||
                  tipoOrigen === 'IA_MULTIPLE') && (
                  <CardContent className="flex flex-col gap-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        seleccionar('IA_SIMPLE')
                      }}
                      onKeyDown={(e: React.KeyboardEvent) =>
                        handleKeyActivate(e, () => seleccionar('IA_SIMPLE'))
                      }
                      className={`hover:border-primary/50 hover:bg-accent flex cursor-pointer items-center gap-4 rounded-lg border p-4 text-left transition-all ${
                        isSelected('IA_SIMPLE')
                          ? 'bg-primary/5 text-primary ring-primary border-primary ring-1'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      <Edit3 className="h-6 w-6 flex-none" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          Una asignatura
                        </span>
                        <span className="text-xs opacity-70">
                          Crear una asignatura con control detallado de
                          metadatos.
                        </span>
                      </div>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        seleccionar('IA_MULTIPLE')
                      }}
                      onKeyDown={(e: React.KeyboardEvent) =>
                        handleKeyActivate(e, () => seleccionar('IA_MULTIPLE'))
                      }
                      className={`hover:border-primary/50 hover:bg-accent flex cursor-pointer items-center gap-4 rounded-lg border p-4 text-left transition-all ${
                        isSelected('IA_MULTIPLE')
                          ? 'bg-primary/5 text-primary ring-primary border-primary ring-1'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      <List className="h-6 w-6 flex-none" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          Varias asignaturas
                        </span>
                        <span className="text-xs opacity-70">
                          Generar varias asignaturas a partir de sugerencias de
                          la IA.
                        </span>
                      </div>
                    </div>
                  </CardContent>
                )}
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
                  className="text-destructive text-sm sm:col-span-3"
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
