import { describe, expect, test } from 'bun:test'
import { PencilLine, RefreshCw, Sparkles } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'

import { WizardMethodPicker } from './WizardMethodPicker'

describe('WizardMethodPicker', () => {
  test('presenta las intenciones como un único grupo de selección accesible', () => {
    const html = renderToStaticMarkup(
      <WizardMethodPicker
        title="¿Cómo quieres comenzar?"
        description="Elige un camino."
        value="ia"
        onValueChange={() => {}}
        options={[
          {
            value: 'manual',
            title: 'Desde cero',
            description: 'Captura manual.',
            icon: PencilLine,
          },
          {
            value: 'ia',
            title: 'Con IA',
            description: 'Genera una propuesta.',
            icon: Sparkles,
          },
          {
            value: 'reutilizar',
            title: 'Reutilizar',
            description: 'Parte de una fuente.',
            icon: RefreshCw,
          },
        ]}
      />,
    )

    expect(html).toContain('role="radiogroup"')
    expect(html.match(/role="radio"/g)).toHaveLength(3)
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('Desde cero')
    expect(html).toContain('Con IA')
    expect(html).toContain('Reutilizar')
  })

  test('omite por completo el texto explicativo cuando no se proporciona', () => {
    const html = renderToStaticMarkup(
      <WizardMethodPicker
        title="¿Qué quieres hacer?"
        value="crear"
        onValueChange={() => {}}
        options={[
          { value: 'crear', title: 'Crear', icon: PencilLine },
          { value: 'redisenar', title: 'Rediseñar', icon: RefreshCw },
        ]}
        columns={2}
      />,
    )

    expect(html).toContain('Crear')
    expect(html).toContain('Rediseñar')
    expect(html).not.toContain('<p class=')
  })
})
