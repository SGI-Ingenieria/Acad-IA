import { describe, expect, test } from 'bun:test'

import { buildIsolatedChatRetryContext } from './chatRetryContext'

describe('contexto de volver a generar', () => {
  test('envía la identidad autoritativa sin reconstruir ajustes en el cliente', () => {
    expect(
      buildIsolatedChatRetryContext({
        dbMessageId: '11111111-1111-4111-8111-111111111111',
        requestContent: '  Analiza la secuencia curricular.  ',
      }),
    ).toEqual({
      content: 'Analiza la secuencia curricular.',
      retryOfMessageId: '11111111-1111-4111-8111-111111111111',
    })
  })
})
