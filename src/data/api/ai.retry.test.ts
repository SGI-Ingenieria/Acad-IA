import { describe, expect, test } from 'bun:test'

import { buildAIChatMessageBody } from './ai.api'

describe('contrato cliente de reintento IA', () => {
  test('envía únicamente retryOfMessageId y descarta el estado actual del UI', () => {
    expect(
      buildAIChatMessageBody({
        content: 'Texto reconstruido en el cliente',
        campos: ['perfil_egreso'],
        references: {
          fileIds: ['11111111-1111-4111-8111-111111111111'],
          collectionIds: ['22222222-2222-4222-8222-222222222222'],
        },
        webSearchEnabled: true,
        reasoningEffort: 'high',
        retryOfMessageId: '33333333-3333-4333-8333-333333333333',
      }),
    ).toEqual({
      retryOfMessageId: '33333333-3333-4333-8333-333333333333',
    })
  })

  test('conserva el contrato completo para un mensaje nuevo', () => {
    expect(
      buildAIChatMessageBody({
        content: 'Analiza la progresión curricular.',
        campos: ['perfil_egreso'],
        references: {
          fileIds: ['11111111-1111-4111-8111-111111111111'],
        },
        webSearchEnabled: true,
        reasoningEffort: 'medium',
      }),
    ).toEqual({
      content: 'Analiza la progresión curricular.',
      campos: ['perfil_egreso'],
      references: {
        fileIds: ['11111111-1111-4111-8111-111111111111'],
        collectionIds: [],
      },
      webSearchEnabled: true,
      reasoningEffort: 'medium',
    })
  })
})
