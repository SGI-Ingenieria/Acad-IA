import { z } from 'zod'

import { ApiError } from './_helpers'

import type { UUID } from '../types/domain'

export type AIGenerationReferences = {
  fileIds?: Array<UUID>
  collectionIds?: Array<UUID>
}

const referenceIdsSchema = z
  .object({
    fileIds: z.array(z.uuid()).max(5).optional().default([]),
    collectionIds: z.array(z.uuid()).max(5).optional().default([]),
  })
  .strict()

export function normalizeAIGenerationReferences(
  references?: AIGenerationReferences,
): Required<AIGenerationReferences> {
  const result = referenceIdsSchema.safeParse(references ?? {})
  if (!result.success) {
    throw new ApiError(
      'Las referencias de IA deben ser archivos o colecciones válidas de Acad-IA.',
      'INVALID_AI_DOCUMENT_REFERENCES',
      result.error.issues,
    )
  }

  return {
    fileIds: Array.from(new Set(result.data.fileIds)),
    collectionIds: Array.from(new Set(result.data.collectionIds)),
  }
}
