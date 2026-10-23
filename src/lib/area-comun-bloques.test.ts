import { describe, expect, it } from 'bun:test'

import { nombreBloqueAreaComun } from './area-comun-bloques'

describe('nombreBloqueAreaComun', () => {
  it('presenta la nomenclatura vigente para etiquetas históricas', () => {
    expect(nombreBloqueAreaComun('Humanismo Sociedad')).toBe(
      'Humanismo y Sociedad',
    )
    expect(nombreBloqueAreaComun('Emprendimiento Sustentabilidad')).toBe(
      'Emprendimiento y Sostenibilidad',
    )
  })

  it('conserva nombres vigentes y trata valores vacíos como ausencia', () => {
    expect(nombreBloqueAreaComun('Lengua Extranjera')).toBe('Lengua Extranjera')
    expect(nombreBloqueAreaComun('  ')).toBeNull()
  })
})
