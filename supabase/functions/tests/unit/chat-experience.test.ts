import { assertEquals, assertThrows } from 'jsr:@std/assert@1'

import {
  buildPromptChatTitle,
  DEFAULT_CHAT_TITLE_MODEL,
  fallbackGeneratedChatTitle,
  resolveChatTitleModel,
  shouldReplaceGeneratedChatName,
} from '../../create-chat-conversation/lib/chat-title.ts'
import { httpErrorResponse } from '../../create-chat-conversation/lib/errors.ts'
import { HttpError as SharedHttpError } from '../../_shared/utils.ts'
import {
  DEFAULT_SPEECH_MODEL,
  resolveSpeechModel,
} from '../../text-to-speech/lib/speech-config.ts'
import {
  MAX_SPEECH_INPUT_CHARS,
  parseSpeechInput,
  SpeechInputError,
} from '../../text-to-speech/lib/speech-input.ts'

Deno.test(
  'los modelos vigentes conservan overrides sin hacer llamadas de red',
  () => {
    assertEquals(DEFAULT_CHAT_TITLE_MODEL, 'gpt-5.6-luna')
    assertEquals(resolveChatTitleModel(), DEFAULT_CHAT_TITLE_MODEL)
    assertEquals(
      resolveChatTitleModel('modelo-titulos-interno'),
      'modelo-titulos-interno',
    )
    assertEquals(DEFAULT_SPEECH_MODEL, 'gpt-audio-1.5')
    assertEquals(resolveSpeechModel(), DEFAULT_SPEECH_MODEL)
    assertEquals(resolveSpeechModel('modelo-voz-interno'), 'modelo-voz-interno')
  },
)

Deno.test(
  'el título provisional nunca queda genérico cuando existe una solicitud',
  () => {
    const request =
      'Necesito comparar la progresión de competencias entre los primeros semestres.'

    assertEquals(
      fallbackGeneratedChatTitle(request, []),
      'comparar la progresión de competencias entre los primeros semestres',
    )
    assertEquals(
      buildPromptChatTitle(request),
      fallbackGeneratedChatTitle(request, []),
    )
  },
)

Deno.test(
  'sólo los nombres provisionales son reemplazables por el título final',
  () => {
    const request = 'Analiza los prerrequisitos del mapa curricular.'
    const provisional = buildPromptChatTitle(request)

    assertEquals(
      shouldReplaceGeneratedChatName('Consulta académica', request),
      true,
    )
    assertEquals(shouldReplaceGeneratedChatName(provisional, request), true)
    assertEquals(
      shouldReplaceGeneratedChatName('Nombre elegido por la autora', request),
      false,
    )
  },
)

Deno.test(
  'la lectura en voz alta acepta texto válido y limita entradas extensas',
  () => {
    assertEquals(
      parseSpeechInput({ text: '  Respuesta académica.  ' }),
      'Respuesta académica.',
    )

    assertThrows(
      () => parseSpeechInput({ text: '   ' }),
      SpeechInputError,
      'vacía',
    )
    assertThrows(
      () => parseSpeechInput({ text: 'a'.repeat(MAX_SPEECH_INPUT_CHARS + 1) }),
      SpeechInputError,
      'demasiado extensa',
    )
  },
)

Deno.test(
  'el chat conserva los errores recuperables de referencias documentales',
  async () => {
    const response = httpErrorResponse(
      new SharedHttpError(
        409,
        'La referencia todavía se está preparando.',
        'DOCUMENT_STILL_PROCESSING',
        { fileId: 'archivo-en-proceso' },
      ),
    )

    if (!response) throw new Error('Se esperaba una respuesta HTTP')

    assertEquals(response.status, 409)
    assertEquals(await response.json(), {
      error: 'DOCUMENT_STILL_PROCESSING',
      message: 'La referencia todavía se está preparando.',
      details: { fileId: 'archivo-en-proceso' },
    })
  },
)
