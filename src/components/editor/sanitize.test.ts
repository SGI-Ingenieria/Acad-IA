import { describe, expect, test } from 'bun:test'

import { isEmptyRichText } from './sanitize'

describe('estado vacío del editor enriquecido', () => {
  test('reconoce el documento vacío que deja ProseMirror al borrar todo', () => {
    expect(isEmptyRichText('<p><br></p>')).toBe(true)
    expect(isEmptyRichText('<p>&nbsp;</p>')).toBe(true)
  })

  test('no confunde un primer renglón vacío con un documento vacío', () => {
    expect(isEmptyRichText('<p></p><p>Contenido real</p>')).toBe(false)
  })
})
