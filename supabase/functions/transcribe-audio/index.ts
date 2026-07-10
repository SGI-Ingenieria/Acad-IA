import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'

import { corsHeaders } from '../_shared/cors.ts'
import { OpenAIService } from '../_shared/openai-service.ts'
import { HttpError, sendError, sendSuccess } from '../_shared/utils.ts'

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
  const functionName = 'transcribe-audio'
  console.log(`[${new Date().toISOString()}][${functionName}]: Request received`)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED', {
        method: req.method,
      })
    }

    const authHeaderRaw =
      req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeaderRaw) {
      throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED', {
        reason: 'missing_authorization_header',
      })
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('multipart/form-data')) {
      throw new HttpError(
        415,
        'Content-Type no soportado.',
        'UNSUPPORTED_MEDIA_TYPE',
        { contentType, expected: 'multipart/form-data' },
      )
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new HttpError(
        500,
        'Configuración del servidor incompleta.',
        'MISSING_ENV',
        {
          missing: [
            !SUPABASE_URL ? 'SUPABASE_URL' : null,
            !SUPABASE_ANON_KEY ? 'SUPABASE_ANON_KEY' : null,
          ].filter(Boolean),
        },
      )
    }

    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeaderRaw } },
    })

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser()
    if (userErr || !userData?.user) {
      throw new HttpError(401, 'Token inválido.', 'UNAUTHORIZED', {
        reason: userErr?.message ?? 'invalid_token',
      })
    }

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
  } catch (err) {
    if (err instanceof HttpError) {
      console.error(`[${functionName}] HttpError:`, err.message, err.internalDetails)
      return sendError(err.status, err.message, err.code)
    }
    console.error(`[${functionName}] Unexpected error:`, err)
    return sendError(
      500,
      'No se pudo transcribir el audio.',
      'INTERNAL_ERROR',
    )
  }
})
