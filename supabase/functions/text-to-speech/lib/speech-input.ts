export const MAX_SPEECH_INPUT_CHARS = 6_000

export class SpeechInputError extends Error {
  constructor(
    message: string,
    public readonly code: 'SPEECH_TEXT_REQUIRED' | 'SPEECH_TEXT_TOO_LONG',
  ) {
    super(message)
    this.name = 'SpeechInputError'
  }
}

export function parseSpeechInput(value: unknown): string {
  const text =
    typeof value === 'object' && value !== null && 'text' in value
      ? String((value as { text?: unknown }).text ?? '').trim()
      : ''

  if (!text) {
    throw new SpeechInputError(
      'La respuesta que quieres escuchar está vacía.',
      'SPEECH_TEXT_REQUIRED',
    )
  }

  if (text.length > MAX_SPEECH_INPUT_CHARS) {
    throw new SpeechInputError(
      'La respuesta es demasiado extensa para leerla en una sola reproducción.',
      'SPEECH_TEXT_TOO_LONG',
    )
  }

  return text
}
