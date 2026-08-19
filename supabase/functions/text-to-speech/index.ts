import '@supabase/functions-js/edge-runtime.d.ts'
import OpenAI from 'openai'

import { corsHeaders, preflightResponse } from '../_shared/cors.ts'
import { requireEnv } from '../_shared/env.ts'
import { requireMethod } from '../_shared/request.ts'
import { createAuthenticatedUserContext } from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendError } from '../_shared/utils.ts'
import { SPEECH_AUDIO_FORMAT } from './lib/audio-completion.ts'
import { resolveSpeechModel } from './lib/speech-config.ts'
import { parseSpeechInput, SpeechInputError } from './lib/speech-input.ts'

const TTS_MODEL = resolveSpeechModel(Deno.env.get('OPENAI_TTS_MODEL'))
const TTS_VOICE = Deno.env.get('OPENAI_TTS_VOICE') ?? 'marin'

async function assertAuthorized(req: Request) {
  const { userClient } = await createAuthenticatedUserContext(req, {
    missingAuthorizationMessage: 'No autorizado.',
    invalidAuthorizationMessage: 'La sesión no es válida.',
  })

  const { data: allowed, error: permissionError } = await userClient.rpc(
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
    return preflightResponse()
  }

  try {
    requireMethod(req, 'POST')

    await assertAuthorized(req)
    const body = await req.json().catch(() => null)
    const text = parseSpeechInput(body)
    const client = new OpenAI({
      apiKey: requireEnv('OPENAI_API_KEY', {
        message: 'La lectura en voz alta no está configurada.',
        code: 'SPEECH_CONFIGURATION_MISSING',
      }),
    })
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
    return edgeErrorResponse(
      error,
      'text-to-speech',
      'No se pudo generar la lectura en voz alta.',
      'SPEECH_GENERATION_FAILED',
      502,
    )
  }
})
