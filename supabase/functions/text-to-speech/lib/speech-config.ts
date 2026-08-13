// La API Audio Speech no acepta los modelos gpt-audio de Chat Completions.
export const DEFAULT_SPEECH_MODEL = 'gpt-4o-mini-tts'

export function resolveSpeechModel(configuredModel?: string | null) {
  return configuredModel?.trim() || DEFAULT_SPEECH_MODEL
}
