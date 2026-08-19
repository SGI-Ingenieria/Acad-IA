import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { routerConfigurationCode } from '../src/lib/router-diagnostic.js'

describe('Azure webhook router diagnostics', () => {
  it('identifica una variable faltante sin incluir su valor', () => {
    const result = routerConfigurationCode(
      new Error('Missing Azure Static Web App setting: OPENAI_API_KEY'),
    )

    assert.equal(result, 'missing_openai_api_key')
  })

  it('reduce errores inesperados a una categoría segura', () => {
    const error = new Error('secret-bearing internal detail')
    error.name = 'UnexpectedSecretError'

    assert.equal(routerConfigurationCode(error), 'initialization_error')
  })

  it('conserva sólo nombres de error permitidos', () => {
    const error = new TypeError('implementation detail')

    assert.equal(routerConfigurationCode(error), 'initialization_typeerror')
  })
})
