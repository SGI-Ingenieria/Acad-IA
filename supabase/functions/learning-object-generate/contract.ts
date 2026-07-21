import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

export const LearningObjectIAConfigSchema = z
  .object({
    enfoqueAcademico: z.string().optional(),
    instruccionesAdicionalesIA: z.string().optional(),
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
