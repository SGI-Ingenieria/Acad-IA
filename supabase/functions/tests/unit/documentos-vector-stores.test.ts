import { assertEquals } from 'jsr:@std/assert@1'

import { buildReferenceTools } from '../../_shared/documentos-referencias.ts'
import {
  estimarTokens,
  hashSeleccion,
  UMBRAL_TOKENS_INYECCION_DIRECTA,
} from '../../_shared/documentos-vector-stores.ts'

Deno.test('la llave de selección es estable ante orden y duplicados', async () => {
  const a = 'a'.repeat(64)
  const b = 'b'.repeat(64)
  assertEquals(await hashSeleccion([a, b]), await hashSeleccion([b, a, b]))
  assertEquals(
    (await hashSeleccion([a])) === (await hashSeleccion([b])),
    false,
  )
})

Deno.test('el umbral de inyección directa se estima por tokens', () => {
  assertEquals(estimarTokens(4) <= UMBRAL_TOKENS_INYECCION_DIRECTA, true)
  assertEquals(
    estimarTokens(UMBRAL_TOKENS_INYECCION_DIRECTA * 4 + 4) >
      UMBRAL_TOKENS_INYECCION_DIRECTA,
    true,
  )
})

Deno.test('las tools combinan web_search y file_search según la resolución', () => {
  assertEquals(buildReferenceTools({}), undefined)
  assertEquals(buildReferenceTools({ webSearchEnabled: true }), [
    { type: 'web_search' },
  ])
  assertEquals(
    buildReferenceTools({ webSearchEnabled: true, vectorStoreId: 'vs_1' }),
    [
      { type: 'web_search' },
      { type: 'file_search', vector_store_ids: ['vs_1'] },
    ],
  )
  assertEquals(buildReferenceTools({ vectorStoreId: 'vs_1' }), [
    { type: 'file_search', vector_store_ids: ['vs_1'] },
  ])
})
