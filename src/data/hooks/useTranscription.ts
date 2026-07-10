import { useMutation } from '@tanstack/react-query'

import { transcribeAudio } from '../api/transcription.api'

/**
 * Mutación para convertir un blob de audio en texto (dictado por voz).
 * El manejo de errores se hace en el componente consumidor para poder
 * distinguir permisos de micrófono vs fallos de transcripción.
 */
export function useTranscribeAudio() {
  return useMutation({
    mutationFn: transcribeAudio,
  })
}
