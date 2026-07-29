import { Database, FileUp, PencilLine, RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'

import type { TipoOrigen } from '@/data/types/domain'

import { withForm } from '@/components/form'
import { WizardMethodPicker } from '@/components/wizard/WizardMethodPicker'
import { nuevoPlanFormOpts } from '@/features/planes/nuevo/schema'

type IntencionPlan = 'manual' | 'ia' | 'reutilizar'
type FuenteReutilizacion = 'CLONADO_INTERNO' | 'CLONADO_TRADICIONAL'

function intencionInicial(tipoOrigen: TipoOrigen | null): IntencionPlan | null {
  if (tipoOrigen === 'MANUAL') return 'manual'
  if (tipoOrigen === 'IA') return 'ia'
  if (
    tipoOrigen === 'CLONADO_INTERNO' ||
    tipoOrigen === 'CLONADO_TRADICIONAL'
  ) {
    return 'reutilizar'
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
      <div className="space-y-7">
        <WizardMethodPicker
          title="¿Cómo quieres comenzar el plan?"
          description="Elige el punto de partida. Después sólo verás los pasos necesarios para ese camino."
          value={intencion}
          columns={canUseAI ? 3 : 2}
          onValueChange={(next) => {
            setIntencion(next)
            if (next === 'manual') seleccionarFinal('MANUAL')
            if (next === 'ia') seleccionarFinal('IA')
          }}
          options={[
            {
              value: 'manual',
              title: 'Desde cero',
              description:
                'Define la estructura y completa el plan manualmente.',
              icon: PencilLine,
            },
            ...(canUseAI
              ? [
                  {
                    value: 'ia' as const,
                    title: 'Con IA',
                    description:
                      'Orienta el enfoque y genera una primera propuesta curricular.',
                    icon: Sparkles,
                  },
                ]
              : []),
            {
              value: 'reutilizar',
              title: 'Reutilizar',
              description:
                'Parte de un plan existente o de documentos académicos.',
              icon: RefreshCw,
            },
          ]}
        />

        {intencion === 'reutilizar' ? (
          <WizardMethodPicker<FuenteReutilizacion>
            title="¿De dónde proviene el plan?"
            description="La fuente se utilizará como base; después podrás revisar los datos de destino."
            value={
              form.state.values.tipoOrigen === 'CLONADO_INTERNO' ||
              form.state.values.tipoOrigen === 'CLONADO_TRADICIONAL'
                ? form.state.values.tipoOrigen
                : null
            }
            onValueChange={seleccionarFinal}
            columns={2}
            className="animate-in fade-in slide-in-from-top-2 border-border/70 border-t pt-7"
            options={[
              {
                value: 'CLONADO_INTERNO',
                title: 'Del sistema',
                description:
                  'Busca otro plan institucional y conserva su estructura.',
                icon: Database,
              },
              {
                value: 'CLONADO_TRADICIONAL',
                title: 'Desde archivos',
                description:
                  'Importa un Word o PDF y úsalo como referencia documental.',
                icon: FileUp,
              },
            ]}
          />
        ) : null}
      </div>
    )
  },
})
