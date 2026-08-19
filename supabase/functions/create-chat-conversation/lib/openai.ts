import OpenAI from 'npm:openai@6.16.0'
import { requireEnv } from '../../_shared/env.ts'

export function getOpenAI() {
  // OpenAI lib toma OPENAI_API_KEY de env automáticamente,
  // pero lo validamos para fallar rápido:
  requireEnv('OPENAI_API_KEY')
  return new OpenAI()
}
