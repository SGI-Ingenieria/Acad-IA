import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

import { corsHeaders } from '../_shared/cors.ts'
import { HttpError, sendError } from '../_shared/utils.ts'
import { SPEECH_AUDIO_FORMAT } from './lib/audio-completion.ts'
import { resolveSpeechModel } from './lib/speech-config.ts'
import { parseSpeechInput, SpeechInputError } from './lib/speech-input.ts'

const TTS_MODEL = resolveSpeechModel(Deno.env.get('OPENAI_TTS_MODEL'))
const TTS_VOICE = Deno.env.get('OPENAI_TTS_VOICE') ?? 'marin'

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) {
    throw new HttpError(
      500,
      'La lectura en voz alta no está configurada.',
      'SPEECH_CONFIGURATION_MISSING',
    )
  }
  return value
}

async function assertAuthorized(req: Request) {
  const authorization =
    req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!authorization) {
    throw new HttpError(401, 'No autorizado.', 'UNAUTHORIZED')
  }

  const supabase = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_ANON_KEY'),
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } },
    },
  )
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    throw new HttpError(401, 'La sesión no es válida.', 'UNAUTHORIZED')
  }

  const { data: allowed, error: permissionError } = await supabase.rpc(
    'authz_has_permission',
    { p_permiso: 'ia.usar' },
  )
  if (permissionError) {
    throw new HttpError(
      500,
      'No se pudo validar el permiso para usar IA.',
      'SPEECH_AUTHORIZATION_FAILED',
      permissionError,
    )
  }
  if (!allowed) {
    throw new HttpError(
      403,
      'No tienes permiso para usar la lectura con IA.',
      'FORBIDDEN',
    )
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
    }

    await assertAuthorized(req)
    const body = await req.json().catch(() => null)
    const text = parseSpeechInput(body)
    const client = new OpenAI({ apiKey: requiredEnv('OPENAI_API_KEY') })
    const speech = await client.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      instructions:
        'Lee en español con tono académico, natural y claro. Reproduce literalmente el texto del usuario, sin resumirlo, corregirlo ni añadir comentarios. Respeta pausas y pronunciación de términos técnicos.',
      input: text,
      response_format: SPEECH_AUDIO_FORMAT,
    })
    const audio = await speech.arrayBuffer()

    return new Response(audio, {
      status: 200,
      headers: {
        ...corsHeaders,
        // functions-js convierte este tipo en Blob; `audio/mpeg` se trataría
        // como texto en la versión instalada del cliente.
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline; filename="respuesta-ia.mp3"',
        'X-Audio-Content-Type': 'audio/mpeg',
        'X-AI-Generated-Voice': 'true',
      },
    })
  } catch (error) {
    if (error instanceof SpeechInputError) {
      return sendError(422, error.message, error.code)
    }
    if (error instanceof HttpError) {
      console.error('[text-to-speech]', error.code, error.internalDetails)
      return sendError(error.status, error.message, error.code)
    }

    console.error('[text-to-speech] OpenAI request failed', error)
    return sendError(
      502,
      'No se pudo generar la lectura en voz alta.',
      'SPEECH_GENERATION_FAILED',
    )
  }
})
