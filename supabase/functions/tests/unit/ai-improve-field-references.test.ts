import { assertEquals, assertFalse } from 'jsr:@std/assert@1'

import {
  AIImproveFieldRequestSchema,
  mergeImprovementReferenceContext,
} from '../../ai-improve-field/contract.ts'

const BASE_REQUEST = {
  entidad: 'plan' as const,
  entidad_id: '11111111-1111-4111-8111-111111111111',
  clave: 'perfil_egreso',
  contenido_actual: '<p>Contenido</p>',
  prompt_usuario: 'Hazlo más preciso.',
  es_richtext: true,
}

Deno.test(
  'ai-improve-field acepta únicamente referencias documentales locales',
  () => {
    const parsed = AIImproveFieldRequestSchema.parse({
      ...BASE_REQUEST,
      references: {
        fileIds: ['22222222-2222-4222-8222-222222222222'],
        collectionIds: ['33333333-3333-4333-8333-333333333333'],
      },
      reasoning_effort: 'medium',
    })

    assertEquals(parsed.references, {
      fileIds: ['22222222-2222-4222-8222-222222222222'],
      collectionIds: ['33333333-3333-4333-8333-333333333333'],
    })
    assertEquals(parsed.reasoning_effort, 'medium')
  },
)

Deno.test(
  'ai-improve-field rechaza IDs externos y más de cinco referencias',
  () => {
    assertFalse(
      AIImproveFieldRequestSchema.safeParse({
        ...BASE_REQUEST,
        references: { fileIds: ['file-openai-no-autorizado'] },
      }).success,
    )
    assertFalse(
      AIImproveFieldRequestSchema.safeParse({
        ...BASE_REQUEST,
        references: {
          fileIds: Array.from(
            { length: 6 },
            (_, index) =>
              `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          ),
        },
      }).success,
    )
  },
)

Deno.test(
  'ai-improve-field incorpora el contexto recuperado antes de la solicitud',
  () => {
    assertEquals(
      mergeImprovementReferenceContext('Mejora el campo.', 'Fuente autorizada'),
      'Fuente autorizada\n\nSolicitud de mejora:\nMejora el campo.',
    )
  },
)
