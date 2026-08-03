import { PencilLine, Search } from 'lucide-react'

import { computeRefsParaDetalle } from '../lib'
import { nuevaBibliografiaFormOpts } from '../schema'

import type { MetodoBibliografia } from '../types'

import { withForm } from '@/components/form'
import { WizardMethodPicker } from '@/components/wizard/WizardMethodPicker'

type MetodoFinal = Exclude<MetodoBibliografia, null>

export const MetodoStep = withForm({
  ...nuevaBibliografiaFormOpts,
  props: {} as {
    onSelect: (metodo: MetodoFinal) => void
  },
  render: function Render({ form, onSelect }) {
    const seleccionar = (metodo: MetodoFinal) => {
      const nextValues = {
        ...form.state.values,
        metodo,
        formato: 'apa' as const,
      }
      form.setFieldValue('metodo', metodo)
      form.setFieldValue('formato', 'apa')
      form.setFieldValue('refs', computeRefsParaDetalle(nextValues))
      onSelect(metodo)
    }

    return (
      <WizardMethodPicker
        title="¿Cómo quieres agregar las referencias?"
        description="Puedes capturarlas directamente o encontrarlas en fuentes académicas."
        value={form.state.values.metodo}
        onValueChange={seleccionar}
        columns={2}
        options={[
          {
            value: 'MANUAL',
            title: 'Capturar manualmente',
            description:
              'Registra los datos de cada obra y revisa la cita generada.',
            icon: PencilLine,
          },
          {
            value: 'BUSCAR',
            title: 'Buscar referencias',
            description:
              'Consulta fuentes en línea y el catálogo institucional.',
            icon: Search,
          },
        ]}
      />
    )
  },
})
