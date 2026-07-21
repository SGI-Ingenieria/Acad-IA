export const DEFAULT_SPEECH_MODEL = 'gpt-audio-1.5'

export function resolveSpeechModel(configuredModel?: string | null) {
  return configuredModel?.trim() || DEFAULT_SPEECH_MODEL
}
