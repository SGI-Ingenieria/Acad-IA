import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { SelectorCiclosInline } from './SelectorCiclosInline'

const noop = () => {}

describe('SelectorCiclosInline — presentación numérica', () => {
  test('presenta un único campo de texto numérico sin controles nativos duplicados', () => {
    const html = renderToStaticMarkup(
      <SelectorCiclosInline
        cantidad={13}
        tipo="Cuatrimestre"
        semanasPorCiclo={null}
        tiposDisponibles={['Trimestre', 'Cuatrimestre', 'Semestre', 'Otro']}
        onCantidadChange={noop}
        onTipoChange={noop}
        onSemanasChange={noop}
      />,
    )

    expect(html.match(/role="spinbutton"/g)).toHaveLength(1)
    expect(html).toContain('type="text"')
    expect(html).toContain('data-slot="popover-trigger"')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).not.toContain('type="number"')
  })

  test('sólo añade el segundo editor numérico cuando el ciclo es personalizado', () => {
    const html = renderToStaticMarkup(
      <SelectorCiclosInline
        cantidad={1}
        tipo="Otro"
        semanasPorCiclo={1}
        tiposDisponibles={['Trimestre', 'Cuatrimestre', 'Semestre', 'Otro']}
        onCantidadChange={noop}
        onTipoChange={noop}
        onSemanasChange={noop}
      />,
    )

    expect(html.match(/role="spinbutton"/g)).toHaveLength(2)
    expect(html).toContain('semana por ciclo')
  })
})
