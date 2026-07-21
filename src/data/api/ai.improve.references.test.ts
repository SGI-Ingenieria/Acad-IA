import { describe, expect, test } from 'bun:test'

import { buildAIImproveFieldBody } from './ai.api'

const BASE_INPUT = {
  entidad: 'plan' as const,
  entidad_id: '11111111-1111-4111-8111-111111111111',
  clave: 'perfil_egreso',
  contenido_actual: '<p>Contenido</p>',
  prompt_usuario: 'Hazlo más preciso.',
  es_richtext: true,
}

describe('contrato documental de mejora de campos', () => {
  test('normaliza referencias locales y razonamiento antes de invocar la Edge Function', () => {
    const fileId = '22222222-2222-4222-8222-222222222222'

    expect(
      buildAIImproveFieldBody({
        ...BASE_INPUT,
        references: { fileIds: [fileId, fileId] },
        reasoning_effort: 'high',
      }),
    ).toMatchObject({
      references: { fileIds: [fileId], collectionIds: [] },
      reasoning_effort: 'high',
    })
  })

  test('rechaza un file ID del proveedor antes de enviarlo', () => {
    expect(() =>
      buildAIImproveFieldBody({
        ...BASE_INPUT,
        references: { fileIds: ['file-no-local'] },
      }),
    ).toThrow('referencias de IA')
  })
})
