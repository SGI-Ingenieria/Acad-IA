import { Database, FileUp, PencilLine, RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'

import type { TipoOrigen } from '@/data/types/domain'

import { withForm } from '@/components/form'
import { WizardMethodPicker } from '@/components/wizard/WizardMethodPicker'
import { nuevoPlanFormOpts } from '@/features/planes/nuevo/schema'

type IntencionPlan = 'crear' | 'redisenar'
type FuenteCreacion = 'MANUAL' | 'IA'
type FuenteReutilizacion = 'CLONADO_INTERNO' | 'CLONADO_TRADICIONAL'

function intencionInicial(tipoOrigen: TipoOrigen | null): IntencionPlan | null {
  if (tipoOrigen === 'MANUAL' || tipoOrigen === 'IA') return 'crear'
  if (
    tipoOrigen === 'CLONADO_INTERNO' ||
    tipoOrigen === 'CLONADO_TRADICIONAL'
  ) {
    return 'redisenar'
  }
  return null
}

export const PasoModoCardGroup = withForm({
  ...nuevoPlanFormOpts,
  props: {} as {
    canUseAI: boolean
    onSelect: (tipoOrigen: TipoOrigen) => void
  },
  render: function Render({ form, canUseAI, onSelect }) {
    const [intencion, setIntencion] = useState<IntencionPlan | null>(() =>
      intencionInicial(form.state.values.tipoOrigen),
    )

    const seleccionarFinal = (tipoOrigen: TipoOrigen) => {
      form.setFieldValue('tipoOrigen', tipoOrigen)
      onSelect(tipoOrigen)
    }

    return (
      <div className="space-y-region">
        <WizardMethodPicker
          title="¿Qué quieres hacer?"
          value={intencion}
          columns={2}
          onValueChange={(next) => {
            setIntencion(next)
            form.setFieldValue('tipoOrigen', null)
          }}
          options={[
            {
              value: 'crear',
              title: 'Crear',
              icon: PencilLine,
            },
            {
              value: 'redisenar',
              title: 'Rediseñar',
              icon: RefreshCw,
            },
          ]}
        />

        {intencion === 'crear' ? (
          <WizardMethodPicker<FuenteCreacion>
            title="¿Cómo quieres crear el plan?"
            value={
              form.state.values.tipoOrigen === 'MANUAL' ||
              form.state.values.tipoOrigen === 'IA'
                ? form.state.values.tipoOrigen
                : null
            }
            onValueChange={seleccionarFinal}
            columns={2}
            className="animate-in fade-in slide-in-from-top-2 border-border/70 pt-region border-t"
            options={[
              {
                value: 'MANUAL',
                title: 'Manual',
                icon: PencilLine,
              },
              ...(canUseAI
                ? [
                    {
                      value: 'IA' as const,
                      title: 'Con IA',
                      icon: Sparkles,
                    },
                  ]
                : []),
            ]}
          />
        ) : null}

        {intencion === 'redisenar' ? (
          <WizardMethodPicker<FuenteReutilizacion>
            title="¿Cuál es el antecedente?"
            value={
              form.state.values.tipoOrigen === 'CLONADO_INTERNO' ||
              form.state.values.tipoOrigen === 'CLONADO_TRADICIONAL'
                ? form.state.values.tipoOrigen
                : null
            }
            onValueChange={seleccionarFinal}
            columns={2}
            className="animate-in fade-in slide-in-from-top-2 border-border/70 pt-region border-t"
            options={[
              {
                value: 'CLONADO_INTERNO',
                title: 'Plan existente',
                icon: Database,
              },
              {
                value: 'CLONADO_TRADICIONAL',
                title: 'Expediente',
                icon: FileUp,
              },
            ]}
          />
        ) : null}
      </div>
    )
  },
})
