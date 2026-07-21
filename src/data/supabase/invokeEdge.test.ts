import { describe, expect, test } from 'bun:test'

import { EdgeFunctionError, getEdgeFunctionErrorCode } from './invokeEdge'

describe('códigos estructurados de Edge Functions', () => {
  test('reconoce tanto el contrato anidado como el contrato plano', () => {
    expect(
      getEdgeFunctionErrorCode(
        new EdgeFunctionError('Error', 'nested', 409, {
          error: { code: 'DOCUMENT_STILL_PROCESSING' },
        }),
      ),
    ).toBe('DOCUMENT_STILL_PROCESSING')

    expect(
      getEdgeFunctionErrorCode(
        new EdgeFunctionError('Error', 'flat', 409, {
          error: 'DOCUMENT_STILL_PROCESSING',
          message: 'El documento sigue preparándose.',
        }),
      ),
    ).toBe('DOCUMENT_STILL_PROCESSING')
  })
})
