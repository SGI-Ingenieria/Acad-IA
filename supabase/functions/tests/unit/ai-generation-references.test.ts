import { assertEquals, assertThrows } from 'jsr:@std/assert@1'

import {
  buildGenerationTools,
  normalizeGenerationReferences,
} from '../../_shared/ai-generation-references.ts'
import {
  buildLearningObjectDeepResearchTools,
  LearningObjectIAConfigSchema,
} from '../../learning-object-generate/contract.ts'

const FILE_ID = '11111111-1111-4111-8111-111111111111'
const COLLECTION_ID = '22222222-2222-4222-8222-222222222222'

Deno.test('las generaciones aceptan sólo referencias documentales UUID', () => {
  const parsed = normalizeGenerationReferences({
    fileIds: [FILE_ID],
    collectionIds: [COLLECTION_ID],
  })

  assertEquals(parsed, {
    fileIds: [FILE_ID],
    collectionIds: [COLLECTION_ID],
  })
  assertThrows(
    () => normalizeGenerationReferences({ fileIds: ['file-heredado'] }),
    TypeError,
  )
  assertThrows(
    () =>
      normalizeGenerationReferences({
        collectionIds: ['vs_heredado'],
      }),
    TypeError,
  )
})

Deno.test('el contrato Edge rechaza propiedades legacy de OpenAI', () => {
  assertThrows(
    () =>
      normalizeGenerationReferences({
        fileIds: [],
        collectionIds: [],
        openaiFileIds: ['file-heredado'],
      }),
    TypeError,
  )
})

Deno.test(
  'la única herramienta externa permitida por el contrato es web search',
  () => {
    assertEquals(buildGenerationTools(false), undefined)
    assertEquals(buildGenerationTools(true), [{ type: 'web_search' }])
    assertEquals(buildLearningObjectDeepResearchTools(), [
      { type: 'web_search_preview' },
    ])
  },
)

Deno.test(
  'recursos rechaza identificadores heredados de OpenAI y vector stores',
  () => {
    assertThrows(() =>
      LearningObjectIAConfigSchema.parse({
        references: { fileIds: [], collectionIds: [] },
        archivosReferencia: ['file-heredado'],
      }),
    )
    assertThrows(() =>
      LearningObjectIAConfigSchema.parse({
        references: { fileIds: [], collectionIds: [] },
        repositoriosIds: ['vs_heredado'],
      }),
    )
    assertThrows(() =>
      LearningObjectIAConfigSchema.parse({
        references: { fileIds: ['file-heredado'], collectionIds: [] },
      }),
    )
  },
)

Deno.test('recursos omite por defecto todo identificador de proveedor', () => {
  const parsed = LearningObjectIAConfigSchema.parse({})

  assertEquals(parsed, {
    references: { fileIds: [], collectionIds: [] },
    webSearchEnabled: false,
    webSearchDomains: [],
    reasoningEffort: 'auto',
  })
  assertEquals('archivosReferencia' in parsed, false)
  assertEquals('repositoriosIds' in parsed, false)
})

Deno.test('recursos acepta una dificultad H5P controlada', () => {
  const parsed = LearningObjectIAConfigSchema.parse({
    h5pDifficulty: 'avanzado',
  })

  assertEquals(parsed.h5pDifficulty, 'avanzado')
  assertThrows(() =>
    LearningObjectIAConfigSchema.parse({ h5pDifficulty: 'experto' }),
  )
})
