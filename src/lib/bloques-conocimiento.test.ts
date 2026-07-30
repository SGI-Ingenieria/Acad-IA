import { describe, expect, it } from 'bun:test'

import { descripcionBloque } from './bloques-conocimiento'

describe('descripcionBloque', () => {
  it('prioriza y conserva el contenido histórico sin duplicar vacíos', () => {
    expect(
      descripcionBloque({
        proposito: '  Bases matemáticas ',
        aporte_perfil_egreso: '',
        alcance_formativo: 'Antes de la especialización',
      }),
    ).toBe('Bases matemáticas\n\nAntes de la especialización')
  })
})
