import { Database, FileUp, PencilLine, RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'

import type { TipoOrigenCreacion } from '@/features/asignaturas/nueva/types'

import { withForm } from '@/components/form'
import { WizardMethodPicker } from '@/components/wizard/WizardMethodPicker'
import { nuevaAsignaturaFormOpts } from '@/features/asignaturas/nueva/schema'

type IntencionAsignatura = 'manual' | 'ia' | 'reutilizar'
type FuenteReutilizacion = 'CLONADO_INTERNO' | 'CLONADO_TRADICIONAL'

function intencionInicial(
  tipoOrigen: TipoOrigenCreacion | null,
): IntencionAsignatura | null {
  if (tipoOrigen === 'MANUAL') return 'manual'
  if (tipoOrigen === 'IA_SIMPLE') return 'ia'
  if (
    tipoOrigen === 'CLONADO_INTERNO' ||
    tipoOrigen === 'CLONADO_TRADICIONAL'
  ) {
    return 'reutilizar'
  }
  return null
}

export const PasoMetodoCardGroup = withForm({
  ...nuevaAsignaturaFormOpts,
  props: {} as {
    canUseAI: boolean
    onSelect: (tipoOrigen: TipoOrigenCreacion) => void
  },
  render: function Render({ form, canUseAI, onSelect }) {
    const [intencion, setIntencion] = useState<IntencionAsignatura | null>(() =>
      intencionInicial(form.state.values.tipoOrigen),
    )

    const seleccionarFinal = (tipoOrigen: TipoOrigenCreacion) => {
      form.setFieldValue('tipoOrigen', tipoOrigen)
      onSelect(tipoOrigen)
    }

    return (
      <div className="space-y-7">
        <WizardMethodPicker
          title="¿Cómo quieres crear la asignatura?"
          description="Elige el punto de partida y el asistente ajustará el recorrido."
          value={intencion}
          columns={canUseAI ? 3 : 2}
          onValueChange={(next) => {
            setIntencion(next)
            if (next === 'manual') seleccionarFinal('MANUAL')
            if (next === 'ia') seleccionarFinal('IA_SIMPLE')
          }}
          options={[
            {
              value: 'manual',
              title: 'Desde cero',
              description: 'Captura la identidad, ubicación y carga académica.',
              icon: PencilLine,
            },
            ...(canUseAI
              ? [
                  {
                    value: 'ia' as const,
                    title: 'Con IA',
                    description:
                      'Define los datos esenciales y genera una propuesta completa.',
                    icon: Sparkles,
                  },
                ]
              : []),
            {
              value: 'reutilizar',
              title: 'Reutilizar',
              description:
                'Parte de otra asignatura o de documentos existentes.',
              icon: RefreshCw,
            },
          ]}
        />

        {intencion === 'reutilizar' ? (
          <WizardMethodPicker<FuenteReutilizacion>
            title="¿De dónde proviene la asignatura?"
            description="Elige la fuente que servirá como base para la nueva asignatura."
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
                  'Busca una asignatura en otros planes institucionales.',
                icon: Database,
              },
              {
                value: 'CLONADO_TRADICIONAL',
                title: 'Desde archivos',
                description: 'Importa uno o varios documentos Word o PDF.',
                icon: FileUp,
              },
            ]}
          />
        ) : null}
      </div>
    )
  },
})
