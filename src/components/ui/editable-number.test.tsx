import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { EditableNumber } from './editable-number'

describe('EditableNumber', () => {
  test('mantiene los pasos colapsados e inertes antes de activar el número', () => {
    const html = renderToStaticMarkup(
      <EditableNumber
        value={4}
        min={1}
        max={12}
        ariaLabel="Semestre"
        onSave={() => {}}
      />,
    )

    expect(html).toContain('data-state="inactive"')
    expect(html).toContain('aria-hidden="true"')
    expect(html.match(/pointer-events-none/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html.match(/w-0/g)).toHaveLength(2)
  })
})
