import { invokeEdge } from '@/data/supabase/invokeEdge'

export const MAX_ASSISTANT_SPEECH_CHARS = 6_000

export async function generarVozRespuestaIA(text: string): Promise<Blob> {
  return invokeEdge<Blob>('text-to-speech', { text }, { responseType: 'blob' })
}
