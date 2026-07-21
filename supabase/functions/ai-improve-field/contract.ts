import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const ReferenceSelectionSchema = z
  .object({
    fileIds: z.array(z.string().uuid()).max(5).optional().default([]),
    collectionIds: z.array(z.string().uuid()).max(5).optional().default([]),
  })
  .strict()
  .optional()
  .default({ fileIds: [], collectionIds: [] })

export const AIImproveFieldRequestSchema = z
  .object({
    entidad: z.enum(['plan', 'asignatura']),
    entidad_id: z.string().uuid(),
    clave: z.string().trim().min(1),
    campo_schema: z.record(z.unknown()).nullable().optional(),
    contenido_actual: z.string().default(''),
    prompt_usuario: z.string().trim().min(1).max(4000),
    es_richtext: z.boolean().default(false),
    references: ReferenceSelectionSchema,
    reasoning_effort: z
      .enum(['auto', 'none', 'low', 'medium', 'high'])
      .optional()
      .default('auto'),
  })
  .strict()

export type AIImproveFieldRequest = z.infer<typeof AIImproveFieldRequestSchema>

export function mergeImprovementReferenceContext(
  prompt: string,
  context: string,
): string {
  return context ? `${context}\n\nSolicitud de mejora:\n${prompt}` : prompt
}
