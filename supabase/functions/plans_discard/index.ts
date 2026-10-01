import '@supabase/functions-js/edge-runtime.d.ts'
import { z } from 'zod'

import { preflightResponse } from '../_shared/cors.ts'
import { readJsonBody, requireMethod } from '../_shared/request.ts'
import { createAuthenticatedServiceContext } from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'
import { validateInput } from '../_shared/validation.ts'

const PayloadSchema = z.object({
  planId: z.string().uuid('planId inválido.'),
})

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return preflightResponse()

  try {
    requireMethod(req, 'POST')
    const { planId } = validateInput(
      PayloadSchema,
      await readJsonBody(req),
    ).data
    const { serviceClient: supabase, user } =
      await createAuthenticatedServiceContext(req, {
        missingAuthorizationMessage: 'No autenticado.',
        missingAuthorizationCode: 'UNAUTHENTICATED',
        invalidAuthorizationMessage: 'Sesión inválida.',
        invalidAuthorizationCode: 'UNAUTHENTICATED',
      })

    const { data: plan, error: planError } = await supabase
      .from('planes_estudio')
      .select('id, rol_version_plan, descartado_en')
      .eq('id', planId)
      .maybeSingle()
    if (planError) throw new HttpError(500, planError.message, 'DB_ERROR')
    if (!plan) throw new HttpError(404, 'Plan no encontrado.', 'NOT_FOUND')
    if (plan.descartado_en) {
      throw new HttpError(
        409,
        'El plan ya fue descartado.',
        'ALREADY_DISCARDED',
      )
    }
    if (plan.rol_version_plan !== 'VERSION_TRABAJO') {
      throw new HttpError(
        409,
        'Solo se pueden descartar versiones de trabajo.',
        'PLAN_READ_ONLY',
      )
    }

    // La operación no acepta un actor elegido por el cliente: valida que quien
    // confirmó el descarte tiene la misma capacidad de edición contextual.
    const { data: puedeDescartar, error: authzError } = await supabase.rpc(
      'usuario_puede_editar_plan',
      { p_usuario_id: user.id, p_plan_id: planId },
    )
    if (authzError) throw new HttpError(500, authzError.message, 'DB_ERROR')
    if (!puedeDescartar) {
      throw new HttpError(
        403,
        'No tienes permiso para descartar este plan.',
        'FORBIDDEN',
      )
    }

    const { data: archived, error: archiveError } = await supabase
      .from('planes_estudio')
      .update({
        descartado_en: new Date().toISOString(),
        descartado_por: user.id,
        actualizado_en: new Date().toISOString(),
        actualizado_por: user.id,
      })
      .eq('id', planId)
      .is('descartado_en', null)
      .select('id, descartado_en')
      .maybeSingle()
    if (archiveError) throw new HttpError(500, archiveError.message, 'DB_ERROR')
    if (!archived) {
      throw new HttpError(
        409,
        'El plan ya fue descartado.',
        'ALREADY_DISCARDED',
      )
    }

    return sendSuccess({ ok: true, descartadoEn: archived.descartado_en })
  } catch (error) {
    return edgeErrorResponse(
      error,
      'plans_discard',
      'No se pudo descartar el plan.',
    )
  }
})
