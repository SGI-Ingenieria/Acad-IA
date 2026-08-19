import '@supabase/functions-js/edge-runtime.d.ts'
import { z } from 'zod'

import { preflightResponse } from '../_shared/cors.ts'
import { readJsonBody, requireMethod } from '../_shared/request.ts'
import { createAuthenticatedServiceContext } from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'
import { joinValidationMessages, validateInput } from '../_shared/validation.ts'

// Edge Function: avanza/devuelve/rechaza un plan de estudios entre estados del
// ciclo de vida (Sección 3.4). La validación (permiso + alcance + transición
// válida para el rol del usuario) vive en RPCs SECURITY DEFINER; aquí se resuelve
// el actor por su JWT y se aplica el cambio con el service role (el trigger
// fn_log_cambios_planes_estudio registra la transición en cambios_plan).

const PayloadSchema = z.object({
  planId: z.string().uuid('planId inválido.'),
  haciaEstadoId: z.string().uuid('haciaEstadoId inválido.'),
  comentario: z.string().trim().max(5000).optional(),
  registroOficial: z
    .object({
      claveSep: z
        .string()
        .trim()
        .min(1, 'La clave SEP/RVOE es requerida.')
        .max(160),
      anioSolicitudRvoe: z.number().int().min(1900).max(2200),
      numeroAcuerdo: z
        .string()
        .trim()
        .min(1, 'El número de acuerdo o dictamen es requerido.')
        .max(180),
      autoridad: z.string().trim().min(1).max(160).optional(),
      fechaAprobacion: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de aprobación inválida.'),
      vigenciaInicio: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Inicio de vigencia inválido.'),
      vigenciaFin: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fin de vigencia inválido.')
        .nullable()
        .optional(),
      documentoArchivoId: z.string().uuid().nullable().optional(),
      documentoBucket: z.string().trim().min(1).max(120).nullable().optional(),
      documentoPath: z.string().trim().min(1).max(1024).nullable().optional(),
      documentoNombre: z.string().trim().max(255).nullable().optional(),
      documentoMime: z.string().trim().max(255).nullable().optional(),
      documentoSize: z.number().int().nonnegative().nullable().optional(),
      documentoUrl: z
        .string()
        .trim()
        .url('URL del documento inválida.')
        .nullable()
        .optional(),
      observaciones: z.string().trim().max(5000).nullable().optional(),
    })
    .superRefine((registro, ctx) => {
      if (
        registro.vigenciaFin &&
        registro.vigenciaFin < registro.vigenciaInicio
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El fin de vigencia no puede ser anterior al inicio.',
          path: ['vigenciaFin'],
        })
      }
      if (!registro.documentoArchivoId && !registro.documentoPath) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debes adjuntar el archivo del documento oficial.',
          path: ['documentoPath'],
        })
      }
    })
    .optional(),
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
    const { planId, haciaEstadoId, comentario, registroOficial } = parsed.data

    const { serviceClient: supabase, user: caller } =
      await createAuthenticatedServiceContext(req, {
        missingAuthorizationMessage: 'No autenticado.',
        missingAuthorizationCode: 'UNAUTHENTICATED',
        invalidAuthorizationMessage: 'Sesión inválida.',
        invalidAuthorizationCode: 'UNAUTHENTICATED',
      })
    const callerId = caller.id

    // Estado actual + destino + tipo de estructura para reglas distintas.
    const { data: plan, error: planError } = await supabase
      .from('planes_estudio')
      .select(
        'id, estado_actual_id, estructuras_plan!planes_estudio_estructura_id_fkey(tipo)',
      )
      .eq('id', planId)
      .maybeSingle()
    if (planError) throw new HttpError(500, planError.message, 'DB_ERROR')
    if (!plan) throw new HttpError(404, 'Plan no encontrado.', 'NOT_FOUND')

    const tipoEstructura = (
      plan.estructuras_plan as unknown as { tipo: string } | null
    )?.tipo
    const esCurricular = tipoEstructura === 'CURRICULAR'

    if (plan.estado_actual_id === haciaEstadoId) {
      throw new HttpError(409, 'El plan ya está en ese estado.', 'NO_OP')
    }

    const { data: estadoDestino, error: estadoError } = await supabase
      .from('estados_plan')
      .select('id, clave, etiqueta')
      .eq('id', haciaEstadoId)
      .maybeSingle()
    if (estadoError) throw new HttpError(500, estadoError.message, 'DB_ERROR')
    if (!estadoDestino) {
      throw new HttpError(404, 'Estado destino no encontrado.', 'NOT_FOUND')
    }

    // Autorización: permiso + alcance + transición válida para el rol (o admin).
    const { data: puede, error: authzError } = await supabase.rpc(
      'usuario_puede_transicionar_plan',
      {
        p_usuario_id: callerId,
        p_plan_id: planId,
        p_hacia_estado_id: haciaEstadoId,
      },
    )
    if (authzError) throw new HttpError(500, authzError.message, 'DB_ERROR')
    if (!puede) {
      throw new HttpError(
        403,
        'No tienes permiso para realizar esta transición de estado.',
        'FORBIDDEN',
      )
    }

    // Las devoluciones/rechazos exigen un comentario que justifique la decisión.
    const esRetroceso =
      estadoDestino.clave === 'BORRADOR' || estadoDestino.clave === 'RECHAZADO'
    const comentarioLimpio = comentario?.trim() ?? ''
    if (esRetroceso && comentarioLimpio.length === 0) {
      throw new HttpError(
        422,
        'Debes agregar un comentario al devolver o rechazar el plan.',
        'COMENTARIO_REQUERIDO',
      )
    }

    if (estadoDestino.clave === 'APROBADO' && esCurricular) {
      if (!registroOficial) {
        throw new HttpError(
          422,
          'Para aprobar oficialmente el plan debes registrar clave SEP/RVOE, dictamen, vigencia y documento.',
          'REGISTRO_OFICIAL_REQUERIDO',
        )
      }

      const { error: registroError } = await supabase
        .from('registros_oficiales_plan')
        .upsert(
          {
            plan_estudio_id: planId,
            clave_sep: registroOficial.claveSep,
            anio_solicitud_rvoe: registroOficial.anioSolicitudRvoe,
            numero_acuerdo: registroOficial.numeroAcuerdo,
            autoridad: registroOficial.autoridad?.trim() || 'SEP',
            fecha_aprobacion: registroOficial.fechaAprobacion,
            vigencia_inicio: registroOficial.vigenciaInicio,
            vigencia_fin: registroOficial.vigenciaFin ?? null,
            documento_archivo_id: registroOficial.documentoArchivoId ?? null,
            documento_bucket:
              registroOficial.documentoBucket?.trim() || 'documentos-oficiales',
            documento_path: registroOficial.documentoPath?.trim() || null,
            documento_nombre: registroOficial.documentoNombre?.trim() || null,
            documento_mime: registroOficial.documentoMime?.trim() || null,
            documento_size: registroOficial.documentoSize ?? null,
            documento_url: registroOficial.documentoUrl?.trim() || null,
            observaciones: registroOficial.observaciones?.trim() || null,
            registrado_por: callerId,
            actualizado_por: callerId,
            actualizado_en: new Date().toISOString(),
          },
          { onConflict: 'plan_estudio_id' },
        )
      if (registroError) {
        throw new HttpError(500, registroError.message, 'DB_ERROR')
      }
    }

    // Aplica la transición. El trigger registra el cambio en cambios_plan.
    const { error: updateError } = await supabase
      .from('planes_estudio')
      .update({
        estado_actual_id: haciaEstadoId,
        actualizado_por: callerId,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', planId)
    if (updateError) throw new HttpError(500, updateError.message, 'DB_ERROR')

    // Comentario de la transición, asociado a la fase destino.
    if (comentarioLimpio.length > 0) {
      const { error: comentarioError } = await supabase
        .from('comentarios_plan')
        .insert({
          plan_estudio_id: planId,
          estado_id: haciaEstadoId,
          autor_id: callerId,
          categoria: 'INTERNO',
          cuerpo: comentarioLimpio,
        })
      if (comentarioError) {
        console.error(
          '[plans_transition_state] comentario insert error:',
          comentarioError.message,
        )
      }
    }

    // Cierra la tarea de revisión pendiente del actor en este plan, si existe.
    await supabase
      .from('tareas_revision')
      .update({
        estatus: 'COMPLETADA',
        completado_en: new Date().toISOString(),
      })
      .eq('plan_estudio_id', planId)
      .eq('asignado_a', callerId)
      .eq('estatus', 'PENDIENTE')

    return sendSuccess({ ok: true })
  } catch (error) {
    return edgeErrorResponse(
      error,
      'plans_transition_state',
      'Error inesperado en el servidor.',
    )
  }
})
