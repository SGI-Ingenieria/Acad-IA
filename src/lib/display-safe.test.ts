import { describe, expect, test } from 'bun:test'

import {
  fallbackSequenceLabel,
  formatFileDisplayName,
  isLikelyTechnicalId,
  safeHumanText,
  stripUuidPrefix,
} from './display-safe'

describe('display-safe', () => {
  test('detects technical identifiers that should not be shown as labels', () => {
    expect(isLikelyTechnicalId('11111111-1111-1111-1111-111111111111')).toBe(
      true,
    )
    expect(isLikelyTechnicalId('file_abc123456789')).toBe(true)
    expect(isLikelyTechnicalId('vs_abc123456789')).toBe(true)
    expect(isLikelyTechnicalId('Licenciatura')).toBe(false)
  })

  test('formats uploaded file names without UUID prefixes', () => {
    expect(
      stripUuidPrefix('11111111-1111-1111-1111-111111111111-plan.pdf'),
    ).toBe('plan.pdf')
    expect(
      formatFileDisplayName(
        'referencias/11111111-1111-1111-1111-111111111111-plan.pdf',
      ),
    ).toBe('plan.pdf')
  })

  test('uses human fallbacks instead of leaking identifiers', () => {
    expect(
      safeHumanText('11111111-1111-1111-1111-111111111111', 'Usuario'),
    ).toBe('Usuario')
    expect(safeHumanText('', 'Elemento sin nombre')).toBe('Elemento sin nombre')
    expect(fallbackSequenceLabel('Repositorio de referencia', 1)).toBe(
      'Repositorio de referencia 2',
    )
  })
})
