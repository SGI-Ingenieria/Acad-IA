import { invokeEdge } from '../supabase/invokeEdge'

const EDGE = {
  transcribe: 'transcribe-audio',
} as const

/**
 * Transcribe (speech-to-text) un blob de audio usando el edge function
 * `transcribe-audio`, que delega en la API de audio de OpenAI.
 */
export async function transcribeAudio(input: {
  blob: Blob
  filename?: string
  language?: string
  prompt?: string
}): Promise<{ text: string }> {
  const form = new FormData()
  const filename = input.filename ?? 'dictado.webm'
  form.append('audio', input.blob, filename)
  if (input.language) form.append('language', input.language)
  if (input.prompt) form.append('prompt', input.prompt)

  return invokeEdge<{ text: string }>(EDGE.transcribe, form)
}
