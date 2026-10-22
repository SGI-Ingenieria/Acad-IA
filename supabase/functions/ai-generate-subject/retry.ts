import {
  buildEntityAttemptOpenAIRequest,
  publishDurableEntityResponse,
  requeueEntityGenerationAttempt,
  retrySubjectGenerationAttempt,
} from '../_shared/entity-generation-attempts.ts'
import { buildSafetyIdentifier } from '../_shared/openai-response-controls.ts'
import { registrarInteraccionIA } from '../_shared/interacciones-ia.ts'
import { HttpError, sendSuccess } from '../_shared/utils.ts'
import type { OpenAIService } from '../_shared/openai-service.ts'
import type { ServiceRoleClient } from '../_shared/supabase.ts'

export async function retrySubjectGeneration(args: {
  supabase: ServiceRoleClient
  userId: string
  subjectId: string
  service: OpenAIService
}): Promise<Response> {
  const attempt = await retrySubjectGenerationAttempt({
    supabase: args.supabase,
    subjectId: args.subjectId,
    userId: args.userId,
    safetyIdentifier: await buildSafetyIdentifier(args.userId),
  })
  try {
    const request = await buildEntityAttemptOpenAIRequest({
      attempt,
      supabase: args.supabase,
    })
    const response = await args.service.createStructuredResponse(request)
    if (!response.ok) {
      throw new HttpError(
        502,
        'No se pudo iniciar el reintento. La solicitud quedó guardada para su recuperación.',
        'OPENAI_REQUEST_FAILED',
        response,
      )
    }
    const publication = await publishDurableEntityResponse({
      supabase: args.supabase,
      attempt,
      response,
      cancelDuplicateResponse: (id) => args.service.cancelResponse(id),
    })
    if (
      publication.resolution === 'stale' ||
      !publication.attempt?.openai_response_id ||
      !publication.entity
    ) {
      throw new HttpError(
        409,
        'Una generación más reciente sustituyó este reintento.',
        'AI_GENERATION_SUPERSEDED',
      )
    }
    try {
      await registrarInteraccionIA(args.supabase, {
        usuarioId: args.userId,
        asignaturaId: args.subjectId,
        tipo: 'GENERAR',
        modelo: request.model,
      })
    } catch (error) {
      console.warn(
        'El reintento se publicó, pero no se registró la interacción:',
        error,
      )
    }
    return sendSuccess({
      id: args.subjectId,
      estado: 'generando',
      openai: { responseId: publication.attempt.openai_response_id },
    })
  } catch (error) {
    // El outbox mantiene la solicitud incluso si fallan la red o la publicación.
    await requeueEntityGenerationAttempt({
      supabase: args.supabase,
      attempt,
      error,
    })
    throw error
  }
}
