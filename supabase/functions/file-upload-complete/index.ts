import '@supabase/functions-js/edge-runtime.d.ts'

import { corsHeaders } from '../_shared/cors.ts'
import {
  DOCUMENTOS_BUCKET,
  MAX_FILE_BYTES,
  requireAuthenticatedUser,
  serviceClient,
} from '../_shared/documentos-academicos.ts'
import { wakeDocumentWorker } from '../_shared/documentos-worker.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders })
  try {
    if (request.method !== 'POST')
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
    const user = await requireAuthenticatedUser(request)
    const body = await request.json().catch(() => null)
    const sessionId =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>).sessionId
        : null
    if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      throw new HttpError(
        422,
        'sessionId debe ser un UUID.',
        'VALIDATION_ERROR',
      )
    }

    const supabase = serviceClient()
    const { data: session, error: sessionError } = await supabase
      .from('upload_sessions')
      .select(
        'id, tenant_id, user_id, temporary_path, declared_size, status, expires_at, result_file_id',
      )
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (sessionError || !session)
      throw new HttpError(
        404,
        'No se encontró la sesión de carga.',
        'UPLOAD_SESSION_NOT_FOUND',
      )
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await supabase
        .from('upload_sessions')
        .update({ status: 'expired', error_code: 'UPLOAD_EXPIRED' })
        .eq('id', sessionId)
      throw new HttpError(
        410,
        'La sesión de carga ya venció.',
        'UPLOAD_SESSION_EXPIRED',
      )
    }
    if (session.status === 'ready')
      return sendSuccess({
        data: {
          id: sessionId,
          fileId: session.result_file_id,
          status: 'ready',
        },
      })
    if (['failed', 'expired'].includes(session.status)) {
      throw new HttpError(
        409,
        'La sesión no se puede completar en su estado actual.',
        'UPLOAD_SESSION_TERMINAL',
      )
    }

    const { data: object, error: objectError } = await supabase.storage
      .from(DOCUMENTOS_BUCKET)
      .download(session.temporary_path)
    if (objectError || !object) {
      throw new HttpError(
        409,
        'El archivo temporal aún no está disponible.',
        'UPLOAD_OBJECT_MISSING',
      )
    }
    if (
      object.size < 1 ||
      object.size > MAX_FILE_BYTES ||
      object.size !== Number(session.declared_size)
    ) {
      await supabase
        .from('upload_sessions')
        .update({ status: 'failed', error_code: 'UPLOAD_SIZE_MISMATCH' })
        .eq('id', sessionId)
      throw new HttpError(
        422,
        'El tamaño real no coincide con la carga declarada.',
        'UPLOAD_SIZE_MISMATCH',
      )
    }

    const { error: statusError } = await supabase
      .from('upload_sessions')
      .update({ status: 'uploaded', error_code: null })
      .eq('id', sessionId)
    if (statusError)
      throw new HttpError(
        500,
        'No se pudo confirmar la carga.',
        'UPLOAD_CONFIRM_FAILED',
      )
    const { error: queueError } = await supabase.rpc(
      'encolar_trabajo_ingesta_documental',
      {
        p_tenant_id: session.tenant_id,
        p_upload_session_id: session.id,
        p_file_version_id: null,
        p_tipo: 'hash_file',
        p_idempotency_key: `hash:${session.tenant_id}:${session.id}`,
        p_payload: { upload_session_id: session.id },
      },
    )
    if (queueError)
      throw new HttpError(
        500,
        'No se pudo encolar el procesamiento.',
        'INGESTION_ENQUEUE_FAILED',
      )

    EdgeRuntime.waitUntil(
      wakeDocumentWorker('upload-complete').catch((error) =>
        console.warn('No se pudo acelerar la ingesta:', error),
      ),
    )
    return sendSuccess({ data: { id: sessionId, status: 'hashing' } }, 202)
  } catch (error) {
    if (error instanceof HttpError)
      return sendError(error.status, error.message, error.code)
    console.error('file-upload-complete failed', error)
    return sendError(
      500,
      'No se pudo completar la carga.',
      'INTERNAL_SERVER_ERROR',
    )
  }
})
