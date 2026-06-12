import OpenAI from 'npm:openai@6.16.0'
import { mustGetEnv } from './env.ts'

export function getOpenAI() {
  // OpenAI lib toma OPENAI_API_KEY de env automáticamente,
  // pero lo validamos para fallar rápido:
  mustGetEnv('OPENAI_API_KEY')
  return new OpenAI()
}
