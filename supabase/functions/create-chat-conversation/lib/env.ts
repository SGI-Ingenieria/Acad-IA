export function mustGetEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export function getEnv(name: string, fallback?: string): string | undefined {
  return Deno.env.get(name) ?? fallback
}
