export const SPEECH_AUDIO_FORMAT = 'mp3' as const

export function buildSpeechMessages(text: string) {
  return [
    {
      role: 'system' as const,
      content:
        'Lee en español con tono académico, natural y claro. Reproduce literalmente el texto del usuario, sin resumirlo, corregirlo ni añadir comentarios. Respeta pausas y pronunciación de términos técnicos.',
    },
    {
      role: 'user' as const,
      content: text,
    },
  ]
}

export function decodeSpeechAudio(audioData?: string | null) {
  if (!audioData) {
    throw new Error('La respuesta de OpenAI no incluyó audio.')
  }

  const binary = atob(audioData)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
