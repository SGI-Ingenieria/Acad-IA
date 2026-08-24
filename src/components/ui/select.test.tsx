import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

function OpcionesCompuestas() {
  return <SelectItem value="ingenieria">Ingeniería</SelectItem>
}

function SelectDeFacultad({ disabled = false }: { disabled?: boolean }) {
  return (
    <Select disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Facultad" />
      </SelectTrigger>
      <SelectContent hasItems>
        <OpcionesCompuestas />
      </SelectContent>
    </Select>
  )
}

describe('Select', () => {
  test('permite opciones encapsuladas en componentes', () => {
    const html = renderToStaticMarkup(<SelectDeFacultad />)

    expect(html).not.toContain('disabled=""')
  })

  test('respeta el estado disabled explícito', () => {
    const html = renderToStaticMarkup(<SelectDeFacultad disabled />)

    expect(html).toContain('disabled=""')
  })
})
