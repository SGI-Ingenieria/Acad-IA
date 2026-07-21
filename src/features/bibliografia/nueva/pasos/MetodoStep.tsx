import { Globe, Library, Plus } from 'lucide-react'

import { computeRefsParaDetalle } from '../lib'
import { nuevaBibliografiaFormOpts } from '../schema'

import type { MetodoBibliografia } from '../types'

import { withForm } from '@/components/form'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const MetodoStep = withForm({
  ...nuevaBibliografiaFormOpts,
  render: function Render({ form }) {
    const handleKeyActivate = (e: React.KeyboardEvent, cb: () => void) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        cb()
      }
    }

    return (
      <form.AppField name="metodo">
        {(field) => {
          const isSelected = (m: Exclude<MetodoBibliografia, null>) =>
            field.state.value === m

          const seleccionar = (m: Exclude<MetodoBibliografia, null>) => {
            field.handleChange(m)
            // Cambiar de método invalida el formato elegido y re-deriva el
            // snapshot de referencias del paso Detalles (antes, un useEffect
            // de sincronización sobre el estado monolítico).
            form.setFieldValue('formato', null)
            form.setFieldValue(
              'refs',
              computeRefsParaDetalle(form.state.values),
            )
          }

          return (
            <div className="grid gap-4">
              <Card
                className={cn(
                  'cursor-pointer transition-all',
                  isSelected('MANUAL') && 'ring-ring ring-2',
                )}
                role="button"
                tabIndex={0}
                onClick={() => seleccionar('MANUAL')}
                onKeyDown={(e) =>
                  handleKeyActivate(e, () => seleccionar('MANUAL'))
                }
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="text-primary h-5 w-5" /> Manual
                  </CardTitle>
                  <CardDescription>
                    Captura referencias y edita la cita.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card
                className={cn(
                  'cursor-pointer transition-all',
                  isSelected('EN_LINEA') && 'ring-ring ring-2',
                )}
                role="button"
                tabIndex={0}
                onClick={() => seleccionar('EN_LINEA')}
                onKeyDown={(e) =>
                  handleKeyActivate(e, () => seleccionar('EN_LINEA'))
                }
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="text-primary h-5 w-5" /> Buscar en línea
                  </CardTitle>
                  <CardDescription>
                    Busca sugerencias y selecciona las mejores.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card
                className={cn(
                  'cursor-pointer transition-all',
                  isSelected('BIBLIOTECA') && 'ring-ring ring-2',
                )}
                role="button"
                tabIndex={0}
                onClick={() => seleccionar('BIBLIOTECA')}
                onKeyDown={(e) =>
                  handleKeyActivate(e, () => seleccionar('BIBLIOTECA'))
                }
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Library className="text-primary h-5 w-5" /> Buscar en
                    biblioteca
                  </CardTitle>
                  <CardDescription>
                    Consulta el catálogo institucional y agrega referencias.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )
        }}
      </form.AppField>
    )
  },
})
