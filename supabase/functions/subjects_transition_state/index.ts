import '@supabase/functions-js/edge-runtime.d.ts'
import { z } from 'zod'

import { preflightResponse } from '../_shared/cors.ts'
import { readJsonBody, requireMethod } from '../_shared/request.ts'
import { createAuthenticatedServiceContext } from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'
import { joinValidationMessages, validateInput } from '../_shared/validation.ts'

// Edge Function: flujo de revisión de la materia (estilo PR). El profesor envía a
// revisión (borrador→revisada); un revisor aprueba (revisada→aprobada) o pide
// cambios (revisada→borrador). La validación vive en la RPC SECURITY DEFINER
// usuario_puede_transicionar_asignatura; aquí se resuelve el actor por su JWT y
// se aplica con el service role. Se registra la transición en cambios_asignatura.

const PayloadSchema = z.object({
  asignaturaId: z.string().uuid('asignaturaId inválido.'),
  nuevoEstado: z.enum(['borrador', 'revisada', 'aprobada']),
  comentario: z.string().trim().max(5000).optional(),
})

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }
  try {
    requireMethod(req, 'POST')
    const rawBody = await readJsonBody(req)

    const parsed = validateInput(PayloadSchema, rawBody, {
      message: joinValidationMessages,
    })
    const { asignaturaId, nuevoEstado, comentario } = parsed.data

    const { serviceClient: supabase, user: caller } =
      await createAuthenticatedServiceContext(req, {
        missingAuthorizationMessage: 'No autenticado.',
        missingAuthorizationCode: 'UNAUTHENTICATED',
        invalidAuthorizationMessage: 'Sesión inválida.',
        invalidAuthorizationCode: 'UNAUTHENTICATED',
      })
    const callerId = caller.id

    const { data: asignatura, error: asigError } = await supabase
      .from('asignaturas')
      .select('id, estado, plan_estudio_id')
      .eq('id', asignaturaId)
      .maybeSingle()
    if (asigError) throw new HttpError(500, asigError.message, 'DB_ERROR')
    if (!asignatura) {
      throw new HttpError(404, 'Asignatura no encontrada.', 'NOT_FOUND')
    }

    const { data: planEstudio, error: planError } = await supabase
      .from('planes_estudio')
      .select('id, estado_actual_id')
      .eq('id', asignatura.plan_estudio_id)
      .maybeSingle()
    if (planError) throw new HttpError(500, planError.message, 'DB_ERROR')
    if (asignatura.estado === nuevoEstado) {
      throw new HttpError(409, 'La asignatura ya está en ese estado.', 'NO_OP')
    }

    const { data: puede, error: authzError } = await supabase.rpc(
      'usuario_puede_transicionar_asignatura',
      {
        p_usuario_id: callerId,
        p_asignatura_id: asignaturaId,
        p_nuevo_estado: nuevoEstado,
      },
    )
    if (authzError) throw new HttpError(500, authzError.message, 'DB_ERROR')
    if (!puede) {
      throw new HttpError(
        403,
        'No puedes realizar esta transición de la asignatura.',
        'FORBIDDEN',
      )
    }

    // "Pedir cambios" (revisada→borrador) exige un comentario que lo justifique.
    const esPedirCambios =
      nuevoEstado === 'borrador' && asignatura.estado === 'revisada'
    const comentarioLimpio = comentario?.trim() ?? ''
    if (esPedirCambios && comentarioLimpio.length === 0) {
      throw new HttpError(
        422,
        'Agrega un comentario indicando los cambios solicitados.',
        'COMENTARIO_REQUERIDO',
      )
    }

    const { error: updateError } = await supabase
      .from('asignaturas')
      .update({
        estado: nuevoEstado,
        actualizado_por: callerId,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', asignaturaId)
    if (updateError) throw new HttpError(500, updateError.message, 'DB_ERROR')

    // Registra la transición en el historial de la materia (el trigger de
    // auditoría no rastrea cambios de estado).
    await supabase.from('cambios_asignatura').insert({
      asignatura_id: asignaturaId,
      cambiado_por: callerId,
      tipo: 'TRANSICION_ESTADO',
      campo: 'estado',
      valor_anterior: asignatura.estado,
      valor_nuevo: nuevoEstado,
      fuente: 'HUMANO',
    })

    if (comentarioLimpio.length > 0) {
      const { error: comentarioError } = await supabase
        .from('comentarios_plan')
        .insert({
          plan_estudio_id: asignatura.plan_estudio_id,
          estado_id: planEstudio?.estado_actual_id ?? null,
          asignatura_id: asignaturaId,
          autor_id: callerId,
          categoria: 'INTERNO',
          cuerpo: comentarioLimpio,
        })
      if (comentarioError) {
        console.error(
          '[subjects_transition_state] comentario insert error:',
          comentarioError.message,
        )
      }
    }

    return sendSuccess({ ok: true })
  } catch (error) {
    return edgeErrorResponse(
      error,
      'subjects_transition_state',
      'Error inesperado en el servidor.',
    )
  }
})
