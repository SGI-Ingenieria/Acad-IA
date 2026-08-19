import '@supabase/functions-js/edge-runtime.d.ts'

import { preflightResponse } from '../_shared/cors.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import {
  logEdgeRequest,
  requireContentType,
  requireMethod,
} from '../_shared/request.ts'
import { requireAuthenticatedUser } from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'

declare const Deno: {
  env: { get: (key: string) => string | undefined }
  serve: (handler: (req: Request) => Promise<Response>) => void
}

const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25 MB (límite de la API de audio de OpenAI)
const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mpga',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'video/webm',
]

Deno.serve(async (req: Request): Promise<Response> => {
  const functionName = logEdgeRequest(req, 'transcribe-audio')

  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }

  try {
    requireMethod(req, 'POST')
    requireContentType(req, 'multipart/form-data', {
      message: 'Content-Type no soportado. Usa multipart/form-data.',
    })

    await requireAuthenticatedUser(req, {
      missingAuthorizationMessage: 'No autorizado.',
      invalidAuthorizationMessage: 'Token inválido.',
    })

    let form: FormData
    try {
      form = await req.formData()
    } catch (e) {
      throw new HttpError(400, 'Body multipart inválido.', 'INVALID_FORM', {
        cause: e,
      })
    }

    const audio = form.get('audio')
    if (!(audio instanceof File)) {
      throw new HttpError(
        422,
        'Falta el archivo de audio (campo "audio").',
        'VALIDATION_ERROR',
      )
    }

    if (audio.size === 0) {
      throw new HttpError(422, 'El audio está vacío.', 'VALIDATION_ERROR')
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      throw new HttpError(
        413,
        'El audio excede el límite de 25 MB.',
        'PAYLOAD_TOO_LARGE',
        { size: audio.size, max: MAX_AUDIO_BYTES },
      )
    }

    const mime = (audio.type || '').toLowerCase()
    if (mime && !ALLOWED_AUDIO_TYPES.some((t) => mime.includes(t))) {
      console.warn(
        `[${functionName}]: tipo de audio no listado (${mime}), se intentará de todos modos`,
      )
    }

    const model = String(form.get('model') || '') || undefined
    const language = String(form.get('language') || '') || 'es'
    const prompt = String(form.get('prompt') || '') || undefined

    const svc = OpenAIService.fromEnv()
    if (!(svc instanceof OpenAIService)) {
      throw new HttpError(500, svc.message, 'MISSING_ENV', svc)
    }

    const { text } = await svc.transcribe({
      file: audio,
      model,
      language,
      prompt,
    })

    return sendSuccess({ text })
  } catch (error) {
    return edgeErrorResponse(
      error,
      functionName,
      'No se pudo transcribir el audio.',
      'INTERNAL_ERROR',
    )
  }
})
