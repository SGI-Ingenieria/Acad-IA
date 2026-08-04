import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

export const H5P_TIPOS = [
  'MultipleChoice',
  'TrueFalse',
  'FillInTheBlanks',
  'DragText',
  'Crossword',
  'FindTheWords',
  'Flashcards',
  'Timeline',
  'QuestionSet',
  'Essay',
  'FindMultipleHotspots',
] as const

export type H5PTipo = (typeof H5P_TIPOS)[number]

export const LearningObjectIAConfigSchema = z
  .object({
    enfoqueAcademico: z.string().optional(),
    instruccionesAdicionalesIA: z.string().optional(),
    h5pTypes: z.array(z.enum(H5P_TIPOS)).min(1).max(10).optional(),
    h5pDifficulty: z.enum(['basico', 'intermedio', 'avanzado']).optional(),
    references: z
      .object({
        fileIds: z.array(z.string().uuid()).max(5).optional().default([]),
        collectionIds: z.array(z.string().uuid()).max(5).optional().default([]),
      })
      .strict()
      .optional()
      .default({ fileIds: [], collectionIds: [] }),
    webSearchEnabled: z.boolean().optional().default(false),
    webSearchDomains: z.array(z.string().min(1)).optional().default([]),
    reasoningEffort: z
      .enum(['auto', 'none', 'low', 'medium', 'high'])
      .optional()
      .default('auto'),
    model: z.string().min(1).optional(),
  })
  .strict()
  .optional()
  .default({
    references: { fileIds: [], collectionIds: [] },
    webSearchEnabled: false,
    webSearchDomains: [],
    reasoningEffort: 'auto',
  })

export function buildLearningObjectDeepResearchTools() {
  return [{ type: 'web_search_preview' as const }]
}
