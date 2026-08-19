import { HttpError } from './utils.ts'

export type RequiredEnvOptions = {
  status?: number
  message?: string
  code?: string
}

const DEFAULT_REQUIRED_ENV: Required<RequiredEnvOptions> = {
  status: 500,
  message: 'Configuración del servidor incompleta.',
  code: 'MISSING_ENV',
}

export function getEnv(name: string, fallback?: string): string | undefined {
  return Deno.env.get(name) ?? fallback
}

export function getFirstEnv(names: ReadonlyArray<string>): string | undefined {
  for (const name of names) {
    const value = Deno.env.get(name)
    if (value) return value
  }
  return undefined
}

export function requireEnv(
  name: string,
  options: RequiredEnvOptions = {},
): string {
  const value = Deno.env.get(name)
  if (value) return value

  const resolved = { ...DEFAULT_REQUIRED_ENV, ...options }
  throw new HttpError(resolved.status, resolved.message, resolved.code, {
    names: [name],
  })
}

export function requireFirstEnv(
  names: ReadonlyArray<string>,
  options: RequiredEnvOptions = {},
): string {
  const value = getFirstEnv(names)
  if (value) return value

  const resolved = { ...DEFAULT_REQUIRED_ENV, ...options }
  throw new HttpError(resolved.status, resolved.message, resolved.code, {
    names: [...names],
  })
}
