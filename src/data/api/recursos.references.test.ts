import { describe, expect, test } from 'bun:test'

import { buildRecursosGenerationBody } from './recursos.api'

const ASIGNATURA_ID = '11111111-1111-4111-8111-111111111111'
const FILE_ID = '22222222-2222-4222-8222-222222222222'
const COLLECTION_ID = '33333333-3333-4333-8333-333333333333'

describe('contrato documental de contenidos didácticos', () => {
  test('propaga sólo UUID locales normalizados al iaConfig', () => {
    expect(
      buildRecursosGenerationBody(
        ASIGNATURA_ID,
        'unidad-1',
        'tema-1',
        ['apunte'],
        'Usa el programa oficial.',
        undefined,
        {
          fileIds: [FILE_ID, FILE_ID],
          collectionIds: [COLLECTION_ID],
        },
        'medium',
      ),
    ).toEqual({
      asignaturaId: ASIGNATURA_ID,
      scope: 'tema',
      unidadId: 'unidad-1',
      temaId: 'tema-1',
      requestedTypes: ['apunte'],
      iaConfig: {
        instruccionesAdicionalesIA: 'Usa el programa oficial.',
        references: {
          fileIds: [FILE_ID],
          collectionIds: [COLLECTION_ID],
        },
        reasoningEffort: 'medium',
        webSearchEnabled: false,
      },
    })
  })

  test('rechaza identificadores de OpenAI o Storage como referencias del cliente', () => {
    expect(() =>
      buildRecursosGenerationBody(
        ASIGNATURA_ID,
        null,
        null,
        ['quiz'],
        undefined,
        undefined,
        { fileIds: ['file-openai-no-autorizado'] },
      ),
    ).toThrow('referencias de IA')
  })
})
